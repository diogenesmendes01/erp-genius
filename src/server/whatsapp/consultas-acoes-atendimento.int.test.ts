import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { convidarParticipante, revogarParticipante } from "./acoes-atendimento";
import { agendarMensagemNoAtendimento, cancelarAgendamentoDoAtendimento } from "./acoes-conversa";
import { listarConvitesEAgendamentos } from "./consultas-acoes-atendimento";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });
const como = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });

async function cenario() {
  const v1 = await criarUsuario([Papel.VENDEDOR], "Vend Um");
  const v2 = await criarUsuario([Papel.VENDEDOR], "Vend Dois");
  const gc = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL"], finalidade: "AGENDA", donoId: null });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL" }));
  await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { responsavelId: v1.id, status: "EM_ATENDIMENTO" } });
  return { v1, v2, gc, a };
}
const amanha = () => new Date(Date.now() + 86_400_000).toISOString();

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
