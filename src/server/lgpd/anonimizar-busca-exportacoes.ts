import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { registrarEvento } from "../_shared/evento";

export const CORTE_PADRAO = new Date("2026-09-26T03:00:00.000Z");
export const LOTE_PADRAO = 500;
export const TIPO_EVENTO_ANONIMIZACAO = "BuscaExportacaoAnonimizada";

export interface OpcoesAnonimizacao {
  aplicar: boolean;
  corte?: Date;
  lote?: number;
}

export interface ResultadoAnonimizacao {
  modo: "simulacao" | "aplicacao";
  corte: string;
  candidatos: number;
  afetados: number;
  lotes: number;
  intervalo: { de: string | null; ate: string | null };
  eventoId: string | null;
}

interface Resumo { total: bigint | number; de: Date | null; ate: Date | null }

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const menor = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a < b ? a : b);
const maior = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b);

const criterio = (corte: Date) => Prisma.sql`
  "tipo" = 'DadosExportados'
  AND "criadoEm" < ${corte}
  AND jsonb_typeof("payload" #> '{filtros,busca}') = 'string'`;

export async function anonimizarBuscaExportacoes(prisma: PrismaClient, opcoes: OpcoesAnonimizacao): Promise<ResultadoAnonimizacao> {
  const corte = opcoes.corte ?? CORTE_PADRAO;
  const lote = opcoes.lote ?? LOTE_PADRAO;
  if (Number.isNaN(corte.getTime())) throw new Error("Data de corte inválida.");
  if (!Number.isInteger(lote) || lote < 1 || lote > 10_000) throw new Error("O lote deve ser um inteiro entre 1 e 10000.");

  const [inicial] = await prisma.$queryRaw<Resumo[]>`
    SELECT count(*) AS total, min("criadoEm") AS de, max("criadoEm") AS ate FROM "Evento" WHERE ${criterio(corte)}`;
  const candidatos = Number(inicial.total);

  if (!opcoes.aplicar) {
    return { modo: "simulacao", corte: corte.toISOString(), candidatos, afetados: 0, lotes: 0, intervalo: { de: iso(inicial.de), ate: iso(inicial.ate) }, eventoId: null };
  }

  let afetados = 0, lotes = 0, de: Date | null = null, ate: Date | null = null, falha: unknown = null;
  try {
    for (;;) {
      const feitos = await prisma.$transaction(async (tx) => tx.$queryRaw<{ criadoEm: Date }[]>`
        UPDATE "Evento" AS e
        SET "payload" = jsonb_set(e."payload", '{filtros,busca}',
          jsonb_build_object('aplicada', true, 'caracteres', char_length(e."payload" #>> '{filtros,busca}')))
        WHERE e."id" IN (
          SELECT "id" FROM "Evento" WHERE ${criterio(corte)}
          ORDER BY "criadoEm", "id" LIMIT ${lote} FOR UPDATE
        )
        RETURNING e."criadoEm"`);
      if (!feitos.length) break;
      lotes += 1;
      afetados += feitos.length;
      for (const f of feitos) { de = menor(de, f.criadoEm); ate = maior(ate, f.criadoEm); }
    }
  } catch (e) {
    falha = e;
  }

  const evento = await prisma.$transaction(async (tx) => registrarEvento(tx, {
    tipo: TIPO_EVENTO_ANONIMIZACAO, agregadoTipo: "Exportacao", agregadoId: randomUUID(), autorId: null,
    payload: {
      motivo: "lgpd_minimizacao_busca_exportacao",
      decisao: "D5 (#165)",
      eventoAlvo: "DadosExportados",
      campo: "payload.filtros.busca",
      corte: corte.toISOString(),
      candidatos,
      afetados,
      lotes,
      intervalo: { de: iso(de), ate: iso(ate) },
      concluida: falha === null,
    },
  })).catch((erroRegistro: unknown) => {
    if (falha === null) throw erroRegistro;
    throw new AggregateError(
      [falha, erroRegistro],
      "Um lote falhou e o evento de auditoria da execução também não foi gravado.",
      { cause: falha },
    );
  });
  if (falha !== null) throw falha;
  return { modo: "aplicacao", corte: corte.toISOString(), candidatos, afetados, lotes, intervalo: { de: iso(de), ate: iso(ate) }, eventoId: evento.id };
}
