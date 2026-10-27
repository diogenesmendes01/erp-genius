import { Papel, EtapaLead, TipoAjuste, TipoCobranca } from "@prisma/client";
import { ETAPAS_MANUAIS } from "@/server/comercial/schema";
import { ErroRegra } from "./sessao";

export interface ChavePreco {
  paisId: string;
  produtoId: string;
  modalidadeId: string;
  tipoCobranca: TipoCobranca;
}

export function chavePrecoReferencia(p: ChavePreco): string {
  return [p.paisId, p.produtoId, p.modalidadeId, p.tipoCobranca].join("|");
}

export function mesmaChavePreco(a: ChavePreco, b: ChavePreco): boolean {
  return chavePrecoReferencia(a) === chavePrecoReferencia(b);
}

export function irmaosParaInativar(
  alvo: ChavePreco & { id: string },
  candidatosAtivos: ReadonlyArray<ChavePreco & { id: string }>,
): string[] {
  return candidatosAtivos
    .filter((c) => c.id !== alvo.id && mesmaChavePreco(c, alvo))
    .map((c) => c.id);
}

export function podeAtribuirOutroDono(papeis: Papel[]): boolean {
  return papeis.includes(Papel.GERENTE_COMERCIAL) || papeis.includes(Papel.ADMINISTRADOR);
}

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

export function calcularComissao(taxa: number, percentual: number): number {
  return (taxa * percentual) / 100;
}

export function vencimentoMensalidade(
  dia: number,
  offset: number,
  agora: Date = new Date(),
): { data: Date; competencia: string } {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) throw new Error("Dia de vencimento deve estar entre 1 e 31.");
  if (!Number.isInteger(offset) || !Number.isFinite(agora.getTime())) throw new Error("Referência de vencimento inválida.");
  const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + offset + 1, 0).getDate();
  const d = new Date(agora.getFullYear(), agora.getMonth() + offset, Math.min(dia, ultimoDia));
  const competencia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { data: d, competencia };
}

export function vencimentoPrimeiraMensalidade(
  diaVencimento: number,
  dataInicioAula: Date | null | undefined,
  fallback: Date = new Date(),
): { data: Date; competencia: string } {
  const base = dataInicioAula ?? fallback;
  const mais30 = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 30);
  return vencimentoMensalidade(diaVencimento, 0, mais30);
}

export function ehEtapaManual(etapa: EtapaLead): boolean {
  return ETAPAS_MANUAIS.includes(etapa);
}

export interface CobrancaParaAlocar {
  id: string;
  valorNegociado: number;
}

export interface AlocacaoCobranca {
  id: string;
  valorRecebido: number;
  saldo: number;
  quitada: boolean;
}

export interface ResultadoAlocacao {
  alocacoes: AlocacaoCobranca[];
  totalDevido: number;
  troco: number;
  quitouTudo: boolean;
}

export function alocarPagamento(
  valorRecebido: number,
  cobrancas: CobrancaParaAlocar[],
): ResultadoAlocacao {
  let restante = Math.max(0, valorRecebido);
  let totalDevido = 0;
  const alocacoes: AlocacaoCobranca[] = cobrancas.map((c) => {
    totalDevido += c.valorNegociado;
    const aplicado = Math.min(restante, c.valorNegociado);
    restante -= aplicado;
    const saldo = c.valorNegociado - aplicado;
    return { id: c.id, valorRecebido: aplicado, saldo, quitada: saldo <= 0 };
  });
  return {
    alocacoes,
    totalDevido,
    troco: restante,
    quitouTudo: alocacoes.every((a) => a.quitada),
  };
}

export function podeCheckinExperimental(etapa: EtapaLead): boolean {
  return etapa === EtapaLead.EXPERIMENTAL_AGENDADA;
}

export function professorNoEscopoExperimental(
  professorAtribuidoId: string | null | undefined,
  professorId: string,
): boolean {
  return !!professorAtribuidoId && professorAtribuidoId === professorId;
}

export const TIPOS_PRECO_OBRIGATORIO: TipoCobranca[] = [
  TipoCobranca.MATRICULA,
  TipoCobranca.MENSALIDADE,
];

export interface PrecoRefAtivo {
  tipoCobranca: TipoCobranca;
  valor: number;
}

export interface AvaliacaoPrecoReferencia {
  ausente: boolean;
  tiposAusentes: TipoCobranca[];
}

export function avaliarPrecoReferencia(
  precos: PrecoRefAtivo[],
  obrigatorios: TipoCobranca[] = TIPOS_PRECO_OBRIGATORIO,
): AvaliacaoPrecoReferencia {
  const tiposAusentes = obrigatorios.filter(
    (tipo) => !precos.some((p) => p.tipoCobranca === tipo),
  );
  return { ausente: tiposAusentes.length > 0, tiposAusentes };
}

export interface ResultadoPagamento {
  recebidoTotal: number;
  saldo: number;
  quitada: boolean;
  excedente: number;
}

export function acumularPagamento(
  jaRecebido: number,
  valorNegociado: number,
  valorAtual: number,
  permitirExcedente = false,
): ResultadoPagamento {
  if (valorAtual <= 0) {
    throw new ErroRegra("O valor recebido deve ser maior que zero.");
  }
  const recebidoTotal = jaRecebido + valorAtual;
  const excedente = Math.max(0, recebidoTotal - valorNegociado);
  if (excedente > 0 && !permitirExcedente) {
    throw new ErroRegra(
      "Valor recebido excede o saldo devido. Marque o excedente como crédito para continuar.",
    );
  }
  const saldo = Math.max(0, valorNegociado - recebidoTotal);
  return { recebidoTotal, saldo, quitada: saldo <= 0, excedente };
}

export const TIPO_AJUSTE_PERMITE_AUMENTO: TipoAjuste = TipoAjuste.ALTERACAO_VALOR;

export function ehAumento(valorDe: number, valorPara: number): boolean {
  return valorPara > valorDe;
}

export function aumentoPermitido(tipo: TipoAjuste): boolean {
  return tipo === TIPO_AJUSTE_PERMITE_AUMENTO;
}

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

export function descontoPercentual(valorDe: number, valorPara: number): number {
  if (valorDe <= 0) return 0;
  const pct = ((valorDe - valorPara) / valorDe) * 100;
  return pct > 0 ? pct : 0;
}

export function precisaAprovacaoDesconto(params: {
  podeAplicarSemLimite: boolean;
  limiteDescontoPct: number | null;
  descontoPct: number;
}): boolean {
  const { podeAplicarSemLimite, limiteDescontoPct, descontoPct } = params;
  if (podeAplicarSemLimite) return false;
  if (descontoPct <= 0) return false;
  const limiteEfetivo = limiteDescontoPct ?? 0;
  return descontoPct > limiteEfetivo;
}

const TRANSICOES_MANUAIS: Partial<Record<EtapaLead, EtapaLead[]>> = {
  [EtapaLead.NOVO]: [EtapaLead.EM_ATENDIMENTO],
  [EtapaLead.EM_ATENDIMENTO]: [EtapaLead.NOVO, EtapaLead.QUALIFICADO],
  [EtapaLead.QUALIFICADO]: [EtapaLead.EM_ATENDIMENTO, EtapaLead.EXPERIMENTAL_AGENDADA],
  [EtapaLead.EXPERIMENTAL_AGENDADA]: [EtapaLead.QUALIFICADO],
  [EtapaLead.EXPERIMENTAL_REALIZADA]: [EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_AGENDADA],
  [EtapaLead.NO_SHOW]: [EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_AGENDADA],
  [EtapaLead.PROPOSTA]: [EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_AGENDADA],
  [EtapaLead.AGUARDANDO_MATRICULA]: [EtapaLead.PROPOSTA],
};

export function transicaoManualPermitida(origem: EtapaLead, destino: EtapaLead): boolean {
  if (origem === destino) return true;
  if (!ehEtapaManual(destino)) return false;
  return TRANSICOES_MANUAIS[origem]?.includes(destino) ?? false;
}

export function destinosManuaisPermitidos(origem: EtapaLead): EtapaLead[] {
  return ETAPAS_MANUAIS.filter((destino) => destino !== origem && transicaoManualPermitida(origem, destino));
}

export function vagasDisponiveis(capacidade: number, alocacoesAtivas: number): number {
  return Math.max(0, capacidade - alocacoesAtivas);
}

export function temVaga(capacidade: number, alocacoesAtivas: number): boolean {
  return vagasDisponiveis(capacidade, alocacoesAtivas) > 0;
}

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
