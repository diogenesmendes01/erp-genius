import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { rodarLembretesTarefas, adiarLembrete } from "./lembretes";
import { listarNotificacoes, marcarNotificacaoLida } from "./notificacoes";

const logadoComo = (id: string) => authMock.mockResolvedValue({ user: { id } });

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outro: Awaited<ReturnType<typeof criarUsuario>>;
const agora = new Date("2026-10-15T15:00:00Z");

async function tarefa(extra: Record<string, unknown> = {}) {
  return (await prisma.tarefa.create({
    data: {
      titulo: "Ligar", tipo: "LIGACAO", setor: "COMERCIAL", fusoOrigem: "America/Costa_Rica",
      responsavelId: vendedor.id, lembrarEm: new Date(agora.getTime() - 60000), ...extra,
    },
  })).id;
}

beforeEach(async () => {
  await truncarBanco();
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro");
});

describe("rodarLembretesTarefas", () => {
  it("claim do lembrete é idempotente", async () => {
    const id = await tarefa();
    const [a, b] = await Promise.all([rodarLembretesTarefas(agora), rodarLembretesTarefas(agora)]);
    expect(a.notificadas + b.notificadas).toBe(1);
    expect(await prisma.notificacaoUsuario.count({ where: { refId: id } })).toBe(1);
    expect((await rodarLembretesTarefas(agora)).notificadas).toBe(0);
    expect((await prisma.tarefa.findUniqueOrThrow({ where: { id } })).lembreteDisparadoEm).not.toBeNull();
  });
  it("não notifica tarefa concluída, sem responsável, futura ou já disparada", async () => {
    await tarefa({ status: "CONCLUIDA" });
    await tarefa({ responsavelId: null });
    await tarefa({ lembrarEm: new Date(agora.getTime() + 60000) });
    await tarefa({ lembreteDisparadoEm: new Date() });
    expect((await rodarLembretesTarefas(agora)).notificadas).toBe(0);
    expect(await prisma.notificacaoUsuario.count()).toBe(0);
  });
  it("notifica o responsável", async () => {
    const id = await tarefa({ titulo: "Retornar proposta" });
    await rodarLembretesTarefas(agora);
    const n = await prisma.notificacaoUsuario.findFirstOrThrow({ where: { refId: id } });
    expect(n).toMatchObject({ usuarioId: vendedor.id, tipo: "LEMBRETE_TAREFA", refTipo: "Tarefa", titulo: "Retornar proposta" });
  });
});

describe("adiarLembrete", () => {
  it("adiar reabre o lembrete com Evento", async () => {
    const id = await tarefa({ lembreteDisparadoEm: new Date() });
    logadoComo(vendedor.id);
    const antes = Date.now();
    expect((await adiarLembrete(id, 10)).ok).toBe(true);
    const t = await prisma.tarefa.findUniqueOrThrow({ where: { id } });
    expect(t.lembreteDisparadoEm).toBeNull();
    expect(t.lembrarEm!.getTime()).toBeGreaterThanOrEqual(antes + 10 * 60000);
    expect(t.lembrarEm!.getTime()).toBeLessThan(antes + 10 * 60000 + 10000);
    expect((await eventosDo("Tarefa", id)).at(-1)!.tipo).toBe("LembreteAdiado");
  });
  it("recusa tarefa concluída e tarefa fora do escopo", async () => {
    const fechada = await tarefa({ status: "CONCLUIDA" });
    const alheia = await tarefa({ responsavelId: outro.id });
    logadoComo(vendedor.id);
    expect((await adiarLembrete(fechada, 60)).ok).toBe(false);
    expect((await adiarLembrete(alheia, 60)).ok).toBe(false);
  });
});

describe("notificações", () => {
  it("lista as 20 últimas só do usuário e marca como lida", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 22; i++) {
      const n = await prisma.notificacaoUsuario.create({
        data: { usuarioId: vendedor.id, tipo: "LEMBRETE_TAREFA", refTipo: "Tarefa", refId: `t${i}`, titulo: `N${i}`, criadaEm: new Date(agora.getTime() + i * 1000) },
      });
      ids.push(n.id);
    }
    const alheia = await prisma.notificacaoUsuario.create({ data: { usuarioId: outro.id, tipo: "LEMBRETE_TAREFA", refTipo: "Tarefa", refId: "x", titulo: "X" } });
    const lista = await listarNotificacoes({ id: vendedor.id, papeis: [Papel.VENDEDOR] } as never);
    expect(lista).toHaveLength(20);
    expect(lista[0].titulo).toBe("N21");
    expect(lista.every((n) => !n.lida)).toBe(true);
    logadoComo(vendedor.id);
    expect((await marcarNotificacaoLida(ids[21])).ok).toBe(true);
    expect((await marcarNotificacaoLida(alheia.id)).ok).toBe(false);
    expect((await listarNotificacoes({ id: vendedor.id, papeis: [Papel.VENDEDOR] } as never))[0].lida).toBe(true);
  });
});
