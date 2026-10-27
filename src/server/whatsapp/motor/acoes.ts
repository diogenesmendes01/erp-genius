import type { OrigemEnvio } from "@prisma/client";
import { chamarMotor, TIMEOUT_MIDIA_MS, TIMEOUT_TEXTO_MS } from "./cliente";

export type AcaoMotor =
  | "message.edit"
  | "message.delete"
  | "message.react"
  | "message.forward"
  | "message.read"
  | "presence"
  | "group.details"
  | "contact.block"
  | "group.create"
  | "group.participants"
  | "profile.update"
  | "profile.picture"
  | "privacy.update";

const ACOES_QUE_GERAM_MENSAGEM = new Set<AcaoMotor>(["message.edit", "message.delete", "message.react", "message.forward"]);

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
