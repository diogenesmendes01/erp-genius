import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ tx: {
  $queryRaw: vi.fn(), usuario: { findUnique: vi.fn() }, creditoMatricula: { findFirst: vi.fn() },
  origemCreditoAcertoDesistenciaContratual: { findUniqueOrThrow: vi.fn() },
  cobranca: { findMany: vi.fn() }, propostaUsoCredito: { findMany: vi.fn() }, propostaDevolucaoCredito: { findMany: vi.fn() },
} }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(h.tx) } }));
vi.mock("@/server/_shared", () => ({
  exigirSessaoComPapel: async () => ({ id: "fin" }), registrarEvento: vi.fn(),
  ErroRegra: class extends Error {}, ErroPermissao: class extends Error {},
  executarAcao: async (fn: () => Promise<unknown>) => { try { return { ok: true, dado: await fn() }; } catch (e) { return { ok: false, erro: String(e) }; } },
}));
vi.mock("./recebimentos", () => ({ bloquearMatriculas: vi.fn() }));
vi.mock("./uso-credito-estado", () => ({ estadoUsoCreditoTx: vi.fn(), saldoCreditoTx: async () => new Prisma.Decimal(30) }));
import { consultarPropostasUsoCredito } from "./uso-credito-proposta";
const origem = () => ({ id: "origem", matriculaId: "m", cobrancaId: "c", valor: new Prisma.Decimal(50), moeda: "BRL", criadaEm: new Date("2026-09-01"),
  aplicacao: { id: "aplicacao", decisao: { id: "decisao", proposta: { id: "proposta", pedidoId: "pedido" } } },
});
beforeEach(() => {
  vi.clearAllMocks();
  h.tx.usuario.findUnique.mockResolvedValue({ ativo: true, papeis: ["FINANCEIRO"], permissoes: [] });
  h.tx.creditoMatricula.findFirst.mockResolvedValue({ id: "credito", matriculaId: "m", moeda: "BRL", valorInicial: new Prisma.Decimal(50), origemAcertoDesistenciaContratualId: "origem" });
  h.tx.origemCreditoAcertoDesistenciaContratual.findUniqueOrThrow.mockResolvedValue(origem());
  h.tx.cobranca.findMany.mockResolvedValue([]); h.tx.propostaUsoCredito.findMany.mockResolvedValue([]); h.tx.propostaDevolucaoCredito.findMany.mockResolvedValue([]);
});
describe("origem de desistência na consulta de crédito", () => {
  it("mostra o valor original e a cadeia sem confundir com o saldo disponível", async () => {
    expect(await consultarPropostasUsoCredito({ alunoId: "aluno", creditoId: "credito" })).toMatchObject({ ok: true, dado: {
      valorCredito: "30.00", origemDesistencia: { valorOriginal: "50.00", pedidoId: "pedido", propostaId: "proposta", decisaoId: "decisao", aplicacaoId: "aplicacao", cobrancaId: "c" },
    } });
    expect(h.tx.creditoMatricula.findFirst).toHaveBeenCalledWith({ where: { id: "credito", matricula: { alunoId: "aluno" } } });
  });
  it("não expõe a origem para papel revogado", async () => {
    h.tx.usuario.findUnique.mockResolvedValue({ ativo: true, papeis: ["SECRETARIA_ACADEMICA"], permissoes: [] });
    expect(await consultarPropostasUsoCredito({ alunoId: "aluno", creditoId: "credito" })).toMatchObject({ ok: false });
    expect(h.tx.origemCreditoAcertoDesistenciaContratual.findUniqueOrThrow).not.toHaveBeenCalled();
  });
  it("recusa fonte ligada a outro contrato", async () => {
    h.tx.origemCreditoAcertoDesistenciaContratual.findUniqueOrThrow.mockResolvedValue({ ...origem(), matriculaId: "outra" });
    expect(await consultarPropostasUsoCredito({ alunoId: "aluno", creditoId: "credito" })).toMatchObject({ ok: false, erro: expect.stringContaining("origem do crédito diverge") });
  });
});
