import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (2º lote): o painel "Nova tarefa" chama `criarTarefa` com chave de idempotência. O reenvio com a
// mesma chave não cria segunda tarefa (nem segundo lembrete, que mora na própria tarefa) nem Evento.

// Sessão: só `exigirSessao` é trocada (mesmo motivo de comercial/criar-lead-idempotencia.int.test.ts).
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  return {
    ...o,
    exigirSessao: async () => {
      const u = await o.carregarUsuarioFresco(sessao.usuarioId);
      if (!u) throw new o.ErroAutenticacao();
      return u;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { criarTarefa } from "./tarefas";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outroVendedor: Awaited<ReturnType<typeof criarUsuario>>;
let op: string;

async function contagens() {
  return {
    tarefas: await prisma.tarefa.count(),
    lembretes: await prisma.tarefa.count({ where: { lembrarEm: { not: null } } }),
    eventos: await prisma.evento.count(),
    criadas: await prisma.evento.count({ where: { tipo: "TarefaCriada", agregadoTipo: "Tarefa" } }),
  };
}

beforeAll(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.upsert({
    where: { id: "escola" },
    create: { id: "escola", fusoInstitucional: "America/Costa_Rica" },
    update: { fusoInstitucional: "America/Costa_Rica" },
  });
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outroVendedor = await criarUsuario([Papel.VENDEDOR], "Outro vendedor");
  op = (await prisma.oportunidade.create({ data: { nome: "Minha", vendedorDonoId: vendedor.id } })).id;
});

beforeEach(() => {
  sessao.usuarioId = vendedor.id;
});

const comLembrete = { tipo: "LIGACAO" as const, dataCivil: "2026-10-20", hora: "09:00", lembreteAntecedenciaMin: 30 as const };

describe("criarTarefa com chave de idempotência (#166)", () => {
  it("a mesma chave duas vezes cria uma tarefa, um lembrete e um Evento, e devolve o mesmo resultado", async () => {
    const entrada = { titulo: "Ligar para a Ana", ...comLembrete, leadId: op, chaveIdempotencia: "chave-tarefa-0001" };
    const antes = await contagens();
    const primeira = await criarTarefa(entrada);
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    const depoisDaPrimeira = await contagens();
    expect(depoisDaPrimeira.tarefas - antes.tarefas).toBe(1);
    expect(depoisDaPrimeira.lembretes - antes.lembretes).toBe(1);
    expect(depoisDaPrimeira.criadas - antes.criadas).toBe(1);

    const segunda = await criarTarefa(entrada);
    expect(segunda).toEqual(primeira);
    expect(await contagens()).toEqual(depoisDaPrimeira);
  });

  it("dois envios simultâneos com a mesma chave criam uma só tarefa", async () => {
    const entrada = { titulo: "Enviar proposta", ...comLembrete, chaveIdempotencia: "chave-tarefa-0002" };
    const antes = await contagens();
    const [a, b] = await Promise.all([criarTarefa(entrada), criarTarefa(entrada)]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    const depois = await contagens();
    expect(depois.tarefas - antes.tarefas).toBe(1);
    expect(depois.criadas - antes.criadas).toBe(1);
  });

  it("recusa a mesma chave com outra entrada, sem gravar nada", async () => {
    expect((await criarTarefa({ titulo: "Retornar", tipo: "OUTRO", chaveIdempotencia: "chave-tarefa-0003" })).ok).toBe(true);
    const antes = await contagens();
    const outra = await criarTarefa({ titulo: "Retornar amanhã", tipo: "OUTRO", chaveIdempotencia: "chave-tarefa-0003" });
    expect(outra.ok).toBe(false);
    if (!outra.ok) expect(outra.erro).toMatch(/já foi usada/);
    expect(await contagens()).toEqual(antes);
  });

  it("chaves diferentes criam tarefas diferentes, e a chave é de cada autor", async () => {
    const antes = await contagens();
    const a = await criarTarefa({ titulo: "Igual", tipo: "OUTRO", chaveIdempotencia: "chave-tarefa-0004" });
    const b = await criarTarefa({ titulo: "Igual", tipo: "OUTRO", chaveIdempotencia: "chave-tarefa-0005" });
    sessao.usuarioId = outroVendedor.id;
    const c = await criarTarefa({ titulo: "Igual", tipo: "OUTRO", chaveIdempotencia: "chave-tarefa-0004" });
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, true]);
    expect(new Set([a, b, c].map((r) => (r.ok ? r.dado!.id : ""))).size).toBe(3);
    expect((await contagens()).tarefas - antes.tarefas).toBe(3);
  });

  it("sem chave continua criando como antes; chave curta é recusada", async () => {
    const antes = await contagens();
    expect((await criarTarefa({ titulo: "Sem chave", tipo: "OUTRO" })).ok).toBe(true);
    expect((await criarTarefa({ titulo: "Sem chave", tipo: "OUTRO" })).ok).toBe(true);
    expect((await contagens()).tarefas - antes.tarefas).toBe(2);
    expect((await criarTarefa({ titulo: "Curta", tipo: "OUTRO", chaveIdempotencia: "curta" })).ok).toBe(false);
  });
});
