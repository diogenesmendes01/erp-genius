"use server";

import { revalidatePath } from "next/cache";
import { Papel, StatusCobranca, type OrigemEnvio } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel, type Resultado } from "@/server/_shared";
import { montarReguaPorCobranca } from "@/server/cobrancas/consultas";
import { TEXTOS_FABRICA } from "@/server/cobrancas/fabrica";
import { carregarPoliticaRegua, type PoliticaCarregada } from "@/server/cobrancas/politica";
import type { ModeloWhatsapp } from "@/server/financeiro/schema";
import { despacharFila } from "./despachante";
import { enfileirarIntencaoCobranca } from "./fila";
import { garantirContato, resolverDestinoCobranca, INCLUDE_DESTINO } from "./identidade";
import { renderizarTemplate } from "./render";
import { LoteCobrancaSchema, type LoteCobrancaInput } from "./schema";

// Ações do braço API da fila de cobrança (doc 30 E2). Mesmos papéis que já operam a
// cobrança manual (financeiro/acoes.ts). NENHUMA envia direto: gravam INTENÇÃO e chamam o
// despachante — humano/lote passam pelos MESMOS guard-rails do cron (doc 26 §fila única).
// Papéis definitivos por papel×ação: gap 21 do doc 28 (matriz), pendente para a E3/E5.

const PAPEIS_ENVIO: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];

interface CanalPronto {
  politica: PoliticaCarregada;
  numeroId: string;
  templates: Map<string, { id: string; nome: string; corpo: string; idioma: string }>;
}

async function prepararCanal(): Promise<CanalPronto> {
  const politica = await carregarPoliticaRegua();
  if (!politica.numeroRemetenteId) {
    throw new ErroRegra("Configure o número remetente da política de cobrança (tela do canal, E3/E4).");
  }
  const numero = await prisma.numeroWhatsApp.findUnique({ where: { id: politica.numeroRemetenteId } });
  if (!numero || !numero.ativo) throw new ErroRegra("O número remetente da cobrança está inativo.");
  const templates = await prisma.templateWhatsApp.findMany({
    select: { id: true, nome: true, corpo: true, idioma: true },
  });
  return { politica, numeroId: numero.id, templates: new Map(templates.map((t) => [t.id, t])) };
}

/** Enfileira o degrau DEVIDO de uma cobrança. Lança ErroRegra com motivo claro quando não dá. */
async function enfileirarDegrauDevido(
  canal: CanalPronto,
  cobrancaId: string,
  origem: OrigemEnvio,
  autorId: string,
): Promise<{ passo: string; resultado: "criada" | "reaberta" | "ja_existente" }> {
  const cobranca = await prisma.cobranca.findUnique({ where: { id: cobrancaId }, include: INCLUDE_DESTINO });
  if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
  if (![StatusCobranca.PENDENTE, StatusCobranca.ATRASADO].includes(cobranca.status)) {
    throw new ErroRegra("Cobrança quitada/cancelada não entra na fila de envio.");
  }

  const hoje = new Date();
  const regua = await montarReguaPorCobranca(
    [{ id: cobranca.id, vencimento: cobranca.vencimento, acessoBloqueado: cobranca.matricula.acessoBloqueado }],
    hoje,
    canal.politica.degraus,
  );
  const calc = regua.get(cobranca.id);
  if (!calc || calc.estado !== "acao_devida" || !calc.passo) {
    throw new ErroRegra("Sem ação devida hoje para esta cobrança.");
  }

  const destino = resolverDestinoCobranca(cobranca);
  if (!destino) {
    throw new ErroRegra("Sem destino: cadastre o telefone do responsável financeiro (ou do aluno adulto).");
  }

  const tId = canal.politica.templateIdPorPasso.get(calc.passo) ?? null;
  const template =
    (tId ? canal.templates.get(tId) : undefined) ??
    [...canal.templates.values()].find((t) => t.nome === calc.template) ??
    null;
  const corpoTemplate = template?.corpo ?? TEXTOS_FABRICA[(calc.template ?? "dados") as ModeloWhatsapp];
  const valorDevido = Number(cobranca.saldo ?? cobranca.valorNegociado);
  const { corpo, variaveis } = renderizarTemplate(corpoTemplate, {
    nome: destino.nome,
    valor: valorDevido > 0 ? valorDevido : Number(cobranca.valorNegociado),
    moeda: cobranca.moeda,
    vencimento: cobranca.vencimento,
    idioma: template?.idioma ?? cobranca.matricula.aluno.pais?.idioma ?? "es",
  });

  const passo = calc.passo;
  const resultado = await prisma.$transaction(async (tx) => {
    const contato = await garantirContato(tx, {
      telefoneE164: destino.telefoneE164,
      alunoId: destino.responsavelId ? null : destino.alunoId,
      responsavelId: destino.responsavelId,
      nomeExibicao: destino.nome,
    });
    return enfileirarIntencaoCobranca(tx, {
      cobrancaId: cobranca.id,
      passo,
      numeroId: canal.numeroId,
      contatoId: contato.id,
      origem,
      corpoRenderizado: corpo,
      variaveis,
      templateId: template?.id ?? null,
      politicaId: canal.politica.id,
      autorId,
    });
  });
  return { passo, resultado };
}

export interface EnvioApiResultado {
  passo: string;
  /** Estado final da intenção após o despacho imediato. */
  status: string;
  motivo: string | null;
}

/** Botão da fila (doc 30 E2): enfileira o degrau devido e despacha na hora (origem HUMANO). */
export async function enfileirarCobrancaWhatsApp(cobrancaId: string): Promise<Resultado<EnvioApiResultado>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_ENVIO);
    const canal = await prepararCanal();
    const { passo } = await enfileirarDegrauDevido(canal, cobrancaId, "HUMANO", autor.id);

    await despacharFila();

    const intencao = await prisma.intencaoMensagem.findUnique({
      where: { cobrancaId_passo: { cobrancaId, passo } },
      select: { status: true, motivoFalha: true },
    });
    revalidatePath("/financeiro");
    return { passo, status: intencao?.status ?? "PENDENTE", motivo: intencao?.motivoFalha ?? null };
  });
}

export interface LoteResultado {
  enfileiradas: number;
  puladas: { cobrancaId: string; motivo: string }[];
  despachadas: number;
  simuladas: number;
  falhas: number;
}

/** Lote-com-aprovação (doc 24 §V2 → doc 26): humano seleciona e aprova; a fila dispara. */
export async function aprovarLoteCobranca(input: LoteCobrancaInput): Promise<Resultado<LoteResultado>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_ENVIO);
    const { cobrancaIds } = LoteCobrancaSchema.parse(input);
    const canal = await prepararCanal();

    let enfileiradas = 0;
    const puladas: { cobrancaId: string; motivo: string }[] = [];
    for (const id of cobrancaIds) {
      try {
        await enfileirarDegrauDevido(canal, id, "LOTE", autor.id);
        enfileiradas += 1;
      } catch (e) {
        // Item inválido não derruba o lote — volta com o motivo estampado (doc 26).
        puladas.push({ cobrancaId: id, motivo: e instanceof ErroRegra ? e.message : "Erro inesperado." });
      }
    }

    const despacho = await despacharFila();
    revalidatePath("/financeiro");
    return {
      enfileiradas,
      puladas,
      despachadas: despacho.despachadas,
      simuladas: despacho.simuladas,
      falhas: despacho.falhas,
    };
  });
}
