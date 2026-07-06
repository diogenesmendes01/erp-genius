// Rate-limit do login (janela deslizante em memória, por e-mail): após MAX_FALHAS
// tentativas erradas dentro da janela, novas tentativas são recusadas sem consultar o
// banco — mesma resposta de credencial inválida (não revela que a conta está travada).
// Por processo: suficiente para o deploy atual (nó único); multi-instância pede um
// armazém compartilhado (ex.: Redis) — reavaliar na Fase 1+.
// `agora` é injetável para testes determinísticos (mesmo padrão de regras.ts).

export const JANELA_FALHAS_MS = 15 * 60 * 1000;
export const MAX_FALHAS = 5;

const falhasPorEmail = new Map<string, number[]>();

function falhasRecentes(email: string, agora: number): number[] {
  const recentes = (falhasPorEmail.get(email) ?? []).filter((t) => agora - t < JANELA_FALHAS_MS);
  if (recentes.length > 0) falhasPorEmail.set(email, recentes);
  else falhasPorEmail.delete(email);
  return recentes;
}

/** O e-mail está bloqueado por excesso de falhas na janela? */
export function loginBloqueado(email: string, agora: number = Date.now()): boolean {
  return falhasRecentes(email, agora).length >= MAX_FALHAS;
}

/** Registra uma tentativa de login que falhou (senha errada / conta inexistente ou inativa). */
export function registrarFalhaLogin(email: string, agora: number = Date.now()): void {
  falhasPorEmail.set(email, [...falhasRecentes(email, agora), agora]);
}

/** Login bem-sucedido zera o contador do e-mail. */
export function limparFalhasLogin(email: string): void {
  falhasPorEmail.delete(email);
}
