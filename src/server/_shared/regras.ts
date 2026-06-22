import { EtapaLead, TipoCobranca } from "@prisma/client";
import { ETAPAS_MANUAIS } from "@/server/comercial/schema";

// Regras de negócio PURAS (sem I/O) — fonte única e testável (ver docs/14).

/** Comissão = % da taxa de matrícula (doc 10 §3). */
export function calcularComissao(taxa: number, percentual: number): number {
  return (taxa * percentual) / 100;
}

/**
 * Vencimento da mensalidade no dia escolhido, no mês atual + offset (0 = este mês).
 * `agora` injetável para testes determinísticos.
 */
export function vencimentoMensalidade(
  dia: number,
  offset: number,
  agora: Date = new Date(),
): { data: Date; competencia: string } {
  const d = new Date(agora.getFullYear(), agora.getMonth() + offset, dia);
  const competencia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { data: d, competencia };
}

/** O usuário pode mover o lead para esta etapa manualmente? (Perdido/Matriculado têm fluxo próprio.) */
export function ehEtapaManual(etapa: EtapaLead): boolean {
  return ETAPAS_MANUAIS.includes(etapa);
}

// ---- Matrícula × preço de referência (issue #22) ----

/** Tipos de cobrança que TODA matrícula precisa precificar (taxa + 1ª mensalidade). */
export const TIPOS_PRECO_OBRIGATORIO: TipoCobranca[] = [
  TipoCobranca.MATRICULA,
  TipoCobranca.MENSALIDADE,
];

/** Preço de referência ativo (forma mínima consumida pela regra). */
export interface PrecoRefAtivo {
  tipoCobranca: TipoCobranca;
  valor: number;
}

export interface AvaliacaoPrecoReferencia {
  /** Falta ao menos um preço ativo (taxa OU mensalidade) para a combinação. */
  ausente: boolean;
  /** Tipos obrigatórios sem preço de referência ativo. */
  tiposAusentes: TipoCobranca[];
}

/**
 * Avalia a cobertura da matriz de preços para a combinação país × produto.
 * Recebe APENAS os preços já filtrados por `ativo + paisId + produtoId` (I/O fica na ação).
 * Decisão da issue #22: matrícula sem preço ativo é PERMITIDA, mas marcada como
 * exceção auditável — então a ação só precisa saber se há ausência e quais tipos.
 */
export function avaliarPrecoReferencia(
  precos: PrecoRefAtivo[],
  obrigatorios: TipoCobranca[] = TIPOS_PRECO_OBRIGATORIO,
): AvaliacaoPrecoReferencia {
  const tiposAusentes = obrigatorios.filter(
    (tipo) => !precos.some((p) => p.tipoCobranca === tipo),
  );
  return { ausente: tiposAusentes.length > 0, tiposAusentes };
}
