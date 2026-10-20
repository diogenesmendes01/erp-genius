import type { Resultado } from "@/server/_shared/resultado";

// Chamadas do navegador às rotas públicas do portal do aluno (docs/43 §6 item 8), no formato de uma server
// action: recusa do servidor vira `{ ok: false, erro }` e falha de transporte (rede, servidor fora) LANÇA —
// é o useAcaoCliente que a transforma em "resultado não confirmado". Nada aqui envia e-mail: as rotas só
// registram o pedido (o envio é da fila da Secretaria).

/** A rota recusou o link (usado, expirado, revogado ou de outro contato): a tela some com o formulário. */
export const ERRO_LINK_INDISPONIVEL = "Este link não está mais disponível. Ele pode ter sido usado, ter expirado ou ter sido substituído por um mais novo.";
export const ERRO_ATIVACAO_RECUSADA = "Não foi possível confirmar o acesso agora. Tente de novo em alguns minutos; se continuar, procure a Secretaria.";
/** A rota recusou a senha (400 com `campo: "senha"`): o link continua valendo e o formulário fica. */
export const ERRO_SENHA_RECUSADA = "A senha não foi aceita: ela precisa ter de 12 caracteres a 72 bytes. Ajuste e tente de novo; o link continua valendo.";
export const ERRO_RECUPERACAO_RECUSADA = "Não foi possível registrar o pedido agora. Tente de novo em alguns minutos; se continuar, procure a Secretaria.";

/** O que a ativação concluiu: sessão aberta (convite ou recuperação) ou só o novo e-mail validado. */
export type ConclusaoAtivacao = "SESSAO" | "EMAIL_VALIDADO";

const CABECALHOS_JSON = { "Content-Type": "application/json" };

/** Define a senha com o segredo do link (POST /api/portal-aluno/token). */
export async function definirSenhaPortalAluno(token: string, senha: string): Promise<Resultado<{ conclusao: ConclusaoAtivacao }>> {
  const resposta = await fetch("/api/portal-aluno/token", { method: "POST", headers: CABECALHOS_JSON, body: JSON.stringify({ token, senha }) });
  // 422 é a resposta única da rota para link que não serve mais (ver api/portal-aluno/token/route.ts).
  if (resposta.status === 422) return { ok: false, erro: ERRO_LINK_INDISPONIVEL };
  // 400 com o campo: a senha foi recusada pelo schema da rota, antes de o link ser consumido.
  if (resposta.status === 400) {
    const corpo = (await resposta.json().catch(() => null)) as { campo?: unknown } | null;
    return { ok: false, erro: corpo?.campo === "senha" ? ERRO_SENHA_RECUSADA : ERRO_ATIVACAO_RECUSADA };
  }
  if (!resposta.ok) return { ok: false, erro: ERRO_ATIVACAO_RECUSADA };
  // Corpo ilegível com 200: a senha pode ter sido gravada — lança, e a tela diz que o resultado é incerto.
  const corpo = (await resposta.json()) as { situacao?: unknown };
  return { ok: true, dado: { conclusao: corpo.situacao === "EMAIL_VALIDADO" ? "EMAIL_VALIDADO" : "SESSAO" } };
}

/**
 * Pede a recuperação de acesso (POST /api/portal-aluno/recuperacao). A rota responde igual havendo ou não
 * conta para o e-mail; aqui só se distingue o pedido aceito do recusado (origem bloqueada, servidor fora).
 */
export async function pedirRecuperacaoPortalAluno(email: string): Promise<Resultado> {
  const resposta = await fetch("/api/portal-aluno/recuperacao", { method: "POST", headers: CABECALHOS_JSON, body: JSON.stringify({ email }) });
  return resposta.ok ? { ok: true } : { ok: false, erro: ERRO_RECUPERACAO_RECUSADA };
}
