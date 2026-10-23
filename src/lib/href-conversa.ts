/** Só monta um link relativo; o produtor e o destino continuam autorizando o atendimento. */
export function hrefConversa(atendimentoId: string, opcoes?: { agendar?: boolean }): string {
  return "/inbox?c=" + encodeURIComponent(atendimentoId) + (opcoes?.agendar ? "&agendar=1" : "");
}
