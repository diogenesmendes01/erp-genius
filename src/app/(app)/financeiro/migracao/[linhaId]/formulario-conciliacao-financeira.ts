export type CampoComplementoFinanceiro = "tipo" | "valor" | "moeda" | "situacao" | "dataPagamento" | "forma" | "pagadorId";
export type DetalheComplementoFinanceiro = { motivo: string; evidencia: string };
export const camposComplementoFinanceiro: CampoComplementoFinanceiro[] = ["tipo", "valor", "moeda", "situacao", "dataPagamento", "forma", "pagadorId"];

export function dataHistoricaComOffset(dataLocal: string, offset: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dataLocal) || !/^[+-](?:0\d|1\d|2[0-3]):[0-5]\d$/.test(offset)) return null;
  const civil = new Date(dataLocal + ":00Z");
  if (!Number.isFinite(civil.getTime()) || civil.toISOString().slice(0, 16) !== dataLocal) return null;
  const valor = `${dataLocal}:00${offset}`;
  return Number.isNaN(new Date(valor).getTime()) ? null : valor;
}

export function montarComplementoEstruturado(detalhes: Record<CampoComplementoFinanceiro, DetalheComplementoFinanceiro>, valores: Record<CampoComplementoFinanceiro, string>) {
  return { itens: camposComplementoFinanceiro.flatMap((campo) => {
    const detalhe = detalhes[campo];
    if (!detalhe.motivo.trim() && !detalhe.evidencia.trim()) return [];
    if (!detalhe.motivo.trim() || detalhe.motivo.trim().length < 10 || !detalhe.evidencia.trim()) throw new Error(`Complemento de ${campo} exige motivo e evidência.`);
    return [{ campo, valorProposto: valores[campo], motivo: detalhe.motivo.trim(), evidencia: { referencia: detalhe.evidencia.trim() } }];
  }) };
}