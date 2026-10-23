/** Prazo máximo de vida de uma conexão: ao fim, o servidor fecha e o EventSource reconecta (e reautentica). */
export const VIDA_MAX_MS = 15 * 60_000;
/** De quanto em quanto tempo o usuário é relido do banco (ativo e com papel do Inbox). */
export const REVALIDAR_MS = 60_000;
/** Intervalo de reconexão sugerido ao navegador (campo `retry:` do SSE). */
export const RETRY_MS = 3_000;
