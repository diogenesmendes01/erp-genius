import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { listarNotificacoes, marcarNotificacaoLida } from "./notificacoes";

let v1: Awaited<ReturnType<typeof criarUsuario>>;
const logado = (id: string) => authMock.mockResolvedValue({ user: { id } });
const notif = (tipo: "SLA_ESTOURADO" | "LEMBRETE_TAREFA", refId: string) => prisma.notificacaoUsuario.create({
  data: { usuarioId: v1.id, tipo, refTipo: tipo === "SLA_ESTOURADO" ? "AtendimentoWhatsApp" : "Tarefa", refId, titulo: "Aviso" },
});

beforeEach(async () => {
  await truncarBanco();
  v1 = await criarUsuario([Papel.VENDEDOR], "V1");
});

describe("notificação de SLA", () => {
  it("lida_de_sla_audita_no_atendimento", async () => {
    const n = await notif("SLA_ESTOURADO", "at1");
    logado(v1.id);
    expect((await marcarNotificacaoLida(n.id)).ok).toBe(true);
    const ev = (await eventosDo("AtendimentoWhatsApp", "at1")).at(-1);
    expect(ev).toMatchObject({ tipo: "NotificacaoLida", agregadoTipo: "AtendimentoWhatsApp", agregadoId: "at1", autorId: v1.id });
    expect(await eventosDo("Tarefa", "at1")).toHaveLength(0);
  });

  it("lida_de_lembrete_continua_na_tarefa", async () => {
    const n = await notif("LEMBRETE_TAREFA", "t1");
    logado(v1.id);
    await marcarNotificacaoLida(n.id);
    expect((await eventosDo("Tarefa", "t1")).at(-1)).toMatchObject({ tipo: "NotificacaoLida", agregadoTipo: "Tarefa" });
  });

  it("lista_traz_tipo_e_refTipo", async () => {
    await notif("SLA_ESTOURADO", "at1");
    const [item] = await listarNotificacoes({ id: v1.id, papeis: [Papel.VENDEDOR] } as never);
    expect(item).toMatchObject({ tipo: "SLA_ESTOURADO", refTipo: "AtendimentoWhatsApp", refId: "at1" });
  });

  it("duas_notificacoes_do_mesmo_aviso_na_mesma_transacao", async () => {
    const g = await criarUsuario([Papel.GERENTE_COMERCIAL], "G");
    await prisma.$transaction(async (tx) => {
      for (const usuarioId of [v1.id, g.id]) await tx.notificacaoUsuario.create({ data: { usuarioId, tipo: "SLA_ESTOURADO", refTipo: "AtendimentoWhatsApp", refId: "at1", titulo: "x" } });
    });
    expect(await prisma.notificacaoUsuario.count({ where: { refId: "at1" } })).toBe(2);
  });
});
