import { z } from "zod";
import { dataCivilInstitucional } from "@/server/operacao/fuso";

export const DIA_PREVISAO_COMISSAO_PADRAO = 10;
export const DIA_PREVISAO_COMISSAO_MIN = 1;
export const DIA_PREVISAO_COMISSAO_MAX = 28;

export const DiaPrevisaoComissaoSchema = z.number().int().min(DIA_PREVISAO_COMISSAO_MIN).max(DIA_PREVISAO_COMISSAO_MAX);

export function previsaoPagamentoComissao(competencia: Date, fuso: string, dia: number): string {
  const d = DiaPrevisaoComissaoSchema.parse(dia);
  const [ano, mes] = dataCivilInstitucional(competencia, fuso).split("-").map(Number);
  const [anoSeg, mesSeg] = mes === 12 ? [ano + 1, 1] : [ano, mes + 1];
  return `${anoSeg}-${String(mesSeg).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
