export function impedimentoPreparacaoMensal(regime: string | null | undefined) {
  if (!regime) return "Prepare a contratação mensal antes de transcrever as condições.";
  if (regime !== "MENSALIDADE") return "Esta contratação não é mensal.";
  return null;
}
