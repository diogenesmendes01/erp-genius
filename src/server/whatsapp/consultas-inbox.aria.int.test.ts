import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

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
  const sugerir = (o: { status?: "SUGERIDA" | "APROVADA"; expiraEm: Date | null; texto?: string; oportunidadeId?: string }) => prisma.acaoAgenteIA.create({
    data: { turnoId: turno.id, atendimentoId: a.id, oportunidadeId: o.oportunidadeId ?? null, acao: "RESPONDER", modoConfigurado: "SUGERIR", status: o.status ?? "SUGERIDA", confianca: 70, payload: { texto: o.texto ?? "Olá!" }, reversivel: false, expiraEm: o.expiraEm },
  });
  return { vendedor, gerente, a, lead, numero, sugerir };
}

describe("Aria no detalhe do atendimento (consulta do Inbox)", () => {
  beforeEach(truncarBanco);

  it("pausa e motivo vêm do atendimento; sem pausa o motivo é nulo", async () => {
    const c = await cenario();
    expect(await carregarAriaDoAtendimento(c.gerente, c.a.id)).toEqual({ pausada: false, motivo: null, podeDevolver: false, sugestoes: [] });
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { iaPausadaEm: new Date(), iaPausaMotivo: "CELULAR" } });
    expect(await carregarAriaDoAtendimento(c.gerente, c.a.id)).toMatchObject({ pausada: true, motivo: "CELULAR" });
  });

  it("lista só sugestões SUGERIDAS e não vencidas, para quem decide o histórico", async () => {
    const c = await cenario();
    const viva = await c.sugerir({ expiraEm: new Date(Date.now() + 3_600_000), texto: "Posso ajudar?" });
    await c.sugerir({ expiraEm: new Date(Date.now() - 1000) });
    await c.sugerir({ status: "APROVADA", expiraEm: null });
    const r = await carregarAriaDoAtendimento(c.gerente, c.a.id);
    expect(r?.sugestoes).toEqual([{ id: viva.id, acao: "RESPONDER", resumo: "Posso ajudar?", expiraEm: viva.expiraEm!.toISOString() }]);
  });

  it("vendedor vê a pausa mas não recebe sugestões; fora do escopo devolve null", async () => {
    const c = await cenario();
    await c.sugerir({ expiraEm: new Date(Date.now() + 3_600_000) });
    expect(await carregarAriaDoAtendimento(c.vendedor, c.a.id)).toEqual({ pausada: false, motivo: null, podeDevolver: false, sugestoes: [] });
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
    expect(r?.sugestoes.map((s) => s.id)).toEqual([daEquipe.id]);
    // O Admin vê as duas.
    const admin = await criarUsuario([Papel.ADMINISTRADOR]);
    expect((await carregarAriaDoAtendimento(admin, c.a.id))?.sugestoes.map((s) => s.id)).toEqual([daEquipe.id, deOutraEquipe.id]);
  });

  it("atendimento sem lead: gerente vê o atendimento sem sugestões; Admin as vê", async () => {
    const c = await cenario({ semLead: true });
    const s = await c.sugerir({ expiraEm: new Date(Date.now() + 3_600_000) });
    expect(await carregarAriaDoAtendimento(c.gerente, c.a.id)).toEqual({ pausada: false, motivo: null, podeDevolver: false, sugestoes: [] });
    const admin = await criarUsuario([Papel.ADMINISTRADOR]);
    expect((await carregarAriaDoAtendimento(admin, c.a.id))?.sugestoes.map((x) => x.id)).toEqual([s.id]);
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
