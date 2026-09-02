import { describe, it, expect, beforeEach, vi } from "vitest";
import { EtapaLead, Papel, Temperatura } from "@prisma/client";

// C3 (doc 27) — copiloto IA só-leitura: geração (driver simulado), expiração de lote
// antigo, idempotência do gatilho de quietude e decisão humana (aceitar aplica a mutação
// com evento; descartar não toca o lead). Sessão mockada; papéis frescos do banco.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { gerarSugestoesParaLead, rodarCopilotoQuietude } from "./copiloto";
import { aceitarSugestao, descartarSugestao } from "./acoes";

function logadoComo(id: string) {
  authMock.mockResolvedValue({ user: { id } });
}

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor IA");
  delete process.env.ANTHROPIC_API_KEY; // driver SIMULADO — determinístico, sem rede
});

async function seedLeadComConversa(opts: { etapa?: EtapaLead; inboundHaMin?: number } = {}) {
  const numero = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511911112222", rotulo: "Vendas", driver: "BAILEYS", finalidade: "VENDAS", providerRef: "inst-ia", donoId: vendedor.id },
  });
  const lead = await prisma.lead.create({
    data: {
      codigo: `L-${Math.floor(Math.random() * 1e6)}`,
      nome: "Carla",
      etapa: opts.etapa ?? EtapaLead.NOVO,
      temperatura: Temperatura.FRIO,
      vendedorDonoId: vendedor.id,
    },
  });
  const contato = await prisma.contatoWhatsApp.create({
    data: { telefoneE164: `+5069${Math.floor(Math.random() * 1e7)}`, leadId: lead.id },
  });
  const quando = new Date(Date.now() - (opts.inboundHaMin ?? 15) * 60_000);
  const conversa = await prisma.conversaWhatsApp.create({
    data: { numeroId: numero.id, contatoId: contato.id, capturadaEm: quando, ultimaMensagemEm: quando, ultimoInboundEm: quando },
  });
  // Conversa com sinal: lead pergunta preço e urgência; a escola respondeu.
  for (const [i, m] of [
    { direcao: "ENTRADA" as const, corpo: "Olá! Quanto custa o curso? Preciso começar essa semana, é urgente." },
    { direcao: "SAIDA" as const, corpo: "Oi Carla! Te passo os valores já." },
    { direcao: "ENTRADA" as const, corpo: "Perfeito, aguardo." },
  ].entries()) {
    await prisma.mensagemWhatsApp.create({
      data: {
        conversaId: conversa.id,
        numeroId: numero.id,
        direcao: m.direcao,
        tipo: "TEXTO",
        corpo: m.corpo,
        status: "ENTREGUE",
        driver: "BAILEYS",
        origem: m.direcao === "SAIDA" ? "HUMANO" : null,
        providerMessageId: `wamid-ia-${lead.id}-${i}`,
        criadoEm: new Date(quando.getTime() + i * 60_000),
      },
    });
  }
  return { lead, contato, conversa, quando };
}

async function ligarCopiloto(quietudeMin = 10) {
  await prisma.configComercial.upsert({
    where: { id: "comercial" },
    create: { id: "comercial", copilotoAtivo: true, copilotoQuietudeMinutos: quietudeMin },
    update: { copilotoAtivo: true, copilotoQuietudeMinutos: quietudeMin },
  });
}

describe("geração de sugestões (driver simulado)", () => {
  it("gera lote com sugestões pendentes + evento SugestaoIAGerada", async () => {
    const { lead } = await seedLeadComConversa();

    const r = await gerarSugestoesParaLead(lead.id, "SOB_DEMANDA");

    expect(r.geradas).toBeGreaterThan(0);
    const sugestoes = await prisma.sugestaoIA.findMany({ where: { leadId: lead.id, status: "PENDENTE" } });
    expect(sugestoes.length).toBe(r.geradas);
    expect(sugestoes.every((s) => s.modelo === "simulado")).toBe(true);
    const eventos = await eventosDo("Lead", lead.id);
    expect(eventos.some((e) => e.tipo === "SugestaoIAGerada")).toBe(true);
  });

  it("lote novo EXPIRA as pendentes do lote anterior", async () => {
    const { lead } = await seedLeadComConversa();
    await gerarSugestoesParaLead(lead.id, "SOB_DEMANDA");
    const antes = await prisma.sugestaoIA.findMany({ where: { leadId: lead.id, status: "PENDENTE" } });
    expect(antes.length).toBeGreaterThan(0);

    await gerarSugestoesParaLead(lead.id, "SOB_DEMANDA");

    const expiradas = await prisma.sugestaoIA.count({ where: { leadId: lead.id, status: "EXPIRADA" } });
    expect(expiradas).toBe(antes.length);
    const pendentes = await prisma.sugestaoIA.findMany({ where: { leadId: lead.id, status: "PENDENTE" } });
    expect(pendentes.every((s) => !antes.some((a) => a.id === s.id))).toBe(true);
  });
});

describe("gatilho de quietude (cron)", () => {
  it("desligado → não roda (regra de ouro: nasce desligado)", async () => {
    await seedLeadComConversa();
    const r = await rodarCopilotoQuietude();
    expect(r.executou).toBe(false);
    expect(r.motivoParada).toBe("copiloto_desligado");
    expect(await prisma.sugestaoIA.count()).toBe(0);
  });

  it("conversa quieta gera análise UMA vez por inbound (idempotente no tick de 5min)", async () => {
    await ligarCopiloto(10);
    const { lead } = await seedLeadComConversa({ inboundHaMin: 15 });

    const r1 = await rodarCopilotoQuietude();
    expect(r1.analisesGeradas).toBe(1);

    const r2 = await rodarCopilotoQuietude();
    expect(r2.analisesGeradas).toBe(0); // mesma âncora → não re-analisa

    const lotes = new Set(
      (await prisma.sugestaoIA.findMany({ where: { leadId: lead.id } })).map((s) => s.loteId),
    );
    expect(lotes.size).toBe(1);
  });

  it("conversa ainda 'viva' (inbound há menos que a quietude) não é analisada", async () => {
    await ligarCopiloto(10);
    await seedLeadComConversa({ inboundHaMin: 3 });
    const r = await rodarCopilotoQuietude();
    expect(r.conversasAvaliadas).toBe(0);
  });
});

describe("decisão humana (métrica-gate)", () => {
  it("aceitar TEMPERATURA aplica no lead + eventos (autor = humano)", async () => {
    const { lead } = await seedLeadComConversa();
    await ligarCopiloto();
    await gerarSugestoesParaLead(lead.id, "SOB_DEMANDA");
    const sugestao = await prisma.sugestaoIA.findFirstOrThrow({
      where: { leadId: lead.id, tipo: "TEMPERATURA", status: "PENDENTE" },
    });

    logadoComo(vendedor.id);
    const r = await aceitarSugestao(sugestao.id);
    expect(r.ok).toBe(true);

    const leadDepois = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(leadDepois.temperatura).not.toBe(Temperatura.FRIO); // sugerido aplicado
    const s = await prisma.sugestaoIA.findUniqueOrThrow({ where: { id: sugestao.id } });
    expect(s.status).toBe("ACEITA");
    expect(s.decididaPorId).toBe(vendedor.id);
    const eventos = await eventosDo("Lead", lead.id);
    const decisao = eventos.find((e) => e.tipo === "SugestaoIADecidida");
    expect(decisao?.autorId).toBe(vendedor.id); // a IA nunca é autora
    expect(eventos.some((e) => e.tipo === "TemperaturaAlterada")).toBe(true);
  });

  it("descartar NÃO toca o lead", async () => {
    const { lead } = await seedLeadComConversa();
    await ligarCopiloto();
    await gerarSugestoesParaLead(lead.id, "SOB_DEMANDA");
    const sugestao = await prisma.sugestaoIA.findFirstOrThrow({
      where: { leadId: lead.id, tipo: "TEMPERATURA", status: "PENDENTE" },
    });

    logadoComo(vendedor.id);
    const r = await descartarSugestao(sugestao.id);
    expect(r.ok).toBe(true);

    const leadDepois = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(leadDepois.temperatura).toBe(Temperatura.FRIO); // intacto
    expect((await prisma.sugestaoIA.findUniqueOrThrow({ where: { id: sugestao.id } })).status).toBe("DESCARTADA");
  });

  it("vendedor de OUTRA carteira não decide (row-level)", async () => {
    const outro = await criarUsuario([Papel.VENDEDOR], "Outro Vendedor");
    const { lead } = await seedLeadComConversa();
    await ligarCopiloto();
    await gerarSugestoesParaLead(lead.id, "SOB_DEMANDA");
    const sugestao = await prisma.sugestaoIA.findFirstOrThrow({ where: { leadId: lead.id, status: "PENDENTE" } });

    logadoComo(outro.id);
    const r = await aceitarSugestao(sugestao.id);
    expect(r.ok).toBe(false);
    expect((await prisma.sugestaoIA.findUniqueOrThrow({ where: { id: sugestao.id } })).status).toBe("PENDENTE");
  });
});
