/**
 * Prazo da sessão em milissegundos desde a época, a partir do `exp` do JWT (em segundos). Null quando o token
 * não traz um `exp` numérico. O callback `session` do NextAuth (lib/auth) o expõe como `session.expiraEm`, e o
 * SSE do Inbox fecha a conexão quando ele vence (B9, #201 C6). Módulo à parte para o lib/auth não carregar os
 * guards de sessão.
 */
export function prazoDoToken(exp: unknown): number | null {
  return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
}
