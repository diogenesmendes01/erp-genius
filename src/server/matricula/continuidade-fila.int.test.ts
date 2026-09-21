import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { consultarFilaContinuidadeMensal } from "./continuidade-fila";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });

it.each([Papel.PROFESSOR, Papel.VENDEDOR, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_COMERCIAL])("não abre a fila financeira para %s", async papel => {
  const usuario = await criarUsuario([papel]);
  authMock.mockResolvedValue({ user: { id: usuario.id } });
  expect(await consultarFilaContinuidadeMensal({})).toMatchObject({ ok: false });
});

it("revoga a leitura sem depender de atualizar a sessão", async () => {
  const usuario = await criarUsuario([Papel.FINANCEIRO]);
  authMock.mockResolvedValue({ user: { id: usuario.id } });
  expect(await consultarFilaContinuidadeMensal({})).toMatchObject({ ok: true });
  await prisma.usuario.update({ where: { id: usuario.id }, data: { papeis: [Papel.PROFESSOR] } });
  expect(await consultarFilaContinuidadeMensal({})).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: usuario.id }, data: { papeis: [Papel.FINANCEIRO], ativo: false } });
  expect(await consultarFilaContinuidadeMensal({})).toMatchObject({ ok: false });
});

it("pagina matrículas legadas em conferência sem esconder as seguintes nem criar cobranças", async () => {
  const usuario = await criarUsuario([Papel.ADMINISTRADOR]);
  authMock.mockResolvedValue({ user: { id: usuario.id } });
  const c = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno sintético", paisId: c.pais.id } });
  for (let i = 0; i < 21; i++) {
    const m = await prisma.matricula.create({ data: { id: `fila-${String(i).padStart(2, "0")}`, alunoId: aluno.id, paisId: c.pais.id, produtoId: c.produto.id, status: "ATIVA", moeda: "CRC" } });
    await prisma.cobranca.create({ data: { matriculaId: m.id, tipo: "MENSALIDADE", moeda: "CRC", valorOriginal: 100, valorNegociado: 100, vencimento: new Date("2026-10-05T00:00:00Z") } });
  }
  const antes = { cobrancas: await prisma.cobranca.count(), eventos: await prisma.evento.count() };
  const primeira = await consultarFilaContinuidadeMensal({});
  if (!primeira.ok || !primeira.dado) throw new Error(JSON.stringify(primeira));
  expect(primeira.dado.itens).toHaveLength(20);
  expect(primeira.dado.itens.every(i => i.estado === "A_CONFERIR")).toBe(true);
  expect(primeira.dado.proximoCursor).toBeTruthy();
  const segunda = await consultarFilaContinuidadeMensal({ cursor: primeira.dado.proximoCursor! });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  expect(segunda.dado.itens).toHaveLength(1);
  expect(segunda.dado.proximoCursor).toBeNull();
  expect(new Set([...primeira.dado.itens, ...segunda.dado.itens].map(i => i.matriculaId)).size).toBe(21);
  expect({ cobrancas: await prisma.cobranca.count(), eventos: await prisma.evento.count() }).toEqual(antes);
});
