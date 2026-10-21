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
  enviarTextoMock: vi.fn().mockResolvedValue({ providerMessageId: "3EB0-texto", mensagemIdMotor: "c:3EB0-texto" }),
}));
// Driver do motor FALSO: WHATSAPP_LIVE=1 só para o despachante gravar a mensagem; nada sai de verdade.
vi.mock("./drivers/motor", () => ({ driverMotor: { enviarTexto: enviarTextoMock, enviarTemplate: vi.fn(), enviarMidia: vi.fn() } }));
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
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const lead = await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: "+50688888888", vendedorDonoId: vendedor.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
  const inbound: InboundNormalizado = {
    numeroTelefoneE164: numero.telefoneE164, contatoWaId: "50688888888", providerMessageId: "x", corpo: "Oi do celular",
    tipo: "TEXTO", driver: "MOTOR", fromMe: false, quando: new Date("2026-10-16T12:00:00Z"),
  };
  return { vendedor, numero, a, inbound };
}

describe("origem CELULAR e clientMessageId (M4)", () => {
  it("eco fromMe vira SAIDA CELULAR e conta como resposta", async () => {
    const { a, inbound } = await cenario();
    await processarMensagemNormalizada({ ...inbound, fromMe: true, providerMessageId: "eco-1" });
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow({ where: { providerMessageId: "eco-1" } });
    expect(m).toMatchObject({ direcao: "SAIDA", origem: "CELULAR", autorId: null, atendimentoId: a.id });
    expect(m.enviadaEm).toEqual(m.criadoEm);
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } })).primeiraRespostaEm).not.toBeNull();
  });

  it("mensagem recebida (ENTRADA) não ganha origem nem conta como resposta", async () => {
    const { a, inbound } = await cenario();
    await processarMensagemNormalizada({ ...inbound, providerMessageId: "in-1" });
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow({ where: { providerMessageId: "in-1" } });
    expect(m).toMatchObject({ direcao: "ENTRADA", origem: null, enviadaEm: null });
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } })).primeiraRespostaEm).toBeNull();
  });

  it("clientMessageId da mensagem é o mesmo da intenção (motor) e é único", async () => {
    const { vendedor, numero, a } = await cenario();
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    await enviarTextoInbox({ conversaId: a.id, texto: "Olá" });
    const i = await prisma.intencaoMensagem.findFirstOrThrow({ include: { mensagem: true } });
    // O despachante do motor (Fase 4, Tarefa 5) gera o id no claim, entrega ao driver e copia para a mensagem.
    expect(i.status).toBe("DESPACHADA");
    expect(i.clientMessageId).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    expect(i.mensagem).toMatchObject({ driver: "MOTOR", clientMessageId: i.clientMessageId, mensagemIdMotor: "c:3EB0-texto" });
    expect(enviarTextoMock).toHaveBeenCalledWith(expect.anything(), expect.any(String), "Olá",
      expect.objectContaining({ clientMessageId: i.clientMessageId }));
    const criarMensagemSaida = (clientMessageId: string) => prisma.mensagemWhatsApp.create({
      data: { conversaId: i.mensagem!.conversaId, numeroId: numero.id, direcao: "SAIDA", driver: "MOTOR", origem: "IA", clientMessageId },
    });
    await expect(criarMensagemSaida(i.clientMessageId!)).rejects.toMatchObject({ code: "P2002" });
    await expect(criarMensagemSaida("cid-00000002")).resolves.toMatchObject({ origem: "IA" });
  });
});
