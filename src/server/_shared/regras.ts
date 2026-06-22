import { EtapaLead, TipoCobranca } from "@prisma/client";
import { ETAPAS_MANUAIS } from "@/server/comercial/schema";

// Regras de negócio PURAS (sem I/O) — fonte única e testável (ver docs/14).

/**
 * Chave de negócio de um Preço de Referência (doc 15, P5):
 * País + Produto + Modalidade + TipoCobrança identificam a combinação que só
 * pode ter UM preço ativo. Usada para encontrar/inativar "irmãos" ao criar ou
 * reativar um preço, e como base da proteção lógica no banco.
 */
export interface ChavePreco {
  paisId: string;
  produtoId: string;
  modalidadeId: string;
  tipoCobranca: TipoCobranca;
}

/** Serializa a chave de negócio do preço de forma determinística (p/ comparar/agrupar). */
export function chavePrecoReferencia(p: ChavePreco): string {
  return [p.paisId, p.produtoId, p.modalidadeId, p.tipoCobranca].join("|");
}

/** Dois preços pertencem à mesma combinação de negócio (mesmos irmãos)? */
export function mesmaChavePreco(a: ChavePreco, b: ChavePreco): boolean {
  return chavePrecoReferencia(a) === chavePrecoReferencia(b);
}

/**
 * Ao reativar o preço `alvo`, quais preços ativos devem ser inativados para
 * preservar o invariante "no máximo um ativo por combinação".
 * Retorna os ids dos irmãos da MESMA chave de negócio, exceto o próprio alvo.
 * Função pura: a ação só passa os candidatos já carregados do banco.
 */
export function irmaosParaInativar(
  alvo: ChavePreco & { id: string },
  candidatosAtivos: ReadonlyArray<ChavePreco & { id: string }>,
): string[] {
  return candidatosAtivos
    .filter((c) => c.id !== alvo.id && mesmaChavePreco(c, alvo))
    .map((c) => c.id);
}

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
