import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { diaUtilAs } from "@/test/janela-envio";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { convidarParticipante, revogarParticipante } from "./acoes-atendimento";
import { agendarMensagemNoAtendimento, cancelarAgendamentoDoAtendimento } from "./acoes-conversa";
import { contatosParaCartao, listarConvitesEAgendamentos } from "./consultas-acoes-atendimento";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });
const como = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });

async function cenario(finalidade: "AGENDA" | "VENDAS" = "AGENDA") {
  const v1 = await criarUsuario([Papel.VENDEDOR], "Vend Um");
  const v2 = await criarUsuario([Papel.VENDEDOR], "Vend Dois");
  const gc = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL"], finalidade, donoId: null });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL" }));
  await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { responsavelId: v1.id, status: "EM_ATENDIMENTO" } });
  return { v1, v2, gc, a, numero };
}
const amanha = () => diaUtilAs(10).toISOString();

describe("convites e agendamentos do atendimento (Task 31)", () => {
  it("lista o convite ativo para quem concedeu e para o gerente, e não para um terceiro; revogar o tira da lista", async () => {
    const { v1, v2, gc, a } = await cenario();
    como(v1);
    const r = await convidarParticipante({ atendimentoId: a.id, usuarioId: v2.id, podeEnviar: false, fim: amanha(), motivo: "ajudar no atendimento" });
    expect(r.ok).toBe(true);
    expect((await listarConvitesEAgendamentos(a.id)).convites).toMatchObject([{ nome: "Vend Dois", podeEnviar: false }]);
    como(gc);
    expect((await listarConvitesEAgendamentos(a.id)).convites).toHaveLength(1);
    como(v2);
    expect((await listarConvitesEAgendamentos(a.id)).convites).toHaveLength(0);
    como(v1);
    const id = (await listarConvitesEAgendamentos(a.id)).convites[0].id;
    expect((await revogarParticipante(id)).ok).toBe(true);
    expect((await listarConvitesEAgendamentos(a.id)).convites).toHaveLength(0);
  });

  it("lista a mensagem agendada só para o autor; cancelar a tira da lista e outro autor não cancela", async () => {
    const { v1, gc, a } = await cenario();
    como(v1);
    const r = await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "Lembrete da matrícula", quando: amanha() });
    expect(r).toMatchObject({ ok: true });
    const { agendamentos } = await listarConvitesEAgendamentos(a.id);
    expect(agendamentos).toMatchObject([{ texto: "Lembrete da matrícula" }]);
    como(gc);
    expect((await listarConvitesEAgendamentos(a.id)).agendamentos).toHaveLength(0);
    expect((await cancelarAgendamentoDoAtendimento({ atendimentoId: a.id, intencaoId: agendamentos[0].id })).ok).toBe(false);
    como(v1);
    expect((await cancelarAgendamentoDoAtendimento({ atendimentoId: a.id, intencaoId: agendamentos[0].id })).ok).toBe(true);
    expect((await listarConvitesEAgendamentos(a.id)).agendamentos).toHaveLength(0);
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: agendamentos[0].id } })).toMatchObject({ status: "CANCELADA" });
  });
});

const cartao = (n: { id: string; rotulo: string; telefoneE164: string }) => ({ id: n.id, rotulo: n.rotulo, telefoneE164: n.telefoneE164, contatoJid: `${n.telefoneE164.slice(1)}@s.whatsapp.net` });

describe("contatosParaCartao", () => {
  it("lista os números ativos do setor com o JID; inativo fica de fora", async () => {
    const { v1, a, numero } = await cenario("VENDAS");
    await criarNumeroSetor({ telefoneE164: "+5511999990002", setores: ["COMERCIAL"] }).then((n) => prisma.numeroWhatsApp.update({ where: { id: n.id }, data: { ativo: false } }));
    como(v1);
    expect(await contatosParaCartao(a.id)).toEqual([{ id: numero.id, rotulo: "Número +5511999990001", telefoneE164: "+5511999990001", contatoJid: "5511999990001@s.whatsapp.net" }]);
  });

  it("ordena pelo rótulo e deixa de fora o número excluído", async () => {
    const { v1, a, numero } = await cenario("VENDAS");
    const outro = await criarNumeroSetor({ telefoneE164: "+5511999990003", setores: ["COMERCIAL", "SECRETARIA"] });
    await prisma.numeroWhatsApp.update({ where: { id: outro.id }, data: { rotulo: "Atendimento geral" } });
    const excluido = await criarNumeroSetor({ telefoneE164: "+5511999990004", setores: ["COMERCIAL"] });
    await prisma.numeroWhatsApp.update({ where: { id: excluido.id }, data: { excluidoEm: new Date() } });
    como(v1);
    expect((await contatosParaCartao(a.id)).map((c) => c.id)).toEqual([outro.id, numero.id]);
  });

  it("linha pessoal de outro vendedor, linha AGENDA, linha de avisos da agenda e número de outro setor ficam de fora", async () => {
    const { v1, v2, a, numero } = await cenario("VENDAS");
    await criarNumeroSetor({ telefoneE164: "+5511999990005", setores: ["COMERCIAL"], donoId: v2.id });
    await criarNumeroSetor({ telefoneE164: "+5511999990006", setores: ["COMERCIAL"], donoId: v1.id });
    await criarNumeroSetor({ telefoneE164: "+5511999990007", setores: ["COMERCIAL"], finalidade: "AGENDA" });
    const avisos = await criarNumeroSetor({ telefoneE164: "+5511999990008", setores: ["COMERCIAL"] });
    await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", numeroAvisosAgendaId: avisos.id }, update: { numeroAvisosAgendaId: avisos.id } });
    await criarNumeroSetor({ telefoneE164: "+5511999990009", setores: ["FINANCEIRO"] });
    await criarNumeroSetor({ telefoneE164: "+5511999990010", setores: [], finalidade: "COBRANCA" });
    como(v1);
    expect(await contatosParaCartao(a.id)).toEqual([cartao(numero)]);
  });

  it("sem escopo de envio: lista vazia", async () => {
    const { v2, a } = await cenario("VENDAS");
    como(v2);
    expect(await contatosParaCartao(a.id)).toEqual([]);
  });

  it("atendimento encerrado: lista vazia", async () => {
    const { v1, a } = await cenario("VENDAS");
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { status: "ENCERRADO", encerradoEm: new Date() } });
    como(v1);
    expect(await contatosParaCartao(a.id)).toEqual([]);
  });

  it("número da conversa que não é MOTOR: lista vazia", async () => {
    const { v1, a, numero } = await cenario("VENDAS");
    await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { driver: "META_CLOUD" } });
    como(v1);
    expect(await contatosParaCartao(a.id)).toEqual([]);
  });
});
