import { EtapaLead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { proximaAcaoAncora, type EntradaAncora } from "@/server/cobrancas/regua";
import {
  carregarPoliticaComercial,
  type PoliticaComercialCarregada,
} from "@/server/comercial/regua-comercial";
import { enfileirarIntencaoComercial } from "./fila";
import { renderizarTemplate } from "./render";

// ENFILEIRADOR da régua COMERCIAL "lead novo sem resposta" (doc 27 C1). Roda no MESMO tick
// do cron da cobrança (um enfileirador por cenário), grava INTENÇÕES via a fila única e
// deixa o despachante enviar/simular. Reusa o MESMO cérebro (proximaAcaoAncora) — nunca um
// motor paralelo (doc 29 regra 1). Passa a ORDEM CANÔNICA ao motor (corte de progresso).
//
// ÂNCORA = 1º inbound do lead (ConversaWhatsApp.capturadaEm). O D0 imediato é a SAUDAÇÃO da
// C1 (reativa); esta régua cobre os follow-ups quando o lead esfria.

// Etapas em que o lead ainda é "novo sem resposta". Sair delas ENCERRA a cadência.
const ETAPAS_FRIAS: EtapaLead[] = [EtapaLead.NOVO, EtapaLead.EM_ATENDIMENTO];

export interface ResultadoCronComercial {
  executou: boolean;
  motivoParada: string | null;
  leadsAvaliados: number;
  acoesDevidas: number;
  enfileiradas: number;
  reabertas: number;
  jaExistentes: number;
  encerrados: number;
}

const zerado = (motivo: string): ResultadoCronComercial => ({
  executou: false,
  motivoParada: motivo,
  leadsAvaliados: 0,
  acoesDevidas: 0,
  enfileiradas: 0,
  reabertas: 0,
  jaExistentes: 0,
  encerrados: 0,
});

export async function rodarLeadNovoSemResposta(agora: Date = new Date()): Promise<ResultadoCronComercial> {
  const politica: PoliticaComercialCarregada = await carregarPoliticaComercial();

  // Toda automação nasce desligada (doc 27). DESLIGADA não gera nem intenção; SHADOW gera
  // intenções que o despachante marcará como SIMULADA (ensaio observável).
  if (politica.estado === "DESLIGADA") return zerado("politica_desligada");
  if (!politica.numeroRemetenteId) return zerado("sem_numero_remetente");
  if (politica.degraus.length === 0) return zerado("sem_degraus_ativos");

  const numero = await prisma.numeroWhatsApp.findUnique({ where: { id: politica.numeroRemetenteId } });
  if (!numero || !numero.ativo) return zerado("numero_remetente_inativo");
  // Trava S1 LIBERADA para o comercial no Baileys (decisão de produto — cadência roda no
  // número de vendas; o risco de ban é contido por teto/janela/pacing, não pela trava).

  // Conversas no número remetente com um lead vinculado e âncora (1º inbound) registrada.
  const conversas = await prisma.conversaWhatsApp.findMany({
    where: {
      numeroId: numero.id,
      capturadaEm: { not: null },
      contato: { leadId: { not: null }, optOutEm: null },
    },
    include: {
      contato: { include: { lead: { include: { pais: true } } } },
    },
  });

  const r: ResultadoCronComercial = { ...zerado(""), executou: true, motivoParada: null, leadsAvaliados: conversas.length };

  for (const conversa of conversas) {
    const lead = conversa.contato.lead;
    if (!lead || !conversa.capturadaEm) continue;

    // STOP-CONDITIONS (doc 27 §regras transversais) resolvidas AQUI → `encerrada` p/ o motor:
    // mudança de etapa, opt-out (já filtrado), resposta do lead ou vendedor assumiu.
    const etapaAvancou = !ETAPAS_FRIAS.includes(lead.etapa);
    const [respostas, humanas] = await Promise.all([
      // resposta do lead = inbound DEPOIS da âncora (a âncora é o 1º inbound).
      prisma.mensagemWhatsApp.count({
        where: { conversaId: conversa.id, direcao: "ENTRADA", criadoEm: { gt: conversa.capturadaEm } },
      }),
      // vendedor assumiu = envio HUMANO manual (a saudação reativa é CRON, não conta).
      prisma.mensagemWhatsApp.count({
        where: { conversaId: conversa.id, direcao: "SAIDA", origem: "HUMANO" },
      }),
    ]);
    const encerrada = etapaAvancou || respostas > 0 || humanas > 0;

    const passosFeitos = await passosComerciaisFeitos(lead.id, politica.chave);

    const entrada: EntradaAncora = { ancoraEm: conversa.capturadaEm, encerrada, passosFeitos };
    const acao = proximaAcaoAncora(entrada, agora, politica.degraus, politica.ordem);

    if (acao.estado === "encerrada") {
      r.encerrados += 1;
      continue;
    }
    if (acao.estado !== "acao_devida" || !acao.passo) continue;
    r.acoesDevidas += 1;

    const degrau = politica.degraus.find((d) => d.passo === acao.passo);
    if (!degrau) continue;

    const { corpo, variaveis } = renderizarTemplate(degrau.templateCorpo, {
      nome: lead.nome,
      valor: 0,
      moeda: "USD", // lead-novo não usa {valor} — dummy p/ a assinatura compartilhada do render
      vencimento: agora,
      idioma: lead.pais?.idioma ?? "es",
    });

    const resultado = await prisma.$transaction((tx) =>
      enfileirarIntencaoComercial(tx, {
        leadId: lead.id,
        passoComercial: acao.passo!,
        numeroId: numero.id,
        contatoId: conversa.contatoId,
        corpoRenderizado: corpo,
        variaveis,
        templateId: degrau.templateId,
        politicaComercialId: politica.id,
      }),
    );
    if (resultado === "criada") r.enfileiradas += 1;
    else if (resultado === "reaberta") r.reabertas += 1;
    else r.jaExistentes += 1;
  }

  return r;
}

/** Passos da cadência já cumpridos (eventos ReguaComercialEnviada `{ chave, passo }`). */
async function passosComerciaisFeitos(leadId: string, chave: string): Promise<string[]> {
  const eventos = await prisma.evento.findMany({
    where: { agregadoTipo: "Lead", agregadoId: leadId, tipo: "ReguaComercialEnviada" },
    select: { payload: true },
  });
  const passos: string[] = [];
  for (const e of eventos) {
    const p = e.payload as { chave?: string; passo?: string } | null;
    if (p && p.chave === chave && typeof p.passo === "string") passos.push(p.passo);
  }
  return passos;
}
