import { createHmac, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { POST as webhookMotor } from "@/app/api/whatsapp/webhook/motor/route";

// Motor WhatsApp SIMULADO, em processo (Fase 4, Task 27). Imita o contrato /v1 do modo serviço
// (MODO-SERVICO.md) sem rede externa: sobe um node:http em porta 0 e entrega os eventos assinados
// chamando o `POST` da rota do webhook diretamente. Nunca fala com um WhatsApp de verdade.

export type FalhaEnvio = "NAO_ENVIADO" | "RESULTADO_INCERTO";

export interface RecebidoMotor {
  rota: string;
  corpo: unknown;
  cabecalhos: Record<string, string>;
}

export interface MotorSimulado {
  url: string;
  recebidos: RecebidoMotor[];
  /** Falha atual do envio (null = envia normalmente). Pode ser trocada no meio do teste. */
  falharEnvio: FalhaEnvio | null;
  /** Bytes devolvidos por `GET /v1/numeros/:id/midia/:mensagemId`. */
  midia: { bytes: Buffer; mime: string };
  /** Assina (HMAC do `outbox.ts`) e entrega o evento à rota do webhook. `idEvento` repete um evento. */
  emitir(tipo: string, numeroId: string, dados: unknown, opcoes?: { idEvento?: string }): Promise<Response>;
  fechar(): Promise<void>;
}

// PNG 1x1 transparente.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function lerCorpo(req: IncomingMessage): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const p of req) partes.push(p as Buffer);
  return Buffer.concat(partes);
}

export async function iniciarMotorSimulado(opcoes: { falharEnvio?: FalhaEnvio } = {}): Promise<MotorSimulado> {
  const recebidos: RecebidoMotor[] = [];
  const porClientId = new Map<string, { providerMessageId: string; mensagemIdMotor: string }>();
  let contador = 0;

  const sim: MotorSimulado = {
    url: "",
    recebidos,
    falharEnvio: opcoes.falharEnvio ?? null,
    midia: { bytes: PNG_1X1, mime: "image/png" },
    async emitir(tipo, numeroId, dados, op = {}) {
      const corpo = JSON.stringify({
        idEvento: op.idEvento ?? randomUUID(),
        tipo,
        numeroId,
        ocorridoEm: Date.now(),
        dados,
      });
      const idEvento = (JSON.parse(corpo) as { idEvento: string }).idEvento;
      const ts = String(Math.floor(Date.now() / 1000));
      const segredo = process.env.MOTOR_WEBHOOK_SECRET ?? "";
      const assinatura = createHmac("sha256", segredo).update(`${ts}.${corpo}`).digest("hex");
      return webhookMotor(
        new Request("http://erp.test/api/whatsapp/webhook/motor", {
          method: "POST",
          headers: { "content-type": "application/json", "x-motor-evento": idEvento, "x-motor-timestamp": ts, "x-motor-assinatura": assinatura },
          body: corpo,
        }),
      );
    },
    async fechar() {
      servidor.closeAllConnections();
      await new Promise<void>((r) => servidor.close(() => r()));
    },
  };

  const servidor = createServer(async (req, res) => {
    const json = (status: number, corpo: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(corpo));
    };
    const rota = (req.url ?? "").split("?")[0];
    const bruto = await lerCorpo(req);
    const cabecalhos: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") cabecalhos[k] = v;
    const ehJson = (cabecalhos["content-type"] ?? "").startsWith("application/json");
    let corpo: unknown = bruto.length ? bruto.toString("utf8") : null;
    if (ehJson && bruto.length) {
      try {
        corpo = JSON.parse(bruto.toString("utf8"));
      } catch {
        /* corpo cru */
      }
    }
    recebidos.push({ rota, corpo, cabecalhos });

    if (!/^Bearer .{32,}$/.test(cabecalhos.authorization ?? "")) return json(401, { code: "NAO_AUTORIZADO" });

    const m = /^\/v1\/numeros\/([^/]+)(?:\/(conectar|mensagens|acoes|midia\/[^/]+))?$/.exec(rota);
    if (!m) return json(404, { code: "NAO_ENCONTRADO" });
    const [, , sub] = m;

    if (!sub && req.method === "GET") return json(200, { numeroId: decodeURIComponent(m[1]), estado: "conectado" });
    if (sub === "conectar" && req.method === "POST") return json(200, { estado: "conectando" });
    if (sub === "acoes" && req.method === "POST") return json(200, { resultado: {} });
    if (sub?.startsWith("midia/") && req.method === "GET") {
      res.writeHead(200, { "content-type": sim.midia.mime, "content-length": String(sim.midia.bytes.length) });
      return res.end(sim.midia.bytes);
    }
    if (sub === "mensagens" && req.method === "POST") {
      // multipart: o `payload` JSON viaja como texto dentro do corpo; só o clientMessageId interessa.
      const clientMessageId =
        corpo && typeof corpo === "object"
          ? (corpo as { clientMessageId?: string }).clientMessageId
          : /"clientMessageId":"([^"]+)"/.exec(bruto.toString("latin1"))?.[1];
      if (sim.falharEnvio === "RESULTADO_INCERTO") return json(502, { code: "RESULTADO_INCERTO", motivo: "timeout_confirmacao" });
      if (sim.falharEnvio === "NAO_ENVIADO") return json(409, { code: "NAO_ENVIADO", motivo: "numero_desconectado" });
      const anterior = clientMessageId ? porClientId.get(clientMessageId) : undefined;
      if (anterior) return json(200, anterior);
      contador += 1;
      const resposta = { providerMessageId: `3EB0${contador}`, mensagemIdMotor: `c:3EB0${contador}` };
      if (clientMessageId) porClientId.set(clientMessageId, resposta);
      return json(200, resposta);
    }
    return json(404, { code: "NAO_ENCONTRADO" });
  });

  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", () => r()));
  sim.url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  return sim;
}
