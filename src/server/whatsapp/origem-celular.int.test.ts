import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { processarMensagemNormalizada, type InboundNormalizado } from "./inbound";
import { enviarTextoInbox } from "./acoes";
import { despacharFila } from "./despachante";
import { motivoCadenciaInvalida } from "./elegibilidade";
import { CADENCIA_LEAD_NOVO, CHAVE_LEAD_NOVO } from "@/server/comercial/regua-fabrica";

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

  // Regressão B2: o eco do celular grava origem CELULAR e deve contar como "vendedor assumiu".
  async function cenarioTakeover() {
    const c = await cenario();
    const capturadaEm = new Date(Date.now() - 60 * 60_000);
    const conversa = await prisma.conversaWhatsApp.findFirstOrThrow({ where: { numeroId: c.numero.id }, include: { contato: true } });
    await prisma.conversaWhatsApp.update({ where: { id: conversa.id }, data: { capturadaEm } });
    const politica = await prisma.politicaComercial.create({
      data: {
        chave: CHAVE_LEAD_NOVO, nome: CHAVE_LEAD_NOVO, estado: "SHADOW", janelaInicio: 0, janelaFim: 24,
        diasSemana: [0, 1, 2, 3, 4, 5, 6], numeroRemetenteId: c.numero.id,
        degraus: { create: CADENCIA_LEAD_NOVO.map((d) => ({ passo: d.passo, offsetMinutos: d.offsetMinutos, rotulo: d.rotulo, ativo: true, toleranciaMinutos: d.toleranciaMinutos })) },
      },
    });
    const intencao = await prisma.intencaoMensagem.create({
      data: {
        numeroId: c.numero.id, contatoId: conversa.contatoId!, origem: "CRON", leadId: conversa.contato!.leadId,
        passoComercial: "+30min", ocorrenciaComercial: capturadaEm.toISOString(), politicaComercialId: politica.id, corpoRenderizado: "Oi Maria!",
      },
    });
    await processarMensagemNormalizada({ ...c.inbound, fromMe: true, providerMessageId: "eco-takeover" });
    return { ...c, intencao };
  }

  it("eco do celular torna obsoleta a intenção de lead NOVO (elegibilidade)", async () => {
    const { intencao } = await cenarioTakeover();
    const completa = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id }, include: { politicaComercial: true } });
    expect(await motivoCadenciaInvalida(completa, new Date())).toBe("atendimento_comercial_iniciado");
  });

  it("eco do celular cancela a intenção de lead NOVO no despachante (vendedor_assumiu)", async () => {
    const { intencao } = await cenarioTakeover();
    const r = await despacharFila();
    expect(r.canceladas).toBe(1);
    const i = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } });
    expect(i.status).toBe("CANCELADA");
    expect(["vendedor_assumiu", "atendimento_comercial_iniciado"]).toContain(i.motivoFalha); // 1ª barreira que enxergar o eco
    expect(enviarTextoMock).not.toHaveBeenCalled();
  });
});
