import { PrismaClient } from "@prisma/client";
import { cartoesDaThread } from "../aria/sugestoes-thread";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type StatusAcaoAgenteIA } from "@prisma/client";
import { expirarSugestoesAria } from "@/server/aria/expiracao";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { carregarAriaDoAtendimento } from "./consultas-inbox";
import { podeDevolverParaAria } from "@/server/aria/pausa";

async function cenario(o: { semLead?: boolean } = {}) {
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL]);
  const vendedor = await criarUsuario([Papel.VENDEDOR]);
  await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const lead = o.semLead ? null : await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: "+50688888888", vendedorDonoId: vendedor.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: lead?.id ?? null } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead?.id ?? null }));
  const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id }, select: { conversaId: true } });
  const ancora = await prisma.mensagemWhatsApp.create({
    data: { atendimentoId: a.id, conversaId: conv.conversaId, numeroId: numero.id, direcao: "ENTRADA", corpo: "oi", driver: "MOTOR", status: "ENTREGUE", providerMessageId: "aria-ins-1" },
  });
  const turno = await prisma.turnoAgenteIA.create({ data: { ancoraMensagemId: ancora.id, atendimentoId: a.id, tipo: "ATENDIMENTO", resultado: "SUGERIU" } });
  const sugerir = (o: { status?: StatusAcaoAgenteIA; expiraEm: Date | null; texto?: string; oportunidadeId?: string; id?: string; criadoEm?: Date; decididaEm?: Date | null; decididaPorId?: string | null }) => prisma.acaoAgenteIA.create({
    data: { id: o.id, criadoEm: o.criadoEm, decididaEm: o.decididaEm, decididaPorId: o.decididaPorId, turnoId: turno.id, atendimentoId: a.id, oportunidadeId: o.oportunidadeId ?? null, acao: "RESPONDER", modoConfigurado: "SUGERIR", status: o.status ?? "SUGERIDA", confianca: 70, payload: { texto: o.texto ?? "Olá!" }, reversivel: false, expiraEm: o.expiraEm },
  });
  return { vendedor, gerente, a, lead, numero, sugerir };
}

describe("Aria no detalhe do atendimento (consulta do Inbox)", () => {
  beforeEach(truncarBanco);

  it("pausa e motivo vêm do atendimento; sem pausa o motivo é nulo", async () => {
    const c = await cenario();
    expect(await carregarAriaDoAtendimento(c.gerente, c.a.id)).toEqual({ pausada: false, motivo: null, podeDevolver: false, podeDecidir: true, cartoes: [], handoff: null });
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { iaPausadaEm: new Date(), iaPausaMotivo: "CELULAR" } });
    expect(await carregarAriaDoAtendimento(c.gerente, c.a.id)).toMatchObject({ pausada: true, motivo: "CELULAR" });
  });

  it("lista só sugestões SUGERIDAS e não vencidas, para quem decide o histórico", async () => {
    const c = await cenario();
    const viva = await c.sugerir({ expiraEm: new Date(Date.now() + 3_600_000), texto: "Posso ajudar?" });
    await c.sugerir({ expiraEm: new Date(Date.now() - 1000) });
    await c.sugerir({ status: "APROVADA", expiraEm: null });
    const r = await carregarAriaDoAtendimento(c.gerente, c.a.id);
    expect(r?.cartoes.filter(s=>s.status==="SUGERIDA")).toEqual([expect.objectContaining({ id: viva.id, acao: "RESPONDER", texto: "Posso ajudar?", expiraEm: viva.expiraEm!.toISOString() })]);
  });

  it("vendedor vê a pausa mas não recebe sugestões; fora do escopo devolve null", async () => {
    const c = await cenario();
    await c.sugerir({ expiraEm: new Date(Date.now() + 3_600_000) });
    expect(await carregarAriaDoAtendimento(c.vendedor, c.a.id)).toEqual({ pausada: false, motivo: null, podeDevolver: false, podeDecidir: false, cartoes: [], handoff: null });
    const estranho = await criarUsuario([Papel.FINANCEIRO]);
    expect(await carregarAriaDoAtendimento(estranho, c.a.id)).toBeNull();
  });

  it("gerente só vê sugestões que pode decidir (mesmo critério de aprovar/rejeitar)", async () => {
    const c = await cenario();
    const futuro = new Date(Date.now() + 3_600_000);
    const daEquipe = await c.sugerir({ expiraEm: futuro, texto: "da equipe" });
    const outroVendedor = await criarUsuario([Papel.VENDEDOR]);
    const outroLead = await prisma.oportunidade.create({ data: { nome: "João", vendedorDonoId: outroVendedor.id } });
    const deOutraEquipe = await c.sugerir({ expiraEm: futuro, texto: "outra equipe", oportunidadeId: outroLead.id });
    const r = await carregarAriaDoAtendimento(c.gerente, c.a.id);
    expect(r?.cartoes.filter(s=>s.status==="SUGERIDA").map((s) => s.id)).toEqual([daEquipe.id]);
    // O Admin vê as duas.
    const admin = await criarUsuario([Papel.ADMINISTRADOR]);
    expect((await carregarAriaDoAtendimento(admin, c.a.id))?.cartoes.filter(s=>s.status==="SUGERIDA").map((s) => s.id)).toEqual([daEquipe.id, deOutraEquipe.id]);
  });

  it("atendimento sem lead: gerente vê o atendimento sem sugestões; Admin as vê", async () => {
    const c = await cenario({ semLead: true });
    const s = await c.sugerir({ expiraEm: new Date(Date.now() + 3_600_000) });
    expect(await carregarAriaDoAtendimento(c.gerente, c.a.id)).toEqual({ pausada: false, motivo: null, podeDevolver: false, podeDecidir: false, cartoes: [], handoff: null });
    const admin = await criarUsuario([Papel.ADMINISTRADOR]);
    expect((await carregarAriaDoAtendimento(admin, c.a.id))?.cartoes.filter(s=>s.status==="SUGERIDA").map((x) => x.id)).toEqual([s.id]);
  });

  it("podeDevolver só com a Aria pausada e escopo de envio (mesma regra de devolverParaAria)", async () => {
    const c = await cenario();
    expect((await carregarAriaDoAtendimento(c.vendedor, c.a.id))?.podeDevolver).toBe(false);
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { iaPausadaEm: new Date(), iaPausaMotivo: "HUMANO_RESPONDEU" } });
    expect(await carregarAriaDoAtendimento(c.vendedor, c.a.id)).toMatchObject({ pausada: true, podeDevolver: true });
    expect(await podeDevolverParaAria(prisma, c.vendedor, c.a.id)).toBe(true);
    // Linha inativa: o vendedor ainda LÊ o atendimento (vê a pausa), mas não pode enviar por ele.
    await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { ativo: false } });
    expect(await carregarAriaDoAtendimento(c.vendedor, c.a.id)).toMatchObject({ pausada: true, podeDevolver: false });
    expect(await podeDevolverParaAria(prisma, c.vendedor, c.a.id)).toBe(false);
  });
});


describe("cartoes349 autorizados e DTO", () => {
  beforeEach(truncarBanco);
  const agora = new Date("2026-10-24T12:00:00Z"), dia = 86400000;
  it("vigentes e decisoes em24h, limite inclusivo e nomes em lote", async () => {
    const c = await cenario();
    const viva = await c.sugerir({ id: "349-a", expiraEm: null, texto: "Texto autorizado", criadoEm: new Date(agora.getTime() - 3) });
    const recente = await c.sugerir({ id: "349-b", status: "APROVADA", expiraEm: null, criadoEm: new Date(agora.getTime() - 2), decididaEm: new Date(agora.getTime() - dia), decididaPorId: c.gerente.id });
    await c.sugerir({ status: "REJEITADA", expiraEm: null, decididaEm: new Date(agora.getTime() - dia - 1), criadoEm: agora });
    await c.sugerir({ status: "APROVADA", expiraEm: null, decididaEm: null });
    await c.sugerir({ expiraEm: agora });
    const nomes = vi.spyOn(prisma.usuario, "findMany");
    try {
      const r = await carregarAriaDoAtendimento(c.gerente, c.a.id, agora);
      expect(r?.podeDecidir).toBe(true);
      expect(r?.cartoes.map(x => x.id)).toEqual([viva.id, recente.id]);
      expect(r?.cartoes[0]).toMatchObject({ texto: "Texto autorizado", detalhe: { tipo: "enviar", documento: false }, turnoId: viva.turnoId, status: "SUGERIDA", expiraEm: null, decididaPorNome: null });
      expect(r?.cartoes[1]).toMatchObject({ decididaPorId: c.gerente.id, decididaPorNome: c.gerente.nome, decididaEm: new Date(agora.getTime() - dia).toISOString() });
      expect(r?.cartoes[0]).not.toHaveProperty("payload");
      expect(nomes.mock.calls.filter(([q]) => q?.select && "nome" in q.select)).toHaveLength(1);
    } finally { nomes.mockRestore(); }
  });
  it("outra equipe e vendedor mantem alçada atual; estado segue visivel", async () => {
    const c = await cenario(); await c.sugerir({ expiraEm: null }); const outro = await criarUsuario([Papel.GERENTE_COMERCIAL]);
    expect(await carregarAriaDoAtendimento(outro, c.a.id, agora)).toMatchObject({ podeDecidir: false, cartoes: [], pausada: false });
    expect(await carregarAriaDoAtendimento(c.vendedor, c.a.id, agora)).toMatchObject({ podeDecidir: false, cartoes: [] });
  });
  it("podeDecidir usa lead do atendimento mesmo com cartao autorizado pela propria oportunidade", async () => {
    const c = await cenario({ semLead: true });
    const op = await prisma.oportunidade.create({ data: { nome: "Acao da equipe", vendedorDonoId: c.vendedor.id } });
    const s = await c.sugerir({ expiraEm: null, oportunidadeId: op.id });
    const r = await carregarAriaDoAtendimento(c.gerente, c.a.id, agora);
    expect(r?.podeDecidir).toBe(false); expect(r?.cartoes.map(x => x.id)).toEqual([s.id]);
  });
  it("expirar produz cartao recente EXPIRADA, sem decisor humano", async () => {
    const c = await cenario(), s = await c.sugerir({ expiraEm: new Date(agora.getTime() - 1) });
    expect((await carregarAriaDoAtendimento(c.gerente, c.a.id, agora))?.cartoes).toEqual([]);
    await expirarSugestoesAria(agora);
    expect((await carregarAriaDoAtendimento(c.gerente, c.a.id, agora))?.cartoes).toContainEqual(expect.objectContaining({ id: s.id, status: "EXPIRADA", decididaPorId: null, decididaPorNome: null, decididaEm: agora.toISOString() }));
  });
  it("primeiros20 AUTORIZADOS apos201 candidatos fora da equipe e desempate idASC", async () => {
    const c = await cenario(); const vendedor = await criarUsuario([Papel.VENDEDOR]); const fora = await prisma.oportunidade.create({ data: { nome: "Outra equipe", vendedorDonoId: vendedor.id } });
    const molde = await c.sugerir({ id: "349-proibido-000", expiraEm: null, oportunidadeId: fora.id, criadoEm: new Date(agora.getTime() - 1000) });
    await prisma.acaoAgenteIA.createMany({ data: Array.from({ length: 200 }, (_, n) => ({ id: "349-proibido-" + String(n + 1).padStart(3, "0"), turnoId: molde.turnoId, atendimentoId: c.a.id, oportunidadeId: fora.id, acao: "RESPONDER", modoConfigurado: "SUGERIR", status: "SUGERIDA", confianca: 70, payload: { texto: "NAO_VAZAR_FORA_349" }, reversivel: false, criadoEm: new Date(agora.getTime() - 1000) })) });
    const ids = Array.from({ length: 21 }, (_, n) => "349-visivel-" + String(n).padStart(2, "0"));
    await prisma.acaoAgenteIA.createMany({ data: ids.map(id => ({ id, turnoId: molde.turnoId, atendimentoId: c.a.id, oportunidadeId: c.lead!.id, acao: "RESPONDER", modoConfigurado: "SUGERIR", status: "SUGERIDA", confianca: 70, payload: { texto: "Permitido" }, reversivel: false, criadoEm: agora })) });
    const r = await carregarAriaDoAtendimento(c.gerente, c.a.id, agora);
    expect(r?.cartoes.map(x => x.id)).toEqual(ids.slice(0, 20));
    expect(JSON.stringify(r?.cartoes)).not.toContain("NAO_VAZAR_FORA_349");
  });
  it("cartoes usam o Db recebido em tx pool1, inclusive nome ainda nao commitado", async () => {
    const c = await cenario();
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("connection_limit", "1");
    const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    const molde = await c.sugerir({ expiraEm: null });
    try {
      await expect(db.$transaction(async tx => {
        const decisor = await tx.usuario.create({ data: { nome: "Decisor apenas TX", email: "349-tx@example.test", senhaHash: "fake", papeis: ["ADMINISTRADOR"] } });
        const s = await tx.acaoAgenteIA.create({ data: { id: "349-apenas-tx", turnoId: molde.turnoId, atendimentoId: c.a.id, oportunidadeId: c.lead!.id, acao: "RESPONDER", modoConfigurado: "SUGERIR", status: "APROVADA", confianca: 70, payload: { texto: "TX" }, reversivel: false, decididaPorId: decisor.id, decididaEm: agora } });
        const cartoes = await cartoesDaThread(tx, c.gerente, c.a, agora);
        expect(cartoes.find(x => x.id === s.id)).toMatchObject({ decididaPorNome: "Decisor apenas TX", texto: "TX" });
        throw Error("ROLLBACK_349");
      }, { timeout: 5000 })).rejects.toThrow("ROLLBACK_349");
      expect(await db.acaoAgenteIA.findUnique({ where: { id: "349-apenas-tx" } })).toBeNull();
      expect(await db.usuario.count({ where: { email: "349-tx@example.test" } })).toBe(0);
    } finally { await db.$disconnect(); }
  });

});

it("353 consulta_sem_sugestoes_legadas conserva somente contrato canônico autorizado",async()=>{
 await truncarBanco();const c=await cenario();const r=await carregarAriaDoAtendimento(c.gerente,c.a.id);expect(r).not.toHaveProperty("sugestoes");expect(Object.keys(r!).sort()).toEqual(["cartoes","handoff","motivo","pausada","podeDecidir","podeDevolver"]);
});