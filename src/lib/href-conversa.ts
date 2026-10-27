export function hrefConversa(atendimentoId: string, opcoes?: { agendar?: boolean }): string {
  return "/inbox?c=" + encodeURIComponent(atendimentoId) + (opcoes?.agendar ? "&agendar=1" : "");
}
