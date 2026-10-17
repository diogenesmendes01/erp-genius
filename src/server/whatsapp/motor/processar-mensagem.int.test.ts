import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readdir, unlink } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { resolverCaminhoUpload } from "@/lib/uploads";

// Nenhum HTTP real: config falsa + fetch stubado (o cliente real roda por cima).
vi.mock("./config", () => ({ lerConfigMotor: () => ({ url: "http://motor.teste", apiKey: "k".repeat(32), segredoWebhook: "s".repeat(32) }) }));
const baixar = vi.fn();
const respostaPng = (extra: Record<string, string> = {}) =>
  new Response(Buffer.from([1, 2, 3, 4]), { status: 200, headers: { "content-type": "image/png", ...extra } });

import { PROCESSADORES } from "./receber";
import "./processar-mensagem";
import type { EnvelopeMotor } from "./eventos";

const processar = (e: EnvelopeMotor) => PROCESSADORES["mensagem.recebida"](e);
let numeroId: string;
const salvos: string[] = [];

function env(extra: Record<string, unknown> = {}, ref = numeroId): EnvelopeMotor {
  return {
    idEvento: "0b9f3c1e-6c1d-4a55-9d3e-2f6f8a1b7c10",
    tipo: "mensagem.recebida",
    numeroId: ref,
    ocorridoEm: 1_790_000_000_000,
    dados: {
      mensagemId: "50688887777@s.whatsapp.net:ABC",
      providerMessageId: "ABC",
      chatJid: "50688887777@s.whatsapp.net",
      ehGrupo: false,
      direcao: "ENTRADA",
      contato: { jid: "50688887777@s.whatsapp.net", telefoneE164: "+50688887777", nomePerfil: "Ana" },
      tipo: "TEXTO",
      tipoMotor: "text",
      texto: "oi",
      quando: 1_790_000_000_000,
      ...extra,
    },
  };
}
const comMidia = { tipo: "IMAGEM", tipoMotor: "image", midia: { mime: "image/png", nome: "a.png", tamanho: 4 } };

beforeEach(async () => {
  await truncarBanco();
  baixar.mockReset();
  vi.stubGlobal("fetch", baixar);
  const n = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511900000001", rotulo: "Motor", driver: "MOTOR", finalidade: "VENDAS" },
  });
  await prisma.numeroWhatsApp.update({ where: { id: n.id }, data: { providerRef: n.id } });
  numeroId = n.id;
});
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const p of salvos.splice(0)) {
    const c = resolverCaminhoUpload(p.slice("/api/files/".length).split("/"));
    if (c) await unlink(c).catch(() => undefined);
  }
});

describe("mensagem.recebida (1:1)", () => {
  it("grava a mensagem com mensagemIdMotor", async () => {
    expect(await processar(env())).toBe("ok");
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    expect(m).toMatchObject({ providerMessageId: "ABC", mensagemIdMotor: "50688887777@s.whatsapp.net:ABC", driver: "MOTOR", direcao: "ENTRADA", corpo: "oi" });
  });

  it("mensagem já existente não baixa mídia de novo", async () => {
    await processar(env());
    expect(await processar(env(comMidia))).toEqual({ ignorado: "duplicada" });
    expect(baixar).not.toHaveBeenCalled();
    expect(await prisma.mensagemWhatsApp.count()).toBe(1);
  });

  it("baixa a mídia e grava o midiaPath", async () => {
    baixar.mockResolvedValue(respostaPng());
    expect(await processar(env(comMidia))).toBe("ok");
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    expect(m.midiaPath).toMatch(/^\/api\/files\/whatsapp\//);
    salvos.push(m.midiaPath!);
    expect(baixar.mock.calls[0][0]).toBe(`http://motor.teste/v1/numeros/${numeroId}/midia/${encodeURIComponent("50688887777@s.whatsapp.net:ABC")}`);
  });

  it("mídia de 11 MB grava sem midiaPath", async () => {
    baixar.mockResolvedValue(respostaPng({ "content-length": String(11 * 1024 * 1024) }));
    expect(await processar(env(comMidia))).toBe("ok");
    expect((await prisma.mensagemWhatsApp.findFirstOrThrow()).midiaPath).toBeNull();
  });

  it("download falho grava a mensagem sem binário", async () => {
    baixar.mockRejectedValue(new TypeError("fetch failed"));
    expect(await processar(env(comMidia))).toBe("ok");
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    expect(m.midiaPath).toBeNull();
    expect(m.corpo).toBe("oi");
  });

  it("número desconhecido → {ignorado:'numero_desconhecido'}", async () => {
    expect(await processar(env({}, "nao-existe"))).toEqual({ ignorado: "numero_desconhecido" });
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);
  });

  it("grupo fica ignorado até a Task 16", async () => {
    expect(await processar(env({ ehGrupo: true }))).toEqual({ ignorado: "grupo" });
  });

  it("não sobra arquivo órfão quando a gravação resulta em duplicada", async () => {
    // Corrida: a mensagem aparece entre a checagem e a gravação.
    baixar.mockImplementation(async () => {
      const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777" } });
      const conv = await prisma.conversaWhatsApp.create({ data: { numeroId, contatoId: contato.id } });
      await prisma.mensagemWhatsApp.create({
        data: { conversaId: conv.id, numeroId, direcao: "ENTRADA", tipo: "TEXTO", driver: "MOTOR", providerMessageId: "ABC" },
      });
      return respostaPng();
    });
    const antes = await prisma.mensagemWhatsApp.count();
    const dir = resolverCaminhoUpload(["whatsapp"]) as string;
    const arquivosAntes = await readdir(dir).catch(() => [] as string[]);
    expect(await processar(env(comMidia))).toEqual({ ignorado: "duplicada" });
    expect(await prisma.mensagemWhatsApp.count()).toBe(antes + 1);
    expect(await readdir(dir).catch(() => [] as string[])).toEqual(arquivosAntes);
  });
});
