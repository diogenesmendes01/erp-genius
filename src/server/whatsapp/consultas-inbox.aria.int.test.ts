import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { carregarAriaDoAtendimento } from "./consultas-inbox";

async function cenario() {
  const vendedor = await criarUsuario([Papel.VENDEDOR]);
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL]);
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const lead = await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: "+50688888888", vendedorDonoId: vendedor.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
  const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id }, select: { conversaId: true } });
  const ancora = await prisma.mensagemWhatsApp.create({
    data: { atendimentoId: a.id, conversaId: conv.conversaId, numeroId: numero.id, direcao: "ENTRADA", corpo: "oi", driver: "MOTOR", status: "ENTREGUE", providerMessageId: "aria-ins-1" },
  });
  const turno = await prisma.turnoAgenteIA.create({ data: { ancoraMensagemId: ancora.id, atendimentoId: a.id, tipo: "ATENDIMENTO", resultado: "SUGERIU" } });
  const sugerir = (o: { status?: "SUGERIDA" | "APROVADA"; expiraEm: Date | null; texto?: string }) => prisma.acaoAgenteIA.create({
    data: { turnoId: turno.id, atendimentoId: a.id, acao: "RESPONDER", modoConfigurado: "SUGERIR", status: o.status ?? "SUGERIDA", confianca: 70, payload: { texto: o.texto ?? "Olá!" }, reversivel: false, expiraEm: o.expiraEm },
  });
  return { vendedor, gerente, a, sugerir };
}

describe("Aria no detalhe do atendimento (consulta do Inbox)", () => {
  beforeEach(truncarBanco);

  it("pausa e motivo vêm do atendimento; sem pausa o motivo é nulo", async () => {
    const c = await cenario();
    expect(await carregarAriaDoAtendimento(c.gerente, c.a.id)).toEqual({ pausada: false, motivo: null, sugestoes: [] });
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
    expect(await carregarAriaDoAtendimento(c.vendedor, c.a.id)).toEqual({ pausada: false, motivo: null, sugestoes: [] });
    const estranho = await criarUsuario([Papel.FINANCEIRO]);
    expect(await carregarAriaDoAtendimento(estranho, c.a.id)).toBeNull();
  });
});
