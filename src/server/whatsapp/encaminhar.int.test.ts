import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "@/lib/uploads";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { encaminharMensagem } from "./acoes-conversa";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });
const comoUsuario = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });

async function cenario() {
  const v1 = await criarUsuario([Papel.VENDEDOR], "V1");
  const v2 = await criarUsuario([Papel.VENDEDOR], "V2");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL"], finalidade: "COBRANCA", donoId: (await criarUsuario([Papel.FINANCEIRO], "Dono")).id });
  const abrir = async (tel: string, responsavelId: string) => {
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: tel } });
    const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId }));
    return { a, contato };
  };
  const origem = await abrir("+50688880001", v1.id);
  const meu2 = await abrir("+50688880002", v1.id);
  const deOutro = await abrir("+50688880003", v2.id);
  const m = await prisma.mensagemWhatsApp.create({ data: { numeroId: numero.id, conversaId: origem.a.conversaId, atendimentoId: origem.a.id, direcao: "ENTRADA", driver: "BAILEYS", corpo: "Olá, segue a proposta" } });
  return { v1, v2, numero, origem, meu2, deOutro, m };
}

describe("encaminhar mensagem como cópia", () => {
  it("só encaminha para conversas que a pessoa pode ver e com mensagem de origem visível", async () => {
    const { v1, v2, meu2, deOutro, origem, m } = await cenario();
    comoUsuario(v1);
    expect(await encaminharMensagem({ mensagemId: m.id, destinoAtendimentoIds: [deOutro.a.id] })).toEqual({ ok: false, erro: "Destino fora do seu escopo." });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    const r = await encaminharMensagem({ mensagemId: m.id, destinoAtendimentoIds: [meu2.a.id] });
    if (!r.ok) throw new Error(r.erro);
    const i = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: r.dado!.intencaoIds[0] } });
    expect(i).toMatchObject({ origem: "HUMANO", corpoRenderizado: m.corpo, atendimentoId: meu2.a.id, contatoId: meu2.contato.id, autorId: v1.id });
    const ev = await prisma.evento.findMany({ where: { tipo: "MensagemEncaminhada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: origem.a.id } });
    expect(ev).toHaveLength(1);
    expect(ev[0].payload).toMatchObject({ mensagemId: m.id, destinoAtendimentoIds: [meu2.a.id] });
    // origem fora do escopo
    comoUsuario(v2);
    const r2 = await encaminharMensagem({ mensagemId: m.id, destinoAtendimentoIds: [deOutro.a.id] });
    expect(r2.ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(1);
  });

  it("destino com opt-out é recusado, sem criar nenhuma intenção", async () => {
    const { v1, meu2, origem, m } = await cenario();
    const sem = await prisma.contatoWhatsApp.update({ where: { id: meu2.contato.id }, data: { optOutEm: new Date() } });
    expect(sem.optOutEm).not.toBeNull();
    comoUsuario(v1);
    const r = await encaminharMensagem({ mensagemId: m.id, destinoAtendimentoIds: [origem.a.id, meu2.a.id] });
    expect(r.ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.evento.count({ where: { tipo: "MensagemEncaminhada" } })).toBe(0);
  });

  it("limita a 5 destinos e exige ao menos um", async () => {
    const { v1, meu2, m } = await cenario();
    comoUsuario(v1);
    expect((await encaminharMensagem({ mensagemId: m.id, destinoAtendimentoIds: [] })).ok).toBe(false);
    expect((await encaminharMensagem({ mensagemId: m.id, destinoAtendimentoIds: Array(6).fill(meu2.a.id) })).ok).toBe(false);
  });

  it("mídia da origem é copiada para whatsapp-out/<autor> (de onde o despachante lê) com o mesmo conteúdo", async () => {
    const { v1, numero, origem, meu2 } = await cenario();
    const nome = `encaminhar-${Date.now()}.jpg`;
    const dirIn = path.join(UPLOAD_DIR, "whatsapp");
    await mkdir(dirIn, { recursive: true });
    await writeFile(path.join(dirIn, nome), Buffer.from("conteudo-da-imagem"));
    const midia = await prisma.mensagemWhatsApp.create({ data: { numeroId: numero.id, conversaId: origem.a.conversaId, atendimentoId: origem.a.id, direcao: "ENTRADA", driver: "BAILEYS", tipo: "IMAGEM", corpo: "foto", midiaPath: `/api/files/whatsapp/${nome}` } });
    comoUsuario(v1);
    try {
      const r = await encaminharMensagem({ mensagemId: midia.id, destinoAtendimentoIds: [meu2.a.id] });
      if (!r.ok) throw new Error(r.erro);
      const i = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: r.dado!.intencaoIds[0] } });
      expect(i).toMatchObject({ tipo: "IMAGEM", corpoRenderizado: "foto" });
      expect(i.midiaPath).toMatch(new RegExp(`^/api/files/whatsapp-out/${v1.id}/[^/]+\\.jpg$`));
      const copia = path.join(UPLOAD_DIR, i.midiaPath!.slice("/api/files/".length));
      expect((await readFile(copia)).toString()).toBe("conteudo-da-imagem");
      await rm(copia, { force: true });
    } finally {
      await rm(path.join(dirIn, nome), { force: true });
    }
  });

  it("mídia que sumiu do storage recusa o encaminhamento sem criar intenção", async () => {
    const { v1, numero, origem, meu2 } = await cenario();
    const midia = await prisma.mensagemWhatsApp.create({ data: { numeroId: numero.id, conversaId: origem.a.conversaId, atendimentoId: origem.a.id, direcao: "ENTRADA", driver: "BAILEYS", tipo: "IMAGEM", corpo: "foto", midiaPath: "/api/files/whatsapp/nao-existe.jpg" } });
    comoUsuario(v1);
    expect((await encaminharMensagem({ mensagemId: midia.id, destinoAtendimentoIds: [meu2.a.id] })).ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });
});
