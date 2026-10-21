import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (4º lote): criar turma recebe chave de idempotência. O reenvio da mesma tentativa devolve a turma já criada
// (um código, um Evento); a mesma chave com outros dados é recusada.

// Sessão: só `exigirSessao`/`exigirSessaoComPapel` são trocadas (mesmo motivo de
// comercial/criar-lead-idempotencia.int.test.ts); os papéis continuam lidos do banco.
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  const exigirSessao = async () => {
    const u = await o.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new o.ErroAutenticacao();
    return u;
  };
  return { ...o, exigirSessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const u = await exigirSessao(); o.exigirPapel(u, ...papeis); return u; } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarTurma } from "./acoes";

let modalidadeId: string;
let nivelId: string;

beforeEach(async () => {
  await truncarBanco();
  const c = await seedCatalogoMinimo();
  modalidadeId = c.modalidade.id;
  nivelId = (await prisma.nivel.create({ data: { idiomaId: c.idioma.id, codigo: "A1", ordem: 1 } })).id;
  sessao.usuarioId = (await criarUsuario([Papel.ADMINISTRADOR], "Adm")).id;
});

const entrada = (chaveIdempotencia?: string) => ({
  modalidadeId, nivelId, diasSemana: [1, 3], horarioInicio: "10:00", horarioFim: "12:00",
  dataInicio: new Date("2099-10-01T00:00:00Z"), dataFim: new Date("2099-12-01T00:00:00Z"), capacidade: 12, chaveIdempotencia,
});
const criadas = () => prisma.evento.count({ where: { tipo: "TurmaCriada" } });

describe("criarTurma com chave (#166)", () => {
  it("a mesma chave, inclusive simultânea, cria uma turma e devolve o mesmo id", async () => {
    const [a, b] = await Promise.all([criarTurma(entrada("chave-turma-01")), criarTurma(entrada("chave-turma-01"))]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    expect(await criarTurma(entrada("chave-turma-01"))).toEqual(a);
    expect(await prisma.turma.count()).toBe(1);
    expect(await criadas()).toBe(1);
  });

  it("recusa a mesma chave com outros dados; sem chave cria como antes", async () => {
    expect((await criarTurma(entrada("chave-turma-02"))).ok).toBe(true);
    const outra = await criarTurma({ ...entrada("chave-turma-02"), capacidade: 20 });
    expect(outra.ok).toBe(false);
    if (!outra.ok) expect(outra.erro).toMatch(/já foi usada/);
    expect(await prisma.turma.count()).toBe(1);
    expect((await criarTurma(entrada())).ok).toBe(true);
    expect((await criarTurma(entrada())).ok).toBe(true);
    expect(await prisma.turma.count()).toBe(3);
  });
});
