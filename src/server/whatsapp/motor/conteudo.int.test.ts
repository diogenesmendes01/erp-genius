import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock, enviarConteudo, lerMidia } = vi.hoisted(() => ({ authMock: vi.fn(), enviarConteudo: vi.fn(), lerMidia: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Driver FALSO: nenhuma mensagem real sai.
vi.mock("../drivers/motor", () => ({ driverMotor: { enviarTexto: vi.fn(), enviarTemplate: vi.fn(), enviarMidia: vi.fn(), enviarConteudo } }));
vi.mock("../midia", async (orig) => ({ ...(await orig<typeof import("../midia")>()), lerMidiaParaEnvio: lerMidia }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "../atendimentos";
import { despacharFila } from "../despachante";
import { enviarConteudoInbox } from "./acoes-mensagem";

beforeEach(async () => {
  await truncarBanco(); authMock.mockReset(); enviarConteudo.mockReset(); lerMidia.mockReset();
  vi.stubEnv("WHATSAPP_LIVE", "1");
  enviarConteudo.mockResolvedValue({ providerMessageId: "3EB0C", mensagemIdMotor: "c:3EB0C" });
  lerMidia.mockResolvedValue({ mime: "image/webp", nomeArquivo: "f.webp", dadosBase64: "AAAA" });
});
afterEach(() => vi.unstubAllEnvs());

async function cenario(optOut = false) {
  const { numero } = await seedCanal();
  const autor = await criarUsuario([Papel.ADMINISTRADOR], "Autor");
  authMock.mockResolvedValue({ user: { id: autor.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777", optOutEm: optOut ? new Date() : null } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: autor.id }));
  return { numero, autor, contato, at };
}

describe("conteúdo especial pelo motor", () => {
  it("enquete passa por despachante e chega ao driver com nome/opções/maxEscolhas", async () => {
    const { at } = await cenario();
    const conteudo = { tipo: "ENQUETE" as const, nome: "Qual horário?", opcoes: ["Manhã", "Tarde"], maxEscolhas: 1 };
    const r = await enviarConteudoInbox({ atendimentoId: at.id, conteudo });
    expect(r).toEqual({ ok: true, dado: { status: "DESPACHADA", motivo: null } });
    expect(enviarConteudo).toHaveBeenCalledWith(expect.anything(), "+50688887777", conteudo, null,
      expect.objectContaining({ clientMessageId: expect.stringMatching(/^[0-9a-f-]{36}$/), origem: "HUMANO" }));
    const i = await prisma.intencaoMensagem.findFirstOrThrow({ include: { mensagem: true } });
    expect(i).toMatchObject({ tipo: "ENQUETE", corpoRenderizado: "Qual horário?", origem: "HUMANO" });
    expect(i.mensagem).toMatchObject({ tipo: "ENQUETE", corpo: "Qual horário?", mensagemIdMotor: "c:3EB0C" });
  });

  it("localização grava resumo com 📍 e contato grava corpo vazio", async () => {
    const { at } = await cenario();
    await enviarConteudoInbox({ atendimentoId: at.id, conteudo: { tipo: "LOCALIZACAO", latitude: 9.93, longitude: -84.08, nome: "Escola" } });
    await enviarConteudoInbox({ atendimentoId: at.id, conteudo: { tipo: "CONTATO", contatoJid: "50688880000@s.whatsapp.net" } });
    const is = await prisma.intencaoMensagem.findMany({ orderBy: { criadaEm: "asc" } });
    expect(is.map((i) => [i.tipo, i.corpoRenderizado])).toEqual([["LOCALIZACAO", "📍 Escola"], ["CONTATO", ""]]);
    expect(enviarConteudo).toHaveBeenCalledTimes(2);
  });

  it("figurinha exige webp do próprio autor; GIF exige mp4", async () => {
    const { at, autor } = await cenario();
    const outro = await enviarConteudoInbox({ atendimentoId: at.id, conteudo: { tipo: "FIGURINHA" }, midiaUrl: "/api/files/whatsapp-out/outro-id/a.webp" });
    expect(outro).toEqual({ ok: false, erro: "Anexo inválido: envie o arquivo pelo uploader da inbox." });
    const png = await enviarConteudoInbox({ atendimentoId: at.id, conteudo: { tipo: "FIGURINHA" }, midiaUrl: `/api/files/whatsapp-out/${autor.id}/a.png` });
    expect(png).toEqual({ ok: false, erro: "A figurinha precisa ser uma imagem WebP." });
    const gif = await enviarConteudoInbox({ atendimentoId: at.id, conteudo: { tipo: "GIF" }, midiaUrl: `/api/files/whatsapp-out/${autor.id}/a.webp` });
    expect(gif).toEqual({ ok: false, erro: "O GIF precisa ser um vídeo MP4." });
    expect(enviarConteudo).not.toHaveBeenCalled();

    const ok = await enviarConteudoInbox({ atendimentoId: at.id, conteudo: { tipo: "FIGURINHA" }, midiaUrl: `/api/files/whatsapp-out/${autor.id}/a.webp` });
    expect(ok.ok).toBe(true);
    expect(enviarConteudo).toHaveBeenCalledWith(expect.anything(), "+50688887777", { tipo: "FIGURINHA" },
      expect.objectContaining({ mime: "image/webp", dadosBase64: "AAAA" }), expect.anything());
    lerMidia.mockResolvedValue({ mime: "video/mp4", nomeArquivo: "g.mp4", dadosBase64: "BBBB" });
    const g = await enviarConteudoInbox({ atendimentoId: at.id, conteudo: { tipo: "GIF" }, midiaUrl: `/api/files/whatsapp-out/${autor.id}/g.mp4` });
    expect(g.ok).toBe(true);
    expect((await prisma.intencaoMensagem.findMany({ where: { tipo: "VIDEO" } })).length).toBe(1);
  });

  it("opt-out bloqueia conteúdo especial como bloqueia texto", async () => {
    const { at } = await cenario(true);
    const r = await enviarConteudoInbox({ atendimentoId: at.id, conteudo: { tipo: "ENQUETE", nome: "x", opcoes: ["a", "b"], maxEscolhas: 1 } });
    expect(r.ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(enviarConteudo).not.toHaveBeenCalled();
  });

  it("opt-out que chega depois de criada a intenção cancela no despachante", async () => {
    const { at, numero, contato, autor } = await cenario();
    const i = await prisma.intencaoMensagem.create({ data: {
      numeroId: numero.id, atendimentoId: at.id, contatoId: contato.id, origem: "HUMANO", tipo: "ENQUETE", autorId: autor.id,
      conteudo: { tipo: "ENQUETE", nome: "x", opcoes: ["a", "b"], maxEscolhas: 1 }, corpoRenderizado: "x",
    } });
    await prisma.contatoWhatsApp.update({ where: { id: contato.id }, data: { optOutEm: new Date() } });
    await despacharFila(new Date(), { intencaoId: i.id });
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).toMatchObject({ status: "CANCELADA", motivoFalha: "opt_out" });
    expect(enviarConteudo).not.toHaveBeenCalled();
  });

  it("Aria (origem IA) não envia figurinha nem GIF", async () => {
    const { at, numero, contato, autor } = await cenario();
    // motivoIntencaoInvalida hoje trata IA como origem com autor; a Aria real é tarefa posterior.
    const i = await prisma.intencaoMensagem.create({ data: {
      numeroId: numero.id, atendimentoId: at.id, contatoId: contato.id, autorId: autor.id, origem: "IA", tipo: "FIGURINHA", reativa: true,
      conteudo: { tipo: "FIGURINHA" }, midiaPath: "/api/files/whatsapp-out/x/a.webp", corpoRenderizado: "",
    } });
    await despacharFila(new Date(), { intencaoId: i.id });
    const f = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } });
    expect(f).toMatchObject({ status: "CANCELADA", motivoFalha: "ia_conteudo_nao_permitido" });
    expect(enviarConteudo).not.toHaveBeenCalled();
  });
});
