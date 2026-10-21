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

describe("mensagem.enviada (eco)", () => {
  const processarEnviada = (e: EnvelopeMotor) => PROCESSADORES["mensagem.enviada"](e);
  const CID = "11111111-2222-4333-8444-555555555555";
  const envEnviada = (extra: Record<string, unknown> = {}): EnvelopeMotor => ({
    ...env({ direcao: "SAIDA", ...extra }),
    tipo: "mensagem.enviada",
  });
  const msg = (id: string) => prisma.mensagemWhatsApp.findFirstOrThrow({ where: { providerMessageId: id } });

  async function intencao(status: "ENVIANDO" | "FALHOU", motivoFalha: string | null) {
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777" } });
    return prisma.intencaoMensagem.create({
      data: { numeroId, contatoId: contato.id, origem: "HUMANO", status, corpoRenderizado: "oi", clientMessageId: CID, motivoFalha },
    });
  }

  it("origem celular grava SAIDA CELULAR e marca primeiraRespostaEm", async () => {
    // Um inbound abre o atendimento; a resposta do celular fecha a primeira resposta.
    await processar(env({ providerMessageId: "IN1", mensagemId: "50688887777@s.whatsapp.net:IN1" }));
    expect(await processarEnviada(envEnviada({ origem: "celular", providerMessageId: "CEL1", mensagemId: "50688887777@s.whatsapp.net:CEL1" }))).toBe("ok");
    expect(await msg("CEL1")).toMatchObject({ direcao: "SAIDA", origem: "CELULAR", autorId: null, driver: "MOTOR" });
    const at = await prisma.atendimentoWhatsApp.findFirstOrThrow();
    expect(at.primeiraRespostaEm).not.toBeNull();
    expect(at.ultimaMensagemEm).not.toBeNull();
  });

  it("eco origem erp de mensagem já gravada preenche mensagemIdMotor e não duplica", async () => {
    await processar(env());
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    await prisma.mensagemWhatsApp.update({ where: { id: m.id }, data: { mensagemIdMotor: null, clientMessageId: CID, providerMessageId: "ERP1" } });
    expect(await processarEnviada(envEnviada({ origem: "erp", clientMessageId: CID, providerMessageId: "ERP1", mensagemId: "50688887777@s.whatsapp.net:ERP1" }))).toBe("ok");
    expect(await prisma.mensagemWhatsApp.count()).toBe(1);
    expect((await prisma.mensagemWhatsApp.findFirstOrThrow()).mensagemIdMotor).toBe("50688887777@s.whatsapp.net:ERP1");
  });

  it("eco origem erp com intenção ENVIANDO adia e não grava", async () => {
    await intencao("ENVIANDO", null);
    expect(await processarEnviada(envEnviada({ origem: "erp", clientMessageId: CID }))).toEqual({ adiar: "intencao_enviando" });
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);
  });

  it("eco origem erp com intenção FALHOU resultado_incerto grava Evento EnvioIncertoConfirmadoPeloMotor", async () => {
    const i = await intencao("FALHOU", "resultado_incerto");
    const e = envEnviada({ origem: "erp", clientMessageId: CID });
    expect(await processarEnviada(e)).toBe("ok");
    expect(await processarEnviada(e)).toBe("ok");
    const evs = await prisma.evento.findMany({ where: { tipo: "EnvioIncertoConfirmadoPeloMotor" } });
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ agregadoTipo: "IntencaoMensagem", agregadoId: i.id });
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).status).toBe("FALHOU");
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);
  });

  it("eco origem erp com clientMessageId desconhecido → {ignorado:'eco_sem_origem'}", async () => {
    expect(await processarEnviada(envEnviada({ origem: "erp", clientMessageId: CID }))).toEqual({ ignorado: "eco_sem_origem" });
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);
  });

  it("eco do mesmo evento celular duas vezes não duplica", async () => {
    await processarEnviada(envEnviada({ origem: "celular", providerMessageId: "CEL2" }));
    expect(await processarEnviada(envEnviada({ origem: "celular", providerMessageId: "CEL2" }))).toEqual({ ignorado: "duplicada" });
  });
});
