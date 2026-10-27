import { ZodError } from "zod";
import { ErroAutenticacao, ErroPermissao, ErroRegra } from "./sessao";

export type Resultado<T = void> =
  | { ok: true; dado?: T }
  | { ok: false; erro: string };

export async function executarAcao<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    const dado = await fn();
    return { ok: true, dado };
  } catch (e) {
    if (e instanceof ZodError) {
      return { ok: false, erro: e.errors[0]?.message ?? "Dados inválidos." };
    }
    if (
      e instanceof ErroPermissao ||
      e instanceof ErroAutenticacao ||
      e instanceof ErroRegra
    ) {
      return { ok: false, erro: e.message };
    }
    console.error(e);
    return { ok: false, erro: "Erro inesperado. Tente novamente." };
  }
}
