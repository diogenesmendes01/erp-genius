export const JANELA_FALHAS_MS = 15 * 60 * 1000;
export const MAX_FALHAS = 5;

const falhasPorEmail = new Map<string, number[]>();

function falhasRecentes(email: string, agora: number): number[] {
  const recentes = (falhasPorEmail.get(email) ?? []).filter((t) => agora - t < JANELA_FALHAS_MS);
  if (recentes.length > 0) falhasPorEmail.set(email, recentes);
  else falhasPorEmail.delete(email);
  return recentes;
}

export function loginBloqueado(email: string, agora: number = Date.now()): boolean {
  return falhasRecentes(email, agora).length >= MAX_FALHAS;
}

export function registrarFalhaLogin(email: string, agora: number = Date.now()): void {
  falhasPorEmail.set(email, [...falhasRecentes(email, agora), agora]);
}

export function limparFalhasLogin(email: string): void {
  falhasPorEmail.delete(email);
}
