import type { ErrosDeCampos } from "@/components/Campo";

// Ativação do portal do aluno (docs/42 /portal-aluno/ativar #1 e #2; docs/43 §6 item 8).
//
// Token: o segredo chega no fragmento da URL (`#token=…`, que não vai para log HTTP) e sai da barra assim que
// a tela abre. Antes ele ficava só em memória: um F5 ou um "voltar" o perdia e o aluno só descobria depois de
// digitar a senha. Agora a tela guarda uma cópia no sessionStorage — só desta aba, apagada quando a aba fecha
// — e a relê quando o fragmento já não está lá. A cópia sai quando o link é consumido ou recusado.

/** Chave da cópia do segredo no sessionStorage da aba. */
export const CHAVE_TOKEN_ATIVACAO = "portal-aluno:token-ativacao";

/** O pedaço do Storage que a tela usa (o teste passa um falso). */
export type ArmazenamentoDaAba = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** O sessionStorage da aba, ou null quando o navegador o bloqueia (modo privado restrito, política do site). */
export function armazenamentoDaAba(): ArmazenamentoDaAba | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** O segredo do fragmento (`#token=…`), ou null. */
export function tokenDoFragmento(fragmento: string): string | null {
  const token = new URLSearchParams(fragmento.replace(/^#/, "")).get("token");
  return token ? token : null;
}

/**
 * O segredo de ativação desta aba: o do fragmento (que passa a ser a cópia guardada — um link mais novo
 * substitui o anterior) ou, sem fragmento, a cópia guardada. Storage bloqueado não impede a ativação com o
 * fragmento; só um recarregamento é que perde o link.
 */
export function capturarTokenAtivacao(fragmento: string, armazenamento: ArmazenamentoDaAba | null): string | null {
  const doFragmento = tokenDoFragmento(fragmento);
  if (doFragmento) {
    try { armazenamento?.setItem(CHAVE_TOKEN_ATIVACAO, doFragmento); } catch { /* sem cópia: o F5 perde o link */ }
    return doFragmento;
  }
  try {
    return armazenamento?.getItem(CHAVE_TOKEN_ATIVACAO) || null;
  } catch {
    return null;
  }
}

/** Apaga a cópia do segredo (link consumido ou recusado). */
export function esquecerTokenAtivacao(armazenamento: ArmazenamentoDaAba | null): void {
  try { armazenamento?.removeItem(CHAVE_TOKEN_ATIVACAO); } catch { /* nada a apagar */ }
}

// Senha: as mesmas regras do servidor (src/server/portal-aluno/identidade.ts): de 12 caracteres a 72 bytes.

export const MINIMO_CARACTERES_SENHA = 12;
export const MAXIMO_BYTES_SENHA = 72;

export type CampoSenha = "senha" | "confirmacao";

/** Bytes da senha em UTF-8 (letra acentuada e símbolo ocupam mais de um). */
export const bytesDaSenha = (senha: string) => new TextEncoder().encode(senha).length;

/**
 * Erros dos dois campos, na ordem da tela. A confirmação só é comparada quando a senha em si é válida, para
 * a pessoa resolver um problema de cada vez; enquanto as duas não coincidem, o envio fica bloqueado.
 */
export function validarSenhas(senha: string, confirmacao: string): ErrosDeCampos<CampoSenha> {
  if (senha.length < MINIMO_CARACTERES_SENHA) return { senha: `A senha precisa de pelo menos ${MINIMO_CARACTERES_SENHA} caracteres.` };
  if (bytesDaSenha(senha) > MAXIMO_BYTES_SENHA) {
    return { senha: `A senha passou do limite de ${MAXIMO_BYTES_SENHA} bytes. Letras com acento e símbolos ocupam mais espaço; encurte a senha.` };
  }
  if (confirmacao !== senha) return { confirmacao: "As duas senhas não coincidem. Digite a mesma senha nos dois campos." };
  return {};
}
