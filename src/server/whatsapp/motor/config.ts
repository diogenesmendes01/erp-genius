import { ErroMotor } from "./cliente";

export interface ConfigMotor {
  url: string;
  apiKey: string;
  segredoWebhook: string;
}

const MIN_SEGREDO = 32;

/** Lê a configuração do motor. Lança ErroMotor("SEM_CONFIG") se faltar algo ou se chave/segredo forem curtos. */
export function lerConfigMotor(env: Record<string, string | undefined> = process.env): ConfigMotor {
  const url = env.MOTOR_URL?.trim();
  const apiKey = env.MOTOR_API_KEY?.trim();
  const segredoWebhook = env.MOTOR_WEBHOOK_SECRET?.trim();
  if (!url || !apiKey || !segredoWebhook || apiKey.length < MIN_SEGREDO || segredoWebhook.length < MIN_SEGREDO) {
    throw new ErroMotor("SEM_CONFIG", 0, undefined, undefined);
  }
  return { url: url.replace(/\/+$/, ""), apiKey, segredoWebhook };
}
