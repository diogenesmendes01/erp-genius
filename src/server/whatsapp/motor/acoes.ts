import type { OrigemEnvio } from "@prisma/client";
import { chamarMotor, TIMEOUT_MIDIA_MS, TIMEOUT_TEXTO_MS } from "./cliente";

export type AcaoMotor =
  | "message.edit"
  | "message.delete"
  | "message.react"
  | "message.forward"
  | "message.read"
  | "presence"
  | "group.details";

/** Ações que geram mensagem passam pelo ritmo do motor (podem esperar até esperaMaxMs): timeout de mídia. */
const ACOES_QUE_GERAM_MENSAGEM = new Set<AcaoMotor>(["message.edit", "message.delete", "message.react", "message.forward"]);

/**
 * Executa uma ação do Inbox no motor e devolve o `resultado` da resposta.
 * `origem: "HUMANO"` envia `X-Origem: HUMANO` (prioridade no ritmo do motor).
 * 409 limite_ritmo chega como ErroMotor("LIMITE_RITMO").
 */
export async function executarAcaoMotor<T>(
  numeroRef: string,
  acao: AcaoMotor,
  payload: Record<string, unknown>,
  opcoes?: { origem?: OrigemEnvio },
): Promise<T> {
  const resp = await chamarMotor<{ resultado?: T }>(`/v1/numeros/${encodeURIComponent(numeroRef)}/acoes`, {
    metodo: "POST",
    json: { acao, payload },
    timeoutMs: ACOES_QUE_GERAM_MENSAGEM.has(acao) ? TIMEOUT_MIDIA_MS : TIMEOUT_TEXTO_MS,
    cabecalhos: opcoes?.origem === "HUMANO" ? { "X-Origem": "HUMANO" } : undefined,
  });
  return resp?.resultado as T;
}
