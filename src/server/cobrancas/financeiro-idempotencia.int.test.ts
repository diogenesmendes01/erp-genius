import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, TipoAjuste, Vigencia } from "@prisma/client";

// #166 (3º lote): ações financeiras que gravam registro ou Evento a cada envio recebem chave de idempotência.
// - Promessa de pagamento (Inbox, `registrarPromessaPagamento`): o reenvio não grava segunda promessa.
// - Ajuste de cobrança (`ajustarCobranca`): o reenvio não aplica o ajuste de novo nem abre segundo pedido de
//   aprovação; a mesma chave com outra entrada é recusada.

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
import { registrarPromessaPagamento } from "./acoes";
import { ajustarCobranca } from "@/server/ajustes/acoes";

type Usuario = Awaited<ReturnType<typeof criarUsuario>>;
let fin: Usuario;
let finSemAlcada: Usuario;
let matriculaId: string;
const entrar = (u: { id: string }) => { sessao.usuarioId = u.id; };
const amanha = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function mensalidade(competencia = "2026-11") {
  return prisma.cobranca.create({ data: {
    matriculaId, tipo: "MENSALIDADE", status: "PENDENTE", moeda: "CRC", competencia, vencimento: new Date(Date.now() + 10 * 86_400_000),
    valorOriginal: 100, valorNegociado: 100, valorRecebido: 0, saldo: 100,
  } });
}

beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Sao_Paulo" } });
  fin = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  finSemAlcada = await criarUsuario([Papel.FINANCEIRO], "Financeiro sem alçada");
  await prisma.usuario.update({ where: { id: fin.id }, data: { limiteDescontoMensalidadePct: 100 } });
  const catalogo = await seedCatalogoMinimo();
  const alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Pessoa", sobrenome: "Teste", paisId: catalogo.pais.id, status: "ATIVO" } })).id;
  matriculaId = (await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", mesesPlano: 6,
  } })).id;
  entrar(fin);
});

describe("registrarPromessaPagamento com chave (#166)", () => {
  const promessas = () => prisma.evento.count({ where: { tipo: "PromessaPagamento" } });

  it("a mesma chave (inclusive em envio simultâneo) grava uma promessa só e devolve o mesmo resultado", async () => {
    const c = await mensalidade();
    const [a, b] = await Promise.all([
      registrarPromessaPagamento(c.id, amanha(), "chave-promessa-01"),
      registrarPromessaPagamento(c.id, amanha(), "chave-promessa-01"),
    ]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(await registrarPromessaPagamento(c.id, amanha(), "chave-promessa-01")).toEqual(a);
    expect(await promessas()).toBe(1);
  });

  it("recusa a mesma chave com outra data ou outra cobrança; sem chave grava como antes", async () => {
    const c = await mensalidade();
    const outra = await mensalidade("2026-12");
    expect((await registrarPromessaPagamento(c.id, amanha(), "chave-promessa-02")).ok).toBe(true);
    const outraData = await registrarPromessaPagamento(c.id, emDias(3), "chave-promessa-02");
    const outraCobranca = await registrarPromessaPagamento(outra.id, amanha(), "chave-promessa-02");
    expect([outraData.ok, outraCobranca.ok]).toEqual([false, false]);
    if (!outraData.ok) expect(outraData.erro).toMatch(/já foi usada/);
    expect(await promessas()).toBe(1);
    expect((await registrarPromessaPagamento(c.id, emDias(2))).ok).toBe(true);
    expect((await registrarPromessaPagamento(c.id, emDias(2))).ok).toBe(true);
    expect(await promessas()).toBe(3);
  });
});

describe("ajustarCobranca com chave (#166)", () => {
  const desconto = (cobrancaId: string, valorPara: number, chaveIdempotencia?: string) => ({
    cobrancaId, tipo: TipoAjuste.DESCONTO, valorPara, vigencia: Vigencia.ESTA_COBRANCA, motivo: "Desconto conferido", ...(chaveIdempotencia ? { chaveIdempotencia } : {}),
  });

  it("ajuste aplicado: a mesma chave não aplica de novo (um AjusteFinanceiro, um Evento) e devolve o mesmo resultado", async () => {
    const c = await mensalidade();
    const [a, b] = await Promise.all([ajustarCobranca(desconto(c.id, 90, "chave-ajuste-01")), ajustarCobranca(desconto(c.id, 90, "chave-ajuste-01"))]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(a).toEqual({ ok: true, dado: { aprovacao: false } });
    expect(b).toEqual(a);
    expect(await ajustarCobranca(desconto(c.id, 90, "chave-ajuste-01"))).toEqual(a);
    expect(await prisma.ajusteFinanceiro.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "CobrancaRenegociada" } })).toBe(1);
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ versao: c.versao + 1 });
  });

  it("pedido de aprovação: a mesma chave não abre segundo pedido", async () => {
    entrar(finSemAlcada);
    const c = await mensalidade();
    const a = await ajustarCobranca(desconto(c.id, 50, "chave-ajuste-02"));
    expect(a).toEqual({ ok: true, dado: { aprovacao: true } });
    expect(await ajustarCobranca(desconto(c.id, 50, "chave-ajuste-02"))).toEqual(a);
    expect(await prisma.aprovacao.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "DescontoSolicitado" } })).toBe(1);
  });

  it("recusa a mesma chave com outro valor ou outra cobrança, sem ajustar", async () => {
    const c = await mensalidade();
    const outra = await mensalidade("2026-12");
    expect((await ajustarCobranca(desconto(c.id, 90, "chave-ajuste-03"))).ok).toBe(true);
    const outroValor = await ajustarCobranca(desconto(c.id, 80, "chave-ajuste-03"));
    const outraCobranca = await ajustarCobranca(desconto(outra.id, 90, "chave-ajuste-03"));
    expect([outroValor.ok, outraCobranca.ok]).toEqual([false, false]);
    if (!outroValor.ok) expect(outroValor.erro).toMatch(/já foi usada/);
    expect(await prisma.ajusteFinanceiro.count()).toBe(1);
    expect(await prisma.aprovacao.count()).toBe(0);
  });
});
