import { EtapaLead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { proximaAcaoAncora } from "@/server/cobrancas/regua";
import {
  carregarPoliticaComercial,
  type PoliticaComercialCarregada,
} from "@/server/comercial/regua-comercial";
import { CHAVE_LEAD_NOVO, CHAVE_NO_SHOW, CHAVE_PRE_EXPERIMENTAL } from "@/server/comercial/regua-fabrica";
import { enfileirarIntencaoComercial } from "./fila";
import { renderizarTemplate } from "./render";

// ENFILEIRADORES das réguas COMERCIAIS (doc 27 C1/C2). "Um motor, N políticas": o núcleo
// (`processarCadencia`) é UM só — cada cenário só resolve seus CANDIDATOS (âncora +
// stop-conditions). Reusa o cérebro `proximaAcaoAncora` com a ORDEM CANÔNICA imutável
// (corte de progresso forward-only) e a fila/despachante compartilhados (doc 29 regra 1).
//
// Cenários:
//  - LEAD_NOVO_SEM_RESPOSTA: âncora = 1º inbound do lead (ConversaWhatsApp.capturadaEm);
//  - PRE_EXPERIMENTAL: âncora = horário da aula (offsets NEGATIVOS: 24h e 2h ANTES);
//  - NO_SHOW: âncora = horário da aula perdida (check-in do professor marcou NO_SHOW).

// Etapa em que o lead ainda é "novo sem resposta". Sair dela ENCERRA a cadência (regra
// transversal do doc 27: mudança de etapa encerra a política). Só NOVO permanece frio —
// EM_ATENDIMENTO significa que o vendedor JÁ assumiu, e a automação não pode falar por cima
// dele antes de existir uma mensagem HUMANO na conversa (review PR #55 P1).
const ETAPAS_FRIAS: EtapaLead[] = [EtapaLead.NOVO];

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

/** Um lead pronto para o motor: âncora resolvida + stop-conditions já avaliadas. */
interface CandidatoCadencia {
  leadId: string;
  contatoId: string;
  nome: string;
  idioma: string;
  ancoraEm: Date;
  encerrada: boolean;
}

/**
 * Identidade da OCORRÊNCIA (review PR #56): a âncora em ISO. A cadência pertence ao CICLO,
 * não ao lead — uma experimental reagendada e um segundo no-show são ocorrências NOVAS, e
 * precisam nascer com a cadência limpa. Sem isto o histórico do lead é eterno: os `-24h`/
 * `-2h` do compromisso anterior já marcariam os passos do novo como cumpridos.
 */
const ocorrenciaDe = (ancoraEm: Date): string => ancoraEm.toISOString();

/**
 * NÚCLEO compartilhado: roda o motor para cada candidato e enfileira o passo devido.
 * Cada cenário entrega os candidatos; daqui para frente tudo é igual.
 */
async function processarCadencia(
  chave: string,
  resolverCandidatos: (politica: PoliticaComercialCarregada, numeroId: string) => Promise<CandidatoCadencia[]>,
  agora: Date,
): Promise<ResultadoCronComercial> {
  const politica = await carregarPoliticaComercial(chave);

  // Toda automação nasce desligada (doc 27). DESLIGADA não gera nem intenção; SHADOW gera
  // intenções que o despachante marcará como SIMULADA (ensaio observável).
  if (politica.estado === "DESLIGADA") return zerado("politica_desligada");
  // Sem registro no banco (fábrica) não há identidade de política — e a identidade é parte
  // da chave de idempotência da intenção (review PR #55). Nada é enfileirado.
  const politicaId = politica.id;
  if (!politicaId) return zerado("politica_nao_persistida");
  if (!politica.numeroRemetenteId) return zerado("sem_numero_remetente");
  if (politica.degraus.length === 0) return zerado("sem_degraus_ativos");

  const numero = await prisma.numeroWhatsApp.findUnique({ where: { id: politica.numeroRemetenteId } });
  if (!numero || !numero.ativo) return zerado("numero_remetente_inativo");
  // Trava S1 LIBERADA para o comercial no Baileys (decisão de produto — a cadência roda no
  // número de vendas; o risco de ban é contido por teto/janela/pacing, não pela trava).

  const candidatos = await resolverCandidatos(politica, numero.id);
  const r: ResultadoCronComercial = { ...zerado(""), executou: true, motivoParada: null, leadsAvaliados: candidatos.length };

  for (const c of candidatos) {
    const ocorrencia = ocorrenciaDe(c.ancoraEm);
    const passosFeitos = await passosComerciaisFeitos(c.leadId, chave, ocorrencia);
    const acao = proximaAcaoAncora(
      { ancoraEm: c.ancoraEm, encerrada: c.encerrada, passosFeitos },
      agora,
      politica.degraus,
      politica.ordem,
    );

    if (acao.estado === "encerrada") {
      r.encerrados += 1;
      continue;
    }
    if (acao.estado !== "acao_devida" || !acao.passo) continue;
    r.acoesDevidas += 1;

    const degrau = politica.degraus.find((d) => d.passo === acao.passo);
    if (!degrau) continue;

    const { corpo, variaveis } = renderizarTemplate(degrau.templateCorpo, {
      nome: c.nome,
      valor: 0,
      moeda: "USD", // cadências comerciais não usam {valor} — dummy p/ a assinatura do render
      vencimento: agora,
      idioma: c.idioma,
    });

    const resultado = await prisma.$transaction((tx) =>
      enfileirarIntencaoComercial(tx, {
        leadId: c.leadId,
        passoComercial: acao.passo!,
        ocorrenciaComercial: ocorrencia,
        numeroId: numero.id,
        contatoId: c.contatoId,
        corpoRenderizado: corpo,
        variaveis,
        templateId: degrau.templateId,
        politicaComercialId: politicaId,
      }),
    );
    if (resultado === "criada") r.enfileiradas += 1;
    else if (resultado === "reaberta") r.reabertas += 1;
    else r.jaExistentes += 1;
  }

  return r;
}

// ── Cenário 1 (C1): lead novo sem resposta ───────────────────────────────────
export async function rodarLeadNovoSemResposta(agora: Date = new Date()): Promise<ResultadoCronComercial> {
  return processarCadencia(CHAVE_LEAD_NOVO, async (_politica, numeroId) => {
    const conversas = await prisma.conversaWhatsApp.findMany({
      where: {
        numeroId,
        capturadaEm: { not: null },
        contato: { leadId: { not: null }, optOutEm: null },
      },
      include: { contato: { include: { lead: { include: { pais: true } } } } },
    });

    const candidatos: CandidatoCadencia[] = [];
    for (const conversa of conversas) {
      const lead = conversa.contato.lead;
      if (!lead || !conversa.capturadaEm) continue;

      // STOP-CONDITIONS (doc 27 §regras transversais): etapa avançou, lead respondeu
      // (inbound DEPOIS da âncora) ou vendedor assumiu (envio HUMANO manual).
      const [respostas, humanas] = await Promise.all([
        prisma.mensagemWhatsApp.count({
          where: { conversaId: conversa.id, direcao: "ENTRADA", criadoEm: { gt: conversa.capturadaEm } },
        }),
        prisma.mensagemWhatsApp.count({
          where: { conversaId: conversa.id, direcao: "SAIDA", origem: "HUMANO" },
        }),
      ]);
      candidatos.push({
        leadId: lead.id,
        contatoId: conversa.contatoId,
        nome: lead.nome,
        idioma: lead.pais?.idioma ?? "es",
        ancoraEm: conversa.capturadaEm,
        encerrada: !ETAPAS_FRIAS.includes(lead.etapa) || respostas > 0 || humanas > 0,
      });
    }
    return candidatos;
  }, agora);
}

// ── Cenário 2 (C2): pré-experimental (confirmação 24h/2h ANTES) ──────────────
export async function rodarPreExperimental(agora: Date = new Date()): Promise<ResultadoCronComercial> {
  return processarCadencia(CHAVE_PRE_EXPERIMENTAL, async (_politica, numeroId) => {
    const conversas = await prisma.conversaWhatsApp.findMany({
      where: {
        numeroId,
        contato: {
          optOutEm: null,
          lead: { etapa: EtapaLead.EXPERIMENTAL_AGENDADA, dataExperimental: { not: null } },
        },
      },
      include: { contato: { include: { lead: { include: { pais: true } } } } },
    });

    return conversas.flatMap((conversa) => {
      const lead = conversa.contato.lead;
      if (!lead?.dataExperimental) return [];
      // ENCERRADA quando a aula JÁ COMEÇOU: lembrete "2h antes" não pode chegar depois da
      // aula (o backlog do motor é certo para cobrança, errado para lembrete pré-evento).
      const jaComecou = agora >= lead.dataExperimental;
      return [{
        leadId: lead.id,
        contatoId: conversa.contatoId,
        nome: lead.nome,
        idioma: lead.pais?.idioma ?? "es",
        ancoraEm: lead.dataExperimental,
        encerrada: jaComecou,
      }];
    });
  }, agora);
}

// ── Cenário 3 (C2): recuperação de no-show ───────────────────────────────────
export async function rodarNoShow(agora: Date = new Date()): Promise<ResultadoCronComercial> {
  return processarCadencia(CHAVE_NO_SHOW, async (_politica, numeroId) => {
    const conversas = await prisma.conversaWhatsApp.findMany({
      where: {
        numeroId,
        contato: {
          optOutEm: null,
          lead: { etapa: EtapaLead.NO_SHOW, dataExperimental: { not: null } },
        },
      },
      include: { contato: { include: { lead: { include: { pais: true } } } } },
    });

    return conversas.flatMap((conversa) => {
      const lead = conversa.contato.lead;
      if (!lead?.dataExperimental) return [];
      // A etapa NO_SHOW é a própria condição (o check-in do professor a define). Sair dela
      // — remarcou, virou proposta, perdeu — encerra a recuperação no próximo tick.
      return [{
        leadId: lead.id,
        contatoId: conversa.contatoId,
        nome: lead.nome,
        idioma: lead.pais?.idioma ?? "es",
        ancoraEm: lead.dataExperimental,
        encerrada: false,
      }];
    });
  }, agora);
}

/**
 * Passos já cumpridos DESTA ocorrência (eventos `ReguaComercialEnviada
 * { chave, passo, ocorrencia }`). O filtro por `ocorrencia` é o que impede o histórico
 * eterno do lead de matar a cadência do ciclo novo (review PR #56).
 */
async function passosComerciaisFeitos(leadId: string, chave: string, ocorrencia: string): Promise<string[]> {
  const eventos = await prisma.evento.findMany({
    where: { agregadoTipo: "Lead", agregadoId: leadId, tipo: "ReguaComercialEnviada" },
    select: { payload: true },
  });
  const passos: string[] = [];
  for (const e of eventos) {
    const p = e.payload as { chave?: string; passo?: string; ocorrencia?: string } | null;
    if (!p || p.chave !== chave || typeof p.passo !== "string") continue;
    if (p.ocorrencia !== ocorrencia) continue;
    passos.push(p.passo);
  }
  return passos;
}
