import { ZodError, defaultErrorMap, type ZodIssue } from "zod";
import { ErroAutenticacao, ErroPermissao, ErroRegra } from "./sessao";

export type Resultado<T = void> =
  | { ok: true; dado?: T }
  | { ok: false; erro: string };

function mensagemPadraoZod(issue: ZodIssue) {
  if (/^(Required|Expected |Invalid |Unrecognized key|String must|Number must|Array must|Too (small|big))/.test(issue.message)) return true;
  try { return defaultErrorMap(issue, { defaultError: "", data: undefined }).message === issue.message; } catch { return false; }
}

export async function executarAcao<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    const dado = await fn();
    return { ok: true, dado };
  } catch (e) {
    if (e instanceof ZodError) {
      const issue = e.errors[0];
      // #530: mensagens padrão do Zod ("Required", "Expected ...", "Invalid ...") não vão para a UI.
      if (!issue || mensagemPadraoZod(issue)) {
        console.warn("dados-invalidos", { caminhos: e.errors.map(i => i.path.join(".")) });
        return { ok: false, erro: "Dados inválidos." };
      }
      return { ok: false, erro: issue.message };
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
