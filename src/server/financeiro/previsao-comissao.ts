import { z } from "zod";
import { dataCivilInstitucional } from "@/server/operacao/fuso";

// PREVISÃO DE PAGAMENTO DA COMISSÃO (D11, decisão do dono de 20/10/2026; C50 da #170, docs/42 L2259): o dia X do
// mês seguinte à competência, em data civil no fuso da escola. A competência é a do painel de comissões:
// `aprovadaEm`, ou `criadoEm` quando não houve aprovação. X fica em ConfigFinanceiro.diaPrevisaoPagamentoComissao.
//
// Calculada na LEITURA, não gravada em `Comissao.dataPrevistaPagamento`: o valor depende só da competência (que não
// muda) e de X (que muda). Gravar exigiria recalcular as comissões em aberto a cada troca de X e preencher as
// antigas por migration; lendo, a troca de X vale na hora para todas, e o campo segue sem uso, como sempre esteve.

export const DIA_PREVISAO_COMISSAO_PADRAO = 10;
export const DIA_PREVISAO_COMISSAO_MIN = 1;
/** Até 28: todo mês tem o dia, inclusive fevereiro. */
export const DIA_PREVISAO_COMISSAO_MAX = 28;

export const DiaPrevisaoComissaoSchema = z.number().int().min(DIA_PREVISAO_COMISSAO_MIN).max(DIA_PREVISAO_COMISSAO_MAX);

/** Data civil (AAAA-MM-DD) prevista para o pagamento: dia `dia` do mês seguinte ao mês civil da competência. */
export function previsaoPagamentoComissao(competencia: Date, fuso: string, dia: number): string {
  const d = DiaPrevisaoComissaoSchema.parse(dia);
  const [ano, mes] = dataCivilInstitucional(competencia, fuso).split("-").map(Number);
  const [anoSeg, mesSeg] = mes === 12 ? [ano + 1, 1] : [ano, mes + 1];
  return `${anoSeg}-${String(mesSeg).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
