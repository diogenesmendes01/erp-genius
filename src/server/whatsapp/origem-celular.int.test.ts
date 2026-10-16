import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { processarMensagemNormalizada, type InboundNormalizado } from "./inbound";
import { enviarTextoInbox } from "./acoes";

const { authMock, enviarTextoMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  enviarTextoMock: vi.fn().mockResolvedValue({ providerMessageId: "wamid-texto" }),
}));
// Drivers FALSOS: WHATSAPP_LIVE=1 só para o despachante gravar a mensagem; nada sai de verdade.
vi.mock("./drivers/meta-cloud", () => ({ driverMetaCloud: { enviarTexto: enviarTextoMock } }));
vi.mock("./drivers/evolution", () => ({ driverEvolution: { enviarTexto: enviarTextoMock } }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const u = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!u?.ativo) throw new original.ErroAutenticacao();
    return u;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const u = await sessao(); original.exigirPapel(u, ...papeis); return u;
  } };
});

beforeEach(async () => { await truncarBanco(); vi.stubEnv("WHATSAPP_LIVE", "1"); enviarTextoMock.mockClear(); });
afterEach(() => { vi.unstubAllEnvs(); });

async function cenario() {
  const vendedor = await criarUsuario([Papel.VENDEDOR]);
  const { numero } = await seedCanal({ driver: "BAILEYS", estado: "ATIVA" });
  const lead = await prisma.lead.create({ data: { nome: "Maria", telefoneE164: "+50688888888", vendedorDonoId: vendedor.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
  const inbound: InboundNormalizado = {
    numeroTelefoneE164: numero.telefoneE164, contatoWaId: "50688888888", providerMessageId: "x", corpo: "Oi do celular",
    tipo: "TEXTO", driver: "BAILEYS", fromMe: false, quando: new Date("2026-10-16T12:00:00Z"),
  };
  return { vendedor, numero, a, inbound };
}

describe("origem CELULAR e clientMessageId (M4)", () => {
  it("eco fromMe vira SAIDA CELULAR e conta como resposta", async () => {
    const { a, inbound } = await cenario();
    await processarMensagemNormalizada({ ...inbound, fromMe: true, providerMessageId: "eco-1" });
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow({ where: { providerMessageId: "eco-1" } });
    expect(m).toMatchObject({ direcao: "SAIDA", origem: "CELULAR", autorId: null, atendimentoId: a.id });
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } })).primeiraRespostaEm).not.toBeNull();
  });

  it("mensagem recebida (ENTRADA) não ganha origem nem conta como resposta", async () => {
    const { a, inbound } = await cenario();
    await processarMensagemNormalizada({ ...inbound, providerMessageId: "in-1" });
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow({ where: { providerMessageId: "in-1" } });
    expect(m).toMatchObject({ direcao: "ENTRADA", origem: null });
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } })).primeiraRespostaEm).toBeNull();
  });

  it("clientMessageId da mensagem é único e fica nulo com Meta/Evolution", async () => {
    const { vendedor, numero, a } = await cenario();
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    await enviarTextoInbox({ conversaId: a.id, texto: "Olá" });
    const i = await prisma.intencaoMensagem.findFirstOrThrow({ include: { mensagem: true } });
    expect(i.mensagem?.clientMessageId).toBeNull(); // quem preenche é o despachante do motor (Fase 4, Tarefa 5)
    await prisma.mensagemWhatsApp.update({ where: { id: i.mensagem!.id }, data: { clientMessageId: "cid-00000001" } });
    const criarMensagemSaida = (clientMessageId: string) => prisma.mensagemWhatsApp.create({
      data: { conversaId: i.mensagem!.conversaId, numeroId: numero.id, direcao: "SAIDA", driver: "BAILEYS", origem: "IA", clientMessageId },
    });
    await expect(criarMensagemSaida("cid-00000001")).rejects.toMatchObject({ code: "P2002" });
    await expect(criarMensagemSaida("cid-00000002")).resolves.toMatchObject({ origem: "IA" });
  });
});
