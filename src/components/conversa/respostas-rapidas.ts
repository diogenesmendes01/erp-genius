export interface RespostaDoCompositor { id: string; atalho: string; titulo: string; corpo: string }

export function respostasDoAtalho(texto: string, respostas: readonly RespostaDoCompositor[]): RespostaDoCompositor[] {
  if (!texto.startsWith("/") || /\s/.test(texto)) return [];
  const q = texto.toLowerCase();
  return respostas.filter((r) => r.atalho.toLowerCase().startsWith(q)).slice(0, 8);
}

export function aplicarVariaveisResposta(corpo: string, valores: { nome?: string | null; responsavel?: string | null; curso?: string | null }): string {
  return corpo.replace(/\{(nome|responsavel|curso)\}/g, (m, k: "nome" | "responsavel" | "curso") => valores[k]?.trim() || m);
}
