import type { ErrosDeCampos } from "@/components/Campo";

export const CHAVE_TOKEN_ATIVACAO = "portal-aluno:token-ativacao";

export type ArmazenamentoDaAba = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function armazenamentoDaAba(): ArmazenamentoDaAba | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function tokenDoFragmento(fragmento: string): string | null {
  const token = new URLSearchParams(fragmento.replace(/^#/, "")).get("token");
  return token ? token : null;
}

export function capturarTokenAtivacao(fragmento: string, armazenamento: ArmazenamentoDaAba | null): string | null {
  const doFragmento = tokenDoFragmento(fragmento);
  if (doFragmento) {
    try { armazenamento?.setItem(CHAVE_TOKEN_ATIVACAO, doFragmento); } catch {  }
    return doFragmento;
  }
  try {
    return armazenamento?.getItem(CHAVE_TOKEN_ATIVACAO) || null;
  } catch {
    return null;
  }
}

export function esquecerTokenAtivacao(armazenamento: ArmazenamentoDaAba | null): void {
  try { armazenamento?.removeItem(CHAVE_TOKEN_ATIVACAO); } catch {  }
}

export const MINIMO_CARACTERES_SENHA = 12;
export const MAXIMO_BYTES_SENHA = 72;

export type CampoSenha = "senha" | "confirmacao";

export const bytesDaSenha = (senha: string) => new TextEncoder().encode(senha).length;

export function validarSenhas(senha: string, confirmacao: string): ErrosDeCampos<CampoSenha> {
  if (senha.length < MINIMO_CARACTERES_SENHA) return { senha: `A senha precisa de pelo menos ${MINIMO_CARACTERES_SENHA} caracteres.` };
  if (bytesDaSenha(senha) > MAXIMO_BYTES_SENHA) {
    return { senha: `A senha passou do limite de ${MAXIMO_BYTES_SENHA} bytes. Letras com acento e símbolos ocupam mais espaço; encurte a senha.` };
  }
  if (confirmacao !== senha) return { confirmacao: "As duas senhas não coincidem. Digite a mesma senha nos dois campos." };
  return {};
}
