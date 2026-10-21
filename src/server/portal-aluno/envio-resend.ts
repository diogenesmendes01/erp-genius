import { createHash } from "crypto";
import { z } from "zod";
import { enviarEmailResend, ErroConfiguracaoEmail } from "@/server/email/resend";
import { despacharSolicitacaoPortalAlunoInterna } from "./identidade";
import { caminhoAtivacaoPortalAluno } from "./politica";

type AmbienteEnvioPortal = {
  EMAIL_PORTAL_ENVIO_ENABLED?: string;
  RESEND_API_KEY?: string;
  EMAIL_INSTITUCIONAL_REMETENTE?: string;
  PORTAL_ALUNO_URL_PUBLICA?: string;
};
type Opcoes = {
  ambiente?: AmbienteEnvioPortal;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
};

/** Entrada interna do worker; não é Server Action nem endpoint público.
 * A rotina de identidade faz claim/revalidação antes de fornecer o token. */
export async function despacharAcessoPortalResend(solicitacaoId: string, opcoes: Opcoes = {}) {
  const ambiente = opcoes.ambiente ?? process.env as AmbienteEnvioPortal;
  if (ambiente.EMAIL_PORTAL_ENVIO_ENABLED !== "true") throw new ErroConfiguracaoEmail();
  if (!solicitacaoId || solicitacaoId.length > 200 || !ambiente.RESEND_API_KEY?.trim() ||
      /[\r\n]/.test(ambiente.RESEND_API_KEY) ||
      !z.string().email().safeParse(ambiente.EMAIL_INSTITUCIONAL_REMETENTE?.trim()).success) throw new ErroConfiguracaoEmail();
  let base: URL;
  try { base = new URL(ambiente.PORTAL_ALUNO_URL_PUBLICA ?? ""); } catch { throw new ErroConfiguracaoEmail(); }
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new ErroConfiguracaoEmail();
  const chaveIdempotencia = `portal-acesso/${createHash("sha256").update(solicitacaoId).digest("hex")}`;
  return despacharSolicitacaoPortalAlunoInterna(solicitacaoId, async mensagem => {
    const titulo = mensagem.finalidade === "CONVITE" ? "Seu acesso ao portal da escola"
      : mensagem.finalidade === "RECUPERACAO" ? "Recuperação de acesso ao portal" : "Confirmação de endereço do portal";
    // O caminho é reconstruído da fonte interna, nunca de host da requisição.
    const link = new URL(caminhoAtivacaoPortalAluno(mensagem.token), base).href;
    const resultado = await enviarEmailResend({
      destinatario: mensagem.destinatario, assunto: titulo, chaveIdempotencia,
      texto: `${titulo}\n\nPara continuar, abra seu link individual:\n${link}\n\nEste link tem uso único e validade limitada. Não compartilhe. Se você não solicitou este acesso, procure a Secretaria.`,
    }, { ambiente, fetch: opcoes.fetch });
    if (resultado.situacao !== "ACEITO") throw new Error("Aceitação do envio não confirmada.");
    return { provedor: "RESEND" as const, provedorId: resultado.provedorId };
  });
}
