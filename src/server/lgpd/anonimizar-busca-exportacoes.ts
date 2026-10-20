import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { registrarEvento } from "../_shared/evento";

// LGPD (#165, decisão D5 do dono): até a #119 (25/09/2026) o evento `DadosExportados` guardava em
// `payload.filtros.busca` o TEXTO digitado na busca da listagem exportada (nome, e-mail ou telefone de
// alguém). Desde a #119 a trilha grava só `{ aplicada: true, caracteres: n }` (`filtrosRegistrados` em
// src/app/api/exportacoes/[tipo]/route.ts). Esta rotina leva os eventos antigos para esse mesmo formato:
// o texto sai, ficam o fato de que houve busca e o tamanho dela. Nada mais do payload muda.
//
// Só entra a linha que é `DadosExportados`, foi criada antes do corte e tem a busca como TEXTO
// (`jsonb_typeof = 'string'`). Depois de anonimizada, a busca vira objeto e a linha sai do critério:
// rodar de novo não muda nada (idempotente).
//
// Operado por scripts/anonimizar-busca-exportacoes.ts (simulação por padrão; `--aplicar` grava).

/**
 * Corte padrão: fim do dia 25/09/2026 em Brasília (26/09 00:00 -03:00). A #119 entrou no `main` às 11:03
 * de 25/09 e o deploy veio depois, então exportações do próprio dia 25 ainda podem ter o texto. Os
 * eventos já gravados no formato novo não são tocados, porque o critério também exige a busca em texto.
 */
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
  /** Linhas que estavam no critério no início da execução. */
  candidatos: number;
  /** Linhas efetivamente anonimizadas (0 na simulação). */
  afetados: number;
  lotes: number;
  /** `criadoEm` da linha mais antiga e da mais nova do conjunto (candidatos na simulação; afetados na aplicação). */
  intervalo: { de: string | null; ate: string | null };
  /** Evento de auditoria da execução (só na aplicação). */
  eventoId: string | null;
}

interface Resumo { total: bigint | number; de: Date | null; ate: Date | null }

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const menor = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a < b ? a : b);
const maior = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b);

/** O critério, num lugar só: o mesmo filtro conta, trava e atualiza. */
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
      // Uma transação por lote: um lote grande não estoura o timeout da transação interativa e uma falha
      // no meio não desfaz os lotes já gravados (rodar de novo só pega o que sobrou).
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

  // Um evento por execução, gravado no fim (também quando um lote falhou, para a trilha mostrar o que foi
  // feito). Sem dado pessoal: contagens, corte e intervalo de datas. O texto removido não é copiado.
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
  }));
  if (falha !== null) throw falha;
  return { modo: "aplicacao", corte: corte.toISOString(), candidatos, afetados, lotes, intervalo: { de: iso(de), ate: iso(ate) }, eventoId: evento.id };
}
