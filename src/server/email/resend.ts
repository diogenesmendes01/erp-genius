import { z } from "zod";

const mensagemSchema = z.object({
  destinatario: z.string().email().max(320),
  assunto: z.string().min(1).max(998).refine(v => !/[\r\n]/.test(v)),
  texto: z.string().min(1).max(100_000),
  chaveIdempotencia: z.string().min(1).max(256).regex(/^[A-Za-z0-9_./:-]+$/),
}).strict();
export type MensagemResend = z.input<typeof mensagemSchema>;
export type ResultadoResend =
  | { situacao: "ACEITO"; provedorId: string }
  | { situacao: "RECUSADO" | "INCERTO" };
type AmbienteEmail = { RESEND_API_KEY?: string; EMAIL_INSTITUCIONAL_REMETENTE?: string };
type FetchEmail = (url: string, init: RequestInit) => Promise<Response>;
export class ErroConfiguracaoEmail extends Error {
  constructor() { super("Envio institucional indisponível."); }
}

/** Transporte interno. ACEITO significa aceitação pelo provedor, nunca entrega.
 * A fila precisa gravar a tentativa antes do envio e manter a idempotência
 * durável: a janela da chave no Resend é limitada a 24 horas. Não há retry aqui. */
export async function enviarEmailResend(mensagem: MensagemResend, opcoes: {
  ambiente?: AmbienteEmail; fetch?: FetchEmail; signal?: AbortSignal; timeoutMs?: number;
} = {}): Promise<ResultadoResend> {
  const dados = mensagemSchema.safeParse(mensagem);
  const ambiente = opcoes.ambiente ?? process.env as AmbienteEmail;
  const remetente = ambiente.EMAIL_INSTITUCIONAL_REMETENTE?.trim();
  const chave = ambiente.RESEND_API_KEY?.trim();
  const prazo = opcoes.timeoutMs ?? 10_000;
  if (!dados.success || !remetente || !z.string().email().safeParse(remetente).success ||
      !chave || /[\r\n]/.test(chave) || !Number.isSafeInteger(prazo) || prazo < 1) throw new ErroConfiguracaoEmail();
  if (opcoes.signal?.aborted) return { situacao: "RECUSADO" };
  const controle = new AbortController();
  const abortar = () => controle.abort();
  opcoes.signal?.addEventListener("abort", abortar, { once: true });
  const timer = setTimeout(abortar, prazo);
  let remover: (() => void) | undefined;
  const interrompida = new Promise<never>((_, reject) => {
    const cancelar = () => reject(new Error("interrompido"));
    controle.signal.addEventListener("abort", cancelar, { once: true });
    remover = () => controle.signal.removeEventListener("abort", cancelar);
  });
  let resposta: Response | undefined;
  try {
    const operacao = (opcoes.fetch ?? fetch)("https://api.resend.com/emails", {
      method: "POST", redirect: "error", cache: "no-store", signal: controle.signal,
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", "Idempotency-Key": dados.data.chaveIdempotencia },
      body: JSON.stringify({ from: remetente, to: [dados.data.destinatario], subject: dados.data.assunto, text: dados.data.texto }),
    });
    void operacao.then(r => { if (controle.signal.aborted) void r.body?.cancel().catch(() => undefined); }).catch(() => undefined);
    resposta = await Promise.race([operacao, interrompida]);
    if (!resposta.ok) {
      void resposta.body?.cancel().catch(() => undefined);
      return { situacao: [400, 401, 403, 404, 422].includes(resposta.status) ? "RECUSADO" : "INCERTO" };
    }
    const json: unknown = await Promise.race([resposta.json(), interrompida]);
    const recebido = z.object({ id: z.string().uuid() }).safeParse(json);
    return recebido.success ? { situacao: "ACEITO", provedorId: recebido.data.id } : { situacao: "INCERTO" };
  } catch {
    // Uma falha depois de iniciar a requisição não prova que não houve envio.
    void resposta?.body?.cancel().catch(() => undefined);
    return { situacao: "INCERTO" };
  } finally {
    clearTimeout(timer);
    remover?.();
    opcoes.signal?.removeEventListener("abort", abortar);
  }
}
