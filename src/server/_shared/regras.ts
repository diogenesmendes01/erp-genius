import { Papel, EtapaLead } from "@prisma/client";
import { ETAPAS_MANUAIS } from "@/server/comercial/schema";

// Regras de negócio PURAS (sem I/O) — fonte única e testável (ver docs/14).

/**
 * Quem pode atribuir um lead a OUTRO vendedor? (doc 09 §Atribuição de leads)
 * Vendedor só pode ser dono de leads que ele mesmo cria — qualquer dono enviado
 * por ele é ignorado pelo servidor. Apenas gerente/admin atribuem a terceiros.
 */
export function podeAtribuirOutroDono(papeis: Papel[]): boolean {
  return papeis.includes(Papel.GERENTE_COMERCIAL) || papeis.includes(Papel.ADMINISTRADOR);
}

/**
 * Define o dono de um lead recém-criado a partir do papel do autor.
 * - Vendedor sem privilégio de atribuição: SEMPRE ele mesmo (ignora o id enviado).
 * - Gerente/admin: usa o vendedor escolhido, ou nenhum (atribuir depois).
 * O backend é a fonte da regra, independentemente do formulário.
 */
export function resolverDonoLead(
  autor: { id: string; papeis: Papel[] },
  vendedorDonoIdSolicitado?: string | null,
): string | null {
  const ehVendedor = autor.papeis.includes(Papel.VENDEDOR);
  if (!podeAtribuirOutroDono(autor.papeis)) {
    return ehVendedor ? autor.id : null;
  }
  return vendedorDonoIdSolicitado || null;
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

/**
 * Vagas disponíveis numa turma (issue #1): capacidade menos alocações ATIVAS.
 * `alocacoesAtivas` DEVE vir de uma contagem filtrada por `ativa = true` — alocações
 * inativas (histórico/troca de turma) não ocupam vaga. Nunca negativo.
 */
export function vagasDisponiveis(capacidade: number, alocacoesAtivas: number): number {
  return Math.max(0, capacidade - alocacoesAtivas);
}

/** Há vaga na turma? (atalho sobre vagasDisponiveis.) */
export function temVaga(capacidade: number, alocacoesAtivas: number): boolean {
  return vagasDisponiveis(capacidade, alocacoesAtivas) > 0;
}

/**
 * Diff antes→depois de campos para payload de Evento (auditoria enxuta): inclui só o que mudou.
 * Mesmo princípio usado em editarAluno. Devolve mapas `antes`/`depois` só com as chaves alteradas.
 */
export function diffCampos<T extends Record<string, unknown>>(
  atual: T,
  novo: T,
): { antes: Partial<T>; depois: Partial<T> } {
  const antes: Partial<T> = {};
  const depois: Partial<T> = {};
  for (const k of Object.keys(novo) as (keyof T)[]) {
    if (atual[k] !== novo[k]) {
      antes[k] = atual[k];
      depois[k] = novo[k];
    }
  }
  return { antes, depois };
}

/**
 * Aplica uma baixa (parcial ou total) a uma cobrança ACUMULANDO o recebido (issue #1).
 * Nunca sobrescreve: soma a baixa atual ao total já recebido — assim uma 2ª baixa não
 * reduz o total. Devolve o acumulado, o saldo (nunca negativo) e se quitou.
 */
export function aplicarBaixa(
  valorNegociado: number,
  recebidoAnterior: number | null,
  valorRecebido: number,
): { recebidoTotal: number; saldo: number; quitada: boolean } {
  const recebidoTotal = (recebidoAnterior ?? 0) + valorRecebido;
  const saldoBruto = valorNegociado - recebidoTotal;
  return {
    recebidoTotal,
    saldo: saldoBruto > 0 ? saldoBruto : 0,
    quitada: saldoBruto <= 0,
  };
}
