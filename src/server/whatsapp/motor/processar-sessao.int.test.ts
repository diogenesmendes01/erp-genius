import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { PROCESSADORES } from "./receber";
import "./drenar";
import type { EnvelopeMotor } from "./eventos";

let numeroId: string;

const env = (tipo: string, dados: unknown, ref = numeroId): EnvelopeMotor => ({
  idEvento: "0b9f3c1e-6c1d-4a55-9d3e-2f6f8a1b7c11",
  tipo,
  numeroId: ref,
  ocorridoEm: 1_790_000_000_000,
  dados,
});
const sessao = async () => (await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: numeroId } })).sessao;
const eventos = (tipo: string) => prisma.evento.count({ where: { tipo, agregadoId: numeroId } });

beforeEach(async () => {
  await truncarBanco();
  const n = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511900000001", rotulo: "Motor", driver: "MOTOR", finalidade: "VENDAS" },
  });
  await prisma.numeroWhatsApp.update({ where: { id: n.id }, data: { providerRef: n.id } });
  numeroId = n.id;
});

describe("sessao.estado / sessao.qr", () => {
  it("CONECTADO grava NumeroWhatsAppConectado uma vez", async () => {
    const e = env("sessao.estado", { estado: "CONECTADO", telefoneE164: "+5511900000001" });
    expect(await PROCESSADORES["sessao.estado"](e)).toBe("ok");
    expect(await PROCESSADORES["sessao.estado"](e)).toBe("ok");
    expect(await sessao()).toBe("CONECTADO");
    expect(await eventos("NumeroWhatsAppConectado")).toBe(1);
    expect(await eventos("NumeroWhatsAppTelefoneDivergente")).toBe(0);
  });

  it("CAIU depois de CONECTADO grava SessaoBaileysCaiu", async () => {
    await PROCESSADORES["sessao.estado"](env("sessao.estado", { estado: "CONECTADO" }));
    await PROCESSADORES["sessao.estado"](env("sessao.estado", { estado: "CAIU" }));
    expect(await sessao()).toBe("CAIU");
    expect(await eventos("SessaoBaileysCaiu")).toBe(1);
  });

  it("telefone divergente grava evento e não troca o cadastro", async () => {
    await PROCESSADORES["sessao.estado"](env("sessao.estado", { estado: "CONECTADO", telefoneE164: "+5511911112222" }));
    const n = await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: numeroId } });
    expect(n.telefoneE164).toBe("+5511900000001");
    expect(await eventos("NumeroWhatsAppTelefoneDivergente")).toBe(1);
  });

  it("sessao.qr marca AGUARDANDO_QR", async () => {
    expect(await PROCESSADORES["sessao.qr"](env("sessao.qr", { qr: "data:image/png;base64,AAAA" }))).toBe("ok");
    expect(await sessao()).toBe("AGUARDANDO_QR");
  });

  it("sessao.qr não sobrescreve CONECTADO", async () => {
    await PROCESSADORES["sessao.estado"](env("sessao.estado", { estado: "CONECTADO" }));
    expect(await PROCESSADORES["sessao.qr"](env("sessao.qr", { qr: "x" }))).toEqual({ ignorado: "ja_conectado" });
    expect(await sessao()).toBe("CONECTADO");
  });

  it("número desconhecido e dados inválidos são ignorados", async () => {
    expect(await PROCESSADORES["sessao.estado"](env("sessao.estado", { estado: "CONECTADO" }, "nao-existe"))).toEqual({ ignorado: "numero_desconhecido" });
    expect(await PROCESSADORES["sessao.estado"](env("sessao.estado", { estado: "XYZ" }))).toEqual({ ignorado: "dados_invalidos" });
  });
});
