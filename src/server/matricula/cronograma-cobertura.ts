import { ErroRegra } from "@/server/_shared/sessao";
import { periodoMensalNaData, type RegraCobertura } from "./cobertura";

/** Expande a cobertura conferida da primeira mensalidade, nunca seu vencimento. */
export function expandirCoberturaMensal(
  contrato: { referenciaCobertura: "MES_CIVIL" | "CICLO_MATRICULA" | null; dataReferenciaCobertura: Date | null },
  primeira: { coberturaInicio: Date | null; coberturaFim: Date | null },
  quantidade: number,
) {
  if (!Number.isInteger(quantidade) || quantidade < 0) throw new ErroRegra("Quantidade de períodos inválida.");
  if (!contrato.referenciaCobertura || !primeira.coberturaInicio || !primeira.coberturaFim ||
    (contrato.referenciaCobertura === "CICLO_MATRICULA" && !contrato.dataReferenciaCobertura)) {
    throw new ErroRegra("Confira a referência contratual e a cobertura da primeira mensalidade antes de ativar.");
  }
  const civil = (data: Date) => data.toISOString().slice(0, 10);
  const regra: RegraCobertura = contrato.referenciaCobertura === "MES_CIVIL"
    ? { referencia: "MES_CIVIL" }
    : { referencia: "CICLO_MATRICULA", dataReferencia: civil(contrato.dataReferenciaCobertura!) };
  let periodo: ReturnType<typeof periodoMensalNaData>;
  try {
    periodo = periodoMensalNaData(regra, civil(primeira.coberturaInicio));
  } catch {
    throw new ErroRegra("A cobertura inicial não corresponde à referência contratual. Solicite conferência.");
  }
  if (periodo.inicio !== civil(primeira.coberturaInicio) || periodo.fim !== civil(primeira.coberturaFim)) {
    throw new ErroRegra("A cobertura inicial não corresponde a um período completo da referência contratual. Solicite conferência.");
  }
  const periodos: Array<{ coberturaInicio: Date; coberturaFim: Date }> = [];
  for (let i = 0; i < quantidade; i++) {
    const seguinte = new Date(`${periodo.fim}T00:00:00.000Z`);
    seguinte.setUTCDate(seguinte.getUTCDate() + 1);
    periodo = periodoMensalNaData(regra, civil(seguinte));
    periodos.push({ coberturaInicio: new Date(`${periodo.inicio}T00:00:00.000Z`), coberturaFim: new Date(`${periodo.fim}T00:00:00.000Z`) });
  }
  return periodos;
}
