import { describe, it, expect, beforeEach, vi } from "vitest";

const { chamar, findUnique, aplicar } = vi.hoisted(() => ({ chamar: vi.fn(), findUnique: vi.fn(), aplicar: vi.fn() }));
vi.mock("./motor/cliente", async (orig) => ({ ...(await orig<typeof import("./motor/cliente")>()), chamarMotor: chamar }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    numeroWhatsApp: { findUnique },
    $transaction: async (fn: (tx: unknown) => unknown) => fn({ numeroWhatsApp: { update: aplicar } }),
  },
}));
vi.mock("@/server/_shared/evento", () => ({ registrarEvento: vi.fn() }));

import { ErroMotor } from "./motor/cliente";
import {
  conectarNumeroMotor,
  consultarSessaoMotor,
  desconectarNumeroMotor,
  garantirNumeroNoMotor,
  parearNumeroMotor,
  sessaoDeStatusMotor,
} from "./sessao";

const N = { id: "num1", providerRef: "num1", rotulo: "Secretaria" };

beforeEach(() => {
  chamar.mockReset();
  findUnique.mockReset();
  aplicar.mockReset();
  findUnique.mockResolvedValue({ id: "num1", sessao: "DESCONECTADO" });
});

describe("sessaoDeStatusMotor", () => {
  it("traduz o status do motor", () => {
    expect(sessaoDeStatusMotor("qr")).toBe("AGUARDANDO_QR");
    expect(sessaoDeStatusMotor("connected")).toBe("CONECTADO");
    expect(sessaoDeStatusMotor("reconnecting")).toBe("CAIU");
    expect(sessaoDeStatusMotor("logged_out")).toBe("DESCONECTADO");
    expect(sessaoDeStatusMotor("xpto")).toBeNull();
  });
});

describe("sessão pelo motor", () => {
  it("garantirNumeroNoMotor faz PUT com o rótulo", async () => {
    chamar.mockResolvedValue({});
    await garantirNumeroNoMotor(N);
    expect(chamar).toHaveBeenCalledWith("/v1/numeros/num1", { metodo: "PUT", json: { rotulo: "Secretaria" } });
  });

  it("conectar: PUT, POST /conectar e GET; devolve o QR e grava AGUARDANDO_QR", async () => {
    chamar.mockImplementation(async (rota: string, init: { metodo: string }) =>
      init.metodo === "GET" ? { sessao: { status: "qr", qr: "data:image/png;base64,QUFB" } } : {},
    );
    const r = await conectarNumeroMotor(N);
    expect(r).toEqual({ qrBase64: "data:image/png;base64,QUFB", codigoPareamento: null, estado: "AGUARDANDO_QR", erro: null });
    expect(chamar.mock.calls.map((c) => `${c[1].metodo} ${c[0]}`)).toEqual([
      "PUT /v1/numeros/num1",
      "POST /v1/numeros/num1/conectar",
      "GET /v1/numeros/num1",
    ]);
    expect(aplicar).toHaveBeenCalledWith({ where: { id: "num1" }, data: { sessao: "AGUARDANDO_QR" } });
  });

  it("conectar com motor fora do ar devolve erro legível, sem lançar", async () => {
    chamar.mockRejectedValue(new ErroMotor("INDISPONIVEL", 0));
    const r = await conectarNumeroMotor(N);
    expect(r.estado).toBe("DESCONECTADO");
    expect(r.erro).toMatch(/indisponível/);
  });

  it("parear devolve o código e manda o telefone", async () => {
    chamar.mockImplementation(async (rota: string) => (rota.endsWith("/pareamento") ? { codigoPareamento: "ABCD-1234" } : {}));
    const r = await parearNumeroMotor(N, "+5511999990001");
    expect(r.codigoPareamento).toBe("ABCD-1234");
    expect(chamar).toHaveBeenCalledWith("/v1/numeros/num1/pareamento", { metodo: "POST", json: { telefone: "+5511999990001" } });
  });

  it("consultar aplica o status do motor", async () => {
    chamar.mockResolvedValue({ sessao: { status: "connected" } });
    findUnique.mockResolvedValueOnce({ id: "num1", sessao: "AGUARDANDO_QR" }).mockResolvedValueOnce({ sessao: "CONECTADO" });
    const r = await consultarSessaoMotor(N);
    expect(r.sessao).toBe("CONECTADO");
  });

  it("desconectar faz POST /desconectar", async () => {
    chamar.mockResolvedValue({});
    await desconectarNumeroMotor(N);
    expect(chamar).toHaveBeenCalledWith("/v1/numeros/num1/desconectar", { metodo: "POST" });
  });
});
