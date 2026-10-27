import type { Resultado } from "@/server/_shared/resultado";
import { MAXIMO_BYTES_SENHA, MINIMO_CARACTERES_SENHA } from "./ativar/ativacao";

export const ERRO_LINK_INDISPONIVEL = "Este link não está mais disponível. Ele pode ter sido usado, ter expirado ou ter sido substituído por um mais novo.";
export const ERRO_ATIVACAO_RECUSADA = "Não foi possível confirmar o acesso agora. Tente de novo em alguns minutos; se continuar, procure a Secretaria.";
export const ERRO_SENHA_RECUSADA = `A senha não foi aceita: ela precisa ter de ${MINIMO_CARACTERES_SENHA} caracteres a ${MAXIMO_BYTES_SENHA} bytes. Ajuste e tente de novo; o link continua valendo.`;
export const ERRO_RECUPERACAO_RECUSADA = "Não foi possível registrar o pedido agora. Tente de novo em alguns minutos; se continuar, procure a Secretaria.";

export type ConclusaoAtivacao = "SESSAO" | "EMAIL_VALIDADO";

const CABECALHOS_JSON = { "Content-Type": "application/json" };

export async function definirSenhaPortalAluno(token: string, senha: string): Promise<Resultado<{ conclusao: ConclusaoAtivacao }>> {
  const resposta = await fetch("/api/portal-aluno/token", { method: "POST", headers: CABECALHOS_JSON, body: JSON.stringify({ token, senha }) });
  if (resposta.status === 422) return { ok: false, erro: ERRO_LINK_INDISPONIVEL };
  if (resposta.status === 400) {
    const corpo = (await resposta.json().catch(() => null)) as { campo?: unknown } | null;
    return { ok: false, erro: corpo?.campo === "senha" ? ERRO_SENHA_RECUSADA : ERRO_ATIVACAO_RECUSADA };
  }
  if (!resposta.ok) return { ok: false, erro: ERRO_ATIVACAO_RECUSADA };
  const corpo = (await resposta.json()) as { situacao?: unknown };
  return { ok: true, dado: { conclusao: corpo.situacao === "EMAIL_VALIDADO" ? "EMAIL_VALIDADO" : "SESSAO" } };
}

export async function pedirRecuperacaoPortalAluno(email: string): Promise<Resultado> {
  const resposta = await fetch("/api/portal-aluno/recuperacao", { method: "POST", headers: CABECALHOS_JSON, body: JSON.stringify({ email }) });
  return resposta.ok ? { ok: true } : { ok: false, erro: ERRO_RECUPERACAO_RECUSADA };
}
