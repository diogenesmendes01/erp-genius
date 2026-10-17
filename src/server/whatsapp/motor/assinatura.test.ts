import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verificarAssinaturaMotor } from "./assinatura";

const S = "segredo-de-teste";
const agoraMs = 1_800_000_000_000;
const agoraS = Math.floor(agoraMs / 1000);
const corpo = '{"evento":"x"}';
const sig = (ts: string, c: string) => createHmac("sha256", S).update(`${ts}.${c}`).digest("hex");

function v(o: Partial<{ corpo: string; timestamp: string | null; assinatura: string | null }>) {
  const ts = o.timestamp === undefined ? String(agoraS) : o.timestamp;
  return verificarAssinaturaMotor({
    corpo: o.corpo ?? corpo,
    timestamp: ts,
    assinatura: o.assinatura === undefined ? sig(String(agoraS), corpo) : o.assinatura,
    segredo: S,
    agoraMs,
  });
}

describe("verificarAssinaturaMotor", () => {
  it("aceita assinatura correta", () => expect(v({})).toBe("ok"));
  it("rejeita corpo alterado em 1 byte", () => expect(v({ corpo: corpo + " " })).toBe("assinatura_invalida"));
  it("timestamp 301 s atrás é rejeitado", () => {
    const ts = String(agoraS - 301);
    expect(v({ timestamp: ts, assinatura: sig(ts, corpo) })).toBe("fora_da_janela");
  });
  it("timestamp 299 s à frente é aceito", () => {
    const ts = String(agoraS + 299);
    expect(v({ timestamp: ts, assinatura: sig(ts, corpo) })).toBe("ok");
  });
  it("timestamp não numérico é fora da janela", () => expect(v({ timestamp: "abc" })).toBe("fora_da_janela"));
  it("assinatura com tamanho diferente não lança", () => expect(v({ assinatura: "ab" })).toBe("assinatura_invalida"));
  it("assinatura não hex não lança", () => expect(v({ assinatura: "zz".repeat(32) })).toBe("assinatura_invalida"));
  it("sem cabeçalho", () => {
    expect(v({ assinatura: null })).toBe("sem_cabecalho");
    expect(v({ timestamp: null })).toBe("sem_cabecalho");
  });
});
