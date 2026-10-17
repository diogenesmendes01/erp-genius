import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ registrar: vi.fn(), drenar: vi.fn(), after: vi.fn() }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: m.after }));
vi.mock("@/server/whatsapp/motor/receber", () => ({ registrarEventoMotor: m.registrar }));
vi.mock("@/server/whatsapp/motor/drenar", () => ({ drenarEventosMotor: m.drenar }));

import { POST } from "./route";

const SEGREDO = "s".repeat(40);
const ID = "0b9f3c1e-6c1d-4a55-9d3e-2f6f8a1b7c10";
const corpo = JSON.stringify({ idEvento: ID, tipo: "mensagem.recebida", numeroId: "n1", ocorridoEm: 1_790_000_000_000, dados: {} });

function post(c: string, o: { assinatura?: string; ts?: number; evento?: string } = {}) {
  const ts = String(o.ts ?? Math.floor(Date.now() / 1000));
  const assinatura = o.assinatura ?? createHmac("sha256", SEGREDO).update(`${ts}.${c}`).digest("hex");
  return POST(new Request("https://example.test/api/whatsapp/webhook/motor", {
    method: "POST",
    headers: { "x-motor-evento": o.evento ?? ID, "x-motor-timestamp": ts, "x-motor-assinatura": assinatura },
    body: c,
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("MOTOR_URL", "http://motor:4317");
  vi.stubEnv("MOTOR_API_KEY", "k".repeat(40));
  vi.stubEnv("MOTOR_WEBHOOK_SECRET", SEGREDO);
  m.registrar.mockResolvedValue("novo");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/whatsapp/webhook/motor", () => {
  it("assinatura inválida → 401 e nada gravado", async () => {
    expect((await post(corpo, { assinatura: "00" })).status).toBe(401);
    expect(m.registrar).not.toHaveBeenCalled();
  });
  it("replay fora da janela → 401", async () => {
    expect((await post(corpo, { ts: Math.floor(Date.now() / 1000) - 3600 })).status).toBe(401);
    expect(m.registrar).not.toHaveBeenCalled();
  });
  it("x-motor-evento divergente do corpo → 400", async () => {
    expect((await post(corpo, { evento: "outro" })).status).toBe(400);
    expect(m.registrar).not.toHaveBeenCalled();
  });
  it("envelope inválido → 400", async () => {
    expect((await post(JSON.stringify({ idEvento: "x" }))).status).toBe(400);
  });
  it("evento válido → 200, grava e agenda dreno com after", async () => {
    const r = await post(corpo);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(m.registrar).toHaveBeenCalledWith(expect.objectContaining({ idEvento: ID }));
    expect(m.after).toHaveBeenCalledTimes(1);
    await m.after.mock.calls[0][0]();
    expect(m.drenar).toHaveBeenCalledTimes(1);
  });
  it("mesmo idEvento duas vezes: duplicado responde 200 sem novo dreno", async () => {
    m.registrar.mockResolvedValueOnce("novo").mockResolvedValueOnce("duplicado");
    expect((await post(corpo)).status).toBe(200);
    expect((await post(corpo)).status).toBe(200);
    expect(m.registrar).toHaveBeenCalledTimes(2);
    expect(m.after).toHaveBeenCalledTimes(1);
  });
  it("sem MOTOR_WEBHOOK_SECRET → 503", async () => {
    vi.stubEnv("MOTOR_WEBHOOK_SECRET", "");
    expect((await post(corpo)).status).toBe(503);
    expect(m.registrar).not.toHaveBeenCalled();
  });
});
