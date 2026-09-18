import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  sessao: vi.fn(), bloquear: vi.fn(), usuario: vi.fn(), efetivacao: vi.fn(), bases: vi.fn(),
}));
vi.mock("@/server/_shared", () => ({
  executarAcao: async (acao: () => unknown) => ({ ok: true, dado: await acao() }),
  exigirSessaoComPapel: mocks.sessao,
  ErroPermissao: class ErroPermissao extends Error {},
  ErroRegra: class ErroRegra extends Error {},
}));
vi.mock("@/server/financeiro/recebimentos", () => ({ bloquearMatriculas: mocks.bloquear }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: (acao: (tx: unknown) => unknown) => acao({
    usuario: { findUnique: mocks.usuario },
    efetivacaoPedidoDesistenciaPreparacao: { findUnique: mocks.efetivacao },
    aplicacaoAcertoDesistenciaContratual: { findMany: mocks.bases },
  }),
} }));
import { consultarReconferenciaDeltaDesistencia } from "./desistencia-reconferencia-delta-consulta";

const hash = "a".repeat(64);
const proposta = (versao: number, extras: Record<string, unknown> = {}) => ({
  id: `delta-${versao}`, versao, estado: "PENDENTE", fotografiaHash: hash, preparadorId: "preparador", criadaEm: new Date(`2026-09-18T12:00:0${versao}Z`),
  preparador: { nome: "Financeiro preparador" }, memoriaDelta: {
    tipo: "APLICAR", itens: [{ cobrancaId: "taxa", moeda: "BRL", ajusteDevido: "0.00", ajusteSaldo: "0.00", creditoDelta: "0.00", reducaoCredito: "0.00" }],
    creditosExternos: [{ id: "credito-externo", moeda: "BRL", saldoDisponivel: "17.00" }],
  }, decisaoFinanceira: null, decisaoAdministrativa: null, aplicacao: null, ...extras,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sessao.mockResolvedValue({ id: "aprovador" });
  mocks.usuario.mockResolvedValue({ ativo: true, papeis: [Papel.FINANCEIRO], permissoes: ["financeiro.aprovar_acertos"] });
  mocks.efetivacao.mockResolvedValue(null);
});

describe("consultarReconferenciaDeltaDesistencia", () => {
  it("expõe crédito externo e justificativas, mas libera ação somente na versão vigente", async () => {
    mocks.bases.mockResolvedValue([{ id: "base", criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(2, { decisaoFinanceira: { id: "fin-2", aprovada: true, motivo: "Caixa posterior conferido.", decisorId: "aprovador", decisor: { nome: "Financeiro B" } }, decisaoAdministrativa: { id: "adm-2", aprovada: true, motivo: "Administração conferiu.", decisorId: "admin", decisor: { nome: "Admin B" } } }),
      proposta(1),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{ podePreparar: false, propostas: [
      { id: "delta-2", podeAplicar: true, creditosExternos: [{ id: "credito-externo", saldoDisponivel: "17.00" }], decisaoFinanceira: { motivo: "Caixa posterior conferido." } },
      { id: "delta-1", podeDecidirFinanceiro: false, podeDecidirAdministrativo: false, podeAplicar: false },
    ] }] } });
  });

  it("não oferece aplicação quando a alçada financeira atual foi revogada", async () => {
    mocks.usuario.mockResolvedValue({ ativo: true, papeis: [Papel.FINANCEIRO], permissoes: [] });
    mocks.bases.mockResolvedValue([{ id: "base", criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(1, { decisaoFinanceira: { id: "fin", aprovada: true, motivo: "Conferido.", decisorId: "aprovador", decisor: { nome: "Financeiro B" } }, decisaoAdministrativa: { id: "adm", aprovada: true, motivo: "Conferido.", decisorId: "admin", decisor: { nome: "Admin B" } } }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{ propostas: [{ podeAplicar: false }] }] } });
  });

  it("bloqueia repetição enquanto a versão vigente tem pendência financeira", async () => {
    mocks.bases.mockResolvedValue([{ id: "base", criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(1, { estado: "PENDENCIA_FINANCEIRA", memoriaDelta: { tipo: "PENDENCIA", pendencia: "Há informe de pagamento pendente de conferência.", itens: [], creditosExternos: [] } }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{ podePreparar: false, preparoBloqueadoPor: expect.stringContaining("informe de pagamento") }] } });
  });
});
