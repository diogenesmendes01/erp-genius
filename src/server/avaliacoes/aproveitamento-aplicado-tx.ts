import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { NotasLancamentoSchema } from "./lancamento-schema";
import { HABILIDADES } from "./calculo";
import {
  FonteOficialEquivalenciaSchema,
  type FonteOficialEquivalencia,
} from "./equivalencia-transferencia";

const id = z.string().trim().min(1).max(100);
const habilidade = z.enum(HABILIDADES);
const mapeamentoSchema = z.object({
  referenciaFonteId: id,
  codigoAvaliacaoDestino: id,
  habilidadeDestino: habilidade,
}).strict();

const snapshotAplicadoSchema = z.object({
  contexto: z.object({
    matriculaId: id,
    alocacaoOrigemId: id,
    turmaOrigemId: id,
    turmaDestinoId: id,
    regraOrigemId: id,
    regraDestinoId: id,
    nivelOrigemId: id,
    nivelDestinoId: id,
  }).passthrough(),
  fontesOficiais: z.array(FonteOficialEquivalenciaSchema),
  projecao: z.object({
    itens: z.array(z.object({
      codigoAvaliacao: id,
      habilidade,
    }).passthrough()),
  }).passthrough(),
}).passthrough();

export type ContextoAproveitamentoAplicado = {
  matriculaId: string;
  alocacaoDestinoId: string;
  turmaDestinoId: string;
  nivelDestinoId: string;
  regraDestinoId: string;
};

type ContextoOrigemAplicacao = {
  matriculaId: string;
  alocacaoId: string;
  turmaId: string;
  nivelId: string;
  regraId: string;
};

export type ItemAproveitamentoAplicado = {
  codigoAvaliacao: string;
  habilidade: z.infer<typeof habilidade>;
  situacao: "APROVEITADO" | "PENDENTE_SEM_FONTE" | "PENDENTE_FONTE_ALTERADA" | "LOCAL_OFICIAL_PREVALECE";
  notaParaConsolidado: string | null;
  fonte: FonteOficialEquivalencia | null;
  referenciaFonteAplicadaId: string | null;
};

export type AproveitamentoAplicado = {
  aplicacaoId: string;
  aplicacaoHash: string;
  itens: ItemAproveitamentoAplicado[];
  fontesAproveitadas: FonteOficialEquivalencia[];
  pendencias: Array<Pick<ItemAproveitamentoAplicado, "codigoAvaliacao" | "habilidade" | "situacao" | "referenciaFonteAplicadaId">>;
  conflitosLocais: Array<Pick<ItemAproveitamentoAplicado, "codigoAvaliacao" | "habilidade" | "referenciaFonteAplicadaId">>;
};

export function chaveRequisitoAproveitamento(codigoAvaliacao: string, habilidadeDestino: string) {
  return codigoAvaliacao + "\u0000" + habilidadeDestino;
}

function fonteAproveitada(args: {
  fonteAtual: FonteOficialEquivalencia;
  contexto: ContextoAproveitamentoAplicado;
  aplicacao: { id: string; aplicacaoHash: string; alocacaoOrigemId: string; alocacaoDestinoId: string };
  codigoAvaliacaoDestino: string;
  habilidadeDestino: z.infer<typeof habilidade>;
}): FonteOficialEquivalencia {
  const { fonteAtual, contexto, aplicacao, codigoAvaliacaoDestino, habilidadeDestino } = args;
  const fonteHash = createHash("sha256").update(JSON.stringify([
    "APROVEITAMENTO", aplicacao.id, aplicacao.aplicacaoHash,
    aplicacao.alocacaoOrigemId, aplicacao.alocacaoDestinoId,
    fonteAtual.referenciaId, fonteAtual.fonteHash,
    contexto.matriculaId, contexto.alocacaoDestinoId, contexto.turmaDestinoId,
    contexto.nivelDestinoId, contexto.regraDestinoId,
    codigoAvaliacaoDestino, habilidadeDestino,
  ])).digest("hex");
  // O código da avaliação admite 100 caracteres; não o concatene ao ID, que
  // também aceita 100. A referência é curta, determinística e os campos da
  // tupla continuam armazenados separadamente para auditoria.
  const referenciaId = "aproveitamento:" + createHash("sha256").update(JSON.stringify([
    aplicacao.id, codigoAvaliacaoDestino, habilidadeDestino,
  ])).digest("hex");
  return {
    referenciaId,
    matriculaId: contexto.matriculaId,
    alocacaoId: contexto.alocacaoDestinoId,
    turmaId: contexto.turmaDestinoId,
    nivelId: contexto.nivelDestinoId,
    regraId: contexto.regraDestinoId,
    tipoFonte: "APROVEITAMENTO",
    escopoFonte: "REQUISITO_DESTINO",
    codigoAvaliacao: codigoAvaliacaoDestino,
    habilidade: habilidadeDestino,
    nota: fonteAtual.nota,
    oficial: true,
    aplicacaoId: aplicacao.id,
    aplicacaoHash: aplicacao.aplicacaoHash,
    alocacaoOrigemAplicacaoId: aplicacao.alocacaoOrigemId,
    alocacaoDestinoAplicacaoId: aplicacao.alocacaoDestinoId,
    referenciaFonteAplicadaId: fonteAtual.referenciaId,
    fonteAplicadaHash: fonteAtual.fonteHash,
    fonteHash,
  };
}

async function chavesComLancamentoLocalOficial(
  tx: Prisma.TransactionClient,
  contexto: ContextoAproveitamentoAplicado,
) {
  const registros = await tx.registroAvaliacaoMatricula.findMany({ where: {
    matriculaId: contexto.matriculaId,
    alocacaoId: contexto.alocacaoDestinoId,
    turmaId: contexto.turmaDestinoId,
    regraId: contexto.regraDestinoId,
  }, select: {
    codigoAvaliacao: true,
    versoes: {
      where: { decisao: { aprovada: true } },
      orderBy: [{ versao: "desc" }, { id: "desc" }],
      take: 1,
      select: {
        notas: true,
        propostasCorrecao: {
          where: { decisao: { aprovada: true } },
          orderBy: [{ versao: "desc" }, { id: "desc" }],
          take: 1,
          select: { notas: true },
        },
      },
    },
  } });
  const chaves = new Set<string>();
  for (const registro of registros) {
    const versao = registro.versoes[0];
    if (!versao) continue;
    const notas = NotasLancamentoSchema.parse(versao.propostasCorrecao[0]?.notas ?? versao.notas);
    for (const nota of notas) if (nota.nota !== null) chaves.add(chaveRequisitoAproveitamento(registro.codigoAvaliacao, nota.habilidade));
  }
  return chaves;
}

export function projetarAproveitamentoAplicado(entrada: {
  contexto: ContextoAproveitamentoAplicado;
  aplicacao: { id: string; aplicacaoHash: string; alocacaoOrigemId: string; alocacaoDestinoId: string };
  requisitos: Array<{ codigoAvaliacao: string; habilidade: z.infer<typeof habilidade> }>;
  mapeamentos: z.infer<typeof mapeamentoSchema>[];
  fontesSnapshot: FonteOficialEquivalencia[];
  fontesAtuais: FonteOficialEquivalencia[];
  chavesLocais: ReadonlySet<string>;
}): Omit<AproveitamentoAplicado, "aplicacaoId" | "aplicacaoHash"> {
  const requisitoPorChave = new Map<string, { codigoAvaliacao: string; habilidade: z.infer<typeof habilidade> }>();
  for (const item of entrada.requisitos) {
    const itemChave = chaveRequisitoAproveitamento(item.codigoAvaliacao, item.habilidade);
    if (requisitoPorChave.has(itemChave)) throw new ErroRegra("O snapshot aplicado contém requisito de destino duplicado.");
    requisitoPorChave.set(itemChave, item);
  }
  const mapaPorRequisito = new Map<string, z.infer<typeof mapeamentoSchema>>();
  for (const mapeamento of entrada.mapeamentos) {
    const itemChave = chaveRequisitoAproveitamento(mapeamento.codigoAvaliacaoDestino, mapeamento.habilidadeDestino);
    if (!requisitoPorChave.has(itemChave) || mapaPorRequisito.has(itemChave)) {
      throw new ErroRegra("O mapa aplicado não corresponde aos requisitos conferidos.");
    }
    mapaPorRequisito.set(itemChave, mapeamento);
  }
  const fonteSnapshotPorId = new Map(entrada.fontesSnapshot.map((fonte) => [fonte.referenciaId, fonte]));
  if (fonteSnapshotPorId.size !== entrada.fontesSnapshot.length) throw new ErroRegra("O snapshot aplicado contém fonte duplicada.");
  const fonteAtualPorId = new Map(entrada.fontesAtuais.map((fonte) => [fonte.referenciaId, fonte]));
  const itens: ItemAproveitamentoAplicado[] = [];
  for (const [itemChave, requisito] of requisitoPorChave) {
    const mapeamento = mapaPorRequisito.get(itemChave);
    // Um lançamento oficial do vínculo de destino sempre prevalece. A fonte
    // aplicada pode até estar ausente ou superada, mas não cria pendência nem
    // uma segunda fonte para esse requisito localmente resolvido.
    if (entrada.chavesLocais.has(itemChave)) {
      itens.push({ ...requisito, situacao: "LOCAL_OFICIAL_PREVALECE", notaParaConsolidado: null, fonte: null,
        referenciaFonteAplicadaId: mapeamento?.referenciaFonteId ?? null });
      continue;
    }
    if (!mapeamento) {
      itens.push({ ...requisito, situacao: "PENDENTE_SEM_FONTE", notaParaConsolidado: null, fonte: null, referenciaFonteAplicadaId: null });
      continue;
    }
    const fonteSnapshot = fonteSnapshotPorId.get(mapeamento.referenciaFonteId);
    const fonteAtual = fonteAtualPorId.get(mapeamento.referenciaFonteId);
    if (!fonteSnapshot || !fonteAtual || fonteSnapshot.fonteHash !== fonteAtual.fonteHash) {
      itens.push({ ...requisito, situacao: "PENDENTE_FONTE_ALTERADA", notaParaConsolidado: null, fonte: null,
        referenciaFonteAplicadaId: mapeamento.referenciaFonteId });
      continue;
    }
    if (fonteAtual.habilidade !== requisito.habilidade) {
      throw new ErroRegra("A fonte reaproveitada mudou de habilidade.");
    }
    const fonte = fonteAproveitada({ fonteAtual, contexto: entrada.contexto, aplicacao: entrada.aplicacao,
      codigoAvaliacaoDestino: requisito.codigoAvaliacao, habilidadeDestino: requisito.habilidade });
    itens.push({ ...requisito, situacao: "APROVEITADO", notaParaConsolidado: fonte.nota, fonte,
      referenciaFonteAplicadaId: mapeamento.referenciaFonteId });
  }
  return {
    itens,
    fontesAproveitadas: itens.flatMap((item) => item.situacao === "APROVEITADO" && item.fonte ? [item.fonte] : []),
    pendencias: itens.filter((item) => item.situacao.startsWith("PENDENTE")).map((item) => ({
      codigoAvaliacao: item.codigoAvaliacao, habilidade: item.habilidade, situacao: item.situacao,
      referenciaFonteAplicadaId: item.referenciaFonteAplicadaId,
    })),
    conflitosLocais: itens.filter((item) => item.situacao === "LOCAL_OFICIAL_PREVALECE").map((item) => ({
      codigoAvaliacao: item.codigoAvaliacao, habilidade: item.habilidade,
      referenciaFonteAplicadaId: item.referenciaFonteAplicadaId,
    })),
  };
}

/**
 * Lê o fato imutável de uma equivalência já aplicada. A cadeia da fonte é
 * recarregada pelo callback; qualquer divergência vira pendência explícita.
 * Não escolhe entre aproveitamento e lançamento local: o local tem precedência
 * e aparece em `conflitosLocais` para o consolidado registrar a situação.
 */
export async function carregarAproveitamentoAplicadoTx(
  tx: Prisma.TransactionClient,
  contexto: ContextoAproveitamentoAplicado,
  carregarFontesOrigem: (origem: ContextoOrigemAplicacao) => Promise<FonteOficialEquivalencia[]>,
): Promise<AproveitamentoAplicado | null> {
  const aplicacao = await tx.aplicacaoEquivalenciaAvaliacao.findUnique({ where: {
    alocacaoDestinoId: contexto.alocacaoDestinoId,
  }, select: {
    id: true, aplicacaoHash: true, matriculaId: true,
    alocacaoOrigemId: true, alocacaoDestinoId: true,
    turmaOrigemId: true, turmaDestinoId: true,
    regraOrigemId: true, regraDestinoId: true,
    mapeamentosAplicados: true, snapshotAplicado: true,
  } });
  if (!aplicacao) return null;
  if (aplicacao.matriculaId !== contexto.matriculaId
    || aplicacao.alocacaoDestinoId !== contexto.alocacaoDestinoId
    || aplicacao.turmaDestinoId !== contexto.turmaDestinoId
    || aplicacao.regraDestinoId !== contexto.regraDestinoId) {
    throw new ErroRegra("A aplicação de equivalência não pertence ao contexto acadêmico consultado.");
  }
  const snapshot = snapshotAplicadoSchema.parse(aplicacao.snapshotAplicado);
  const origem = snapshot.contexto;
  if (origem.matriculaId !== aplicacao.matriculaId
    || origem.alocacaoOrigemId !== aplicacao.alocacaoOrigemId
    || origem.turmaOrigemId !== aplicacao.turmaOrigemId
    || origem.turmaDestinoId !== aplicacao.turmaDestinoId
    || origem.regraOrigemId !== aplicacao.regraOrigemId
    || origem.regraDestinoId !== aplicacao.regraDestinoId
    || origem.nivelDestinoId !== contexto.nivelDestinoId) {
    throw new ErroRegra("O snapshot da equivalência aplicada está inconsistente.");
  }
  const mapeamentos = z.array(mapeamentoSchema).parse(aplicacao.mapeamentosAplicados);
  const fontesAtuais = await carregarFontesOrigem({
    matriculaId: aplicacao.matriculaId,
    alocacaoId: aplicacao.alocacaoOrigemId,
    turmaId: aplicacao.turmaOrigemId,
    nivelId: origem.nivelOrigemId,
    regraId: aplicacao.regraOrigemId,
  });
  const locais = await chavesComLancamentoLocalOficial(tx, contexto);
  const projecao = projetarAproveitamentoAplicado({
    contexto,
    aplicacao,
    requisitos: snapshot.projecao.itens,
    mapeamentos,
    fontesSnapshot: snapshot.fontesOficiais,
    fontesAtuais,
    chavesLocais: locais,
  });
  return {
    aplicacaoId: aplicacao.id,
    aplicacaoHash: aplicacao.aplicacaoHash,
    ...projecao,
  };
}
