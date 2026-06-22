import { Papel, EtapaLead, TipoAjuste, TipoCobranca } from "@prisma/client";
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

// ── Ajustes financeiros (doc 09 §Renegociação · doc 10 §2/§3) ────────────────
// Um ajuste é, por padrão, uma REDUÇÃO de valor (desconto, bolsa, renegociação,
// perdão). Aumentar o valor cobrado é uma operação distinta e intencional, só
// permitida no tipo ALTERACAO_VALOR ("alterar valor") — nunca como efeito
// colateral de um desconto.

/** Único tipo de ajuste que pode AUMENTAR o valor cobrado. */
export const TIPO_AJUSTE_PERMITE_AUMENTO: TipoAjuste = TipoAjuste.ALTERACAO_VALOR;

/** O `valorPara` representa um aumento sobre o valor atual? */
export function ehAumento(valorDe: number, valorPara: number): boolean {
  return valorPara > valorDe;
}

/** O aumento é permitido para este tipo de ajuste? (só ALTERACAO_VALOR aumenta.) */
export function aumentoPermitido(tipo: TipoAjuste): boolean {
  return tipo === TIPO_AJUSTE_PERMITE_AUMENTO;
}

/**
 * Valida a direção do ajuste em relação ao valor atual.
 * - Tipos de redução (desconto/bolsa/renegociação/perdão): `valorPara` <= `valorDe`.
 * - ALTERACAO_VALOR: livre (pode aumentar ou reduzir).
 * Retorna `null` quando válido, ou a mensagem de erro.
 */
export function validarDirecaoAjuste(
  tipo: TipoAjuste,
  valorDe: number,
  valorPara: number,
): string | null {
  if (ehAumento(valorDe, valorPara) && !aumentoPermitido(tipo)) {
    return "Este ajuste não pode aumentar o valor cobrado. Use 'Alterar valor' para aumentos.";
  }
  return null;
}

/** Percentual de desconto (0 quando não há redução ou valor base zero). */
export function descontoPercentual(valorDe: number, valorPara: number): number {
  if (valorDe <= 0) return 0;
  const pct = ((valorDe - valorPara) / valorDe) * 100;
  return pct > 0 ? pct : 0;
}

/**
 * Um pedido de desconto precisa de aprovação?
 * Regra (doc 10 §2): só Financeiro/Admin aplicam sem limite. Para os demais
 * (ex.: Vendedor), `limiteDescontoPct = null` NÃO significa ilimitado — significa
 * "sem autonomia" (limite efetivo 0): qualquer desconto vai para aprovação.
 * Aumentos (descontoPct <= 0) nunca exigem aprovação por limite.
 */
export function precisaAprovacaoDesconto(params: {
  podeAplicarSemLimite: boolean;
  limiteDescontoPct: number | null;
  descontoPct: number;
}): boolean {
  const { podeAplicarSemLimite, limiteDescontoPct, descontoPct } = params;
  if (podeAplicarSemLimite) return false;
  if (descontoPct <= 0) return false;
  const limiteEfetivo = limiteDescontoPct ?? 0; // null = sem autonomia, não ilimitado
  return descontoPct > limiteEfetivo;
}

// ── Máquina de estados do lead (transições MANUAIS) ─────────────────────────
// Doc 10 §1 define quem dispara cada transição. O arraste no Kanban (moverEtapa)
// só cobre o trecho que é responsabilidade do VENDEDOR e nunca pode pular para
// etapas que dependem de evento (Exp. Realizada, Proposta, Aguardando Matrícula,
// Matriculado) nem para as saídas paralelas (Perdido/No-show — fluxo próprio).
//
// Cada chave é a etapa ATUAL; o conjunto são os destinos manuais permitidos a
// partir dela. Avanço passo-a-passo no funil + correções (voltar uma casa /
// reabrir um lead encerrado pelo evento). Tudo o que não estiver no mapa é salto
// inválido e é recusado no servidor, mesmo que o client envie.
const TRANSICOES_MANUAIS: Partial<Record<EtapaLead, EtapaLead[]>> = {
  [EtapaLead.NOVO]: [EtapaLead.EM_ATENDIMENTO],
  [EtapaLead.EM_ATENDIMENTO]: [EtapaLead.NOVO, EtapaLead.QUALIFICADO],
  [EtapaLead.QUALIFICADO]: [EtapaLead.EM_ATENDIMENTO, EtapaLead.EXPERIMENTAL_AGENDADA],
  // Reagendar a experimental volta a este passo; antes da experimental ainda
  // dá para corrigir a qualificação.
  [EtapaLead.EXPERIMENTAL_AGENDADA]: [EtapaLead.QUALIFICADO],
  // Etapas geradas por evento permitem RETOMAR o trabalho manual do vendedor
  // (ex.: pós no-show/experimental, reagendar; pós proposta, voltar a qualificar),
  // mas nunca avançar para uma etapa de evento manualmente.
  [EtapaLead.EXPERIMENTAL_REALIZADA]: [EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_AGENDADA],
  [EtapaLead.NO_SHOW]: [EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_AGENDADA],
  [EtapaLead.PROPOSTA]: [EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_AGENDADA],
  [EtapaLead.AGUARDANDO_MATRICULA]: [EtapaLead.PROPOSTA],
};

/**
 * Uma transição MANUAL de `origem` → `destino` é permitida?
 *
 * Regras (puras, sem I/O — fonte única e testável):
 *  - destino precisa ser uma etapa manual (`ETAPAS_MANUAIS`);
 *  - `origem === destino` é no-op (permitido; o chamador trata como nada a fazer);
 *  - caso contrário, o par precisa existir na máquina de estados.
 *
 * Saltos para etapas de evento (Proposta, Aguardando Matrícula, etc.) ou para as
 * saídas paralelas (Perdido/Matriculado) são SEMPRE recusados aqui.
 */
export function transicaoManualPermitida(origem: EtapaLead, destino: EtapaLead): boolean {
  if (origem === destino) return true;
  if (!ehEtapaManual(destino)) return false;
  return TRANSICOES_MANUAIS[origem]?.includes(destino) ?? false;
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
