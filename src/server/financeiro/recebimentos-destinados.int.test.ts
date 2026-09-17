import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario; } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarRecebimentoDestinado } from "./acoes";

let financeiroId = "", matriculaId = "", moeda = "CRC", c1 = "", c2 = "";
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

beforeEach(async () => {
  await truncarBanco();
  financeiroId = (await criarUsuario([Papel.FINANCEIRO], "Caixa Q87")).id;
  const catalogo = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", sobrenome: "Q87", paisId: catalogo.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda } })).id;
  c1 = (await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", moeda, valorOriginal: 100, valorNegociado: 100, saldo: 100, vencimento: new Date("2099-10-01") } })).id;
  c2 = (await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", moeda, valorOriginal: 80, valorNegociado: 80, saldo: 80, vencimento: new Date("2099-11-01") } })).id;
  entrar(financeiroId);
});

const entrada = (chaveIdempotencia = "q87-recebimento-destinado-0001") => ({
  titularMatriculaId: matriculaId, chaveIdempotencia, valorRecebido: 150, moeda, forma: "DINHEIRO" as const,
  dataPagamento: new Date("2099-09-10T12:00:00Z"), comentario: "Conferência de caixa Q87", destinos: [
    { tipo: "COBRANCA" as const, cobrancaId: c1, valor: 100, evidencia: "Recibo identifica a mensalidade de outubro.", chaveIdempotencia: `cobranca:${c1}` },
    { tipo: "COBRANCA" as const, cobrancaId: c2, valor: 30, evidencia: "Recibo identifica a antecipação de novembro.", chaveIdempotencia: `cobranca:${c2}` },
    { tipo: "CREDITO_SEM_DESTINO" as const, valor: 20, evidencia: "Saldo antecipado sem cobrança definida.", chaveIdempotencia: "credito-sem-destino" },
  ],
});

it("divide um fato de caixa em dois períodos e crédito explícito, sem duplicar o caixa no replay", async () => {
  const [primeiro, repetido] = await Promise.all([registrarRecebimentoDestinado(entrada()), registrarRecebimentoDestinado(entrada())]);
  expect(primeiro.ok && repetido.ok).toBe(true);
  if (!primeiro.ok || !repetido.ok) throw new Error("Recebimento não criado");
  expect(primeiro.dado?.recebimentoId).toBe(repetido.dado?.recebimentoId);
  expect(await prisma.recebimento.count()).toBe(1);
  const recebimento = await prisma.recebimento.findUniqueOrThrow({ where: { id: primeiro.dado!.recebimentoId }, include: { destinacoes: { orderBy: { chaveIdempotencia: "asc" } } } });
  expect(recebimento).toMatchObject({ cobrancaId: null, titularMatriculaId: matriculaId, moeda, valor: expect.anything() });
  expect(recebimento.destinacoes).toHaveLength(3);
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c1 } })).saldo!.toFixed(2)).toBe("0.00");
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c2 } })).saldo!.toFixed(2)).toBe("50.00");
  const credito = await prisma.creditoMatricula.findFirstOrThrow({ where: { matriculaId } });
  expect(credito.valorInicial.toFixed(2)).toBe("20.00");
});

it("recusa cobrança de outro contrato ou moeda antes de criar caixa", async () => {
  const original = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outra = await prisma.matricula.create({ data: { alunoId: original.alunoId, produtoId: original.produtoId, paisId: original.paisId, moeda: "USD" } });
  const estrangeira = await prisma.cobranca.create({ data: { matriculaId: outra.id, tipo: "MENSALIDADE", moeda: "USD", valorOriginal: 10, valorNegociado: 10, saldo: 10, vencimento: new Date("2099-10-01") } });
  const r = await registrarRecebimentoDestinado({ ...entrada("q87-contrato-estrangeiro-0001"), destinos: [{ tipo: "COBRANCA", cobrancaId: estrangeira.id, valor: 150, evidencia: "Tentativa adversarial de misturar contrato e moeda.", chaveIdempotencia: `cobranca:${estrangeira.id}` }] });
  expect(r).toMatchObject({ ok: false });
  expect(await prisma.recebimento.count()).toBe(0);
});
