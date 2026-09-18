import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  sessao: vi.fn(), bloquear: vi.fn(), usuario: vi.fn(), efetivacao: vi.fn(), bases: vi.fn(), ultimaAplicacao: vi.fn(), fontes: vi.fn(), hash: vi.fn(),
}));
vi.mock("@/server/_shared", () => ({
  executarAcao: async (acao: () => unknown) => ({ ok: true, dado: await acao() }),
  exigirSessaoComPapel: mocks.sessao,
  ErroPermissao: class ErroPermissao extends Error {},
  ErroRegra: class ErroRegra extends Error {},
}));
vi.mock("@/server/financeiro/recebimentos", () => ({ bloquearMatriculas: mocks.bloquear }));
vi.mock("@/server/matricula/desistencia-reconferencia-delta-fontes", () => ({ carregarFontesReconferenciaDeltaTx: mocks.fontes }));
vi.mock("@/server/contratos/substituicao-estado", () => ({ hashSubstituicao: mocks.hash }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: (acao: (tx: unknown) => unknown) => acao({
    usuario: { findUnique: mocks.usuario },
    efetivacaoPedidoDesistenciaPreparacao: { findUnique: mocks.efetivacao },
    aplicacaoAcertoDesistenciaContratual: { findMany: mocks.bases },
    aplicacaoReconferenciaDeltaDesistencia: { findFirst: mocks.ultimaAplicacao },
  }),
} }));
import { consultarReconferenciaDeltaDesistencia } from "./desistencia-reconferencia-delta-consulta";

const hash = "a".repeat(64);
const decisorFinanceiro = { nome: "Financeiro B", ativo: true, papeis: [Papel.FINANCEIRO], permissoes: ["financeiro.aprovar_acertos"] };
const decisorAdministrativo = { nome: "Admin B", ativo: true, papeis: [Papel.ADMINISTRADOR], permissoes: [] };
const proposta = (versao: number, extras: Record<string, unknown> = {}) => ({
  id: `delta-${versao}`, versao, estado: "PENDENTE", fotografiaHash: hash, aplicacaoDeltaAnteriorId: null, preparadorId: "preparador", criadaEm: new Date(`2026-09-18T12:00:0${versao}Z`),
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
  mocks.ultimaAplicacao.mockResolvedValue(null);
  mocks.fontes.mockResolvedValue({ fotografia: { estado: "atual" } });
  mocks.hash.mockReturnValue(hash);
});

describe("consultarReconferenciaDeltaDesistencia", () => {
  it("expõe crédito externo e justificativas, mas libera ação somente na versão vigente", async () => {
    mocks.bases.mockResolvedValue([{ id: "base", memoria: { itens: [] }, criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(2, { decisaoFinanceira: { id: "fin-2", aprovada: true, motivo: "Caixa posterior conferido.", decisorId: "aprovador", decisor: decisorFinanceiro }, decisaoAdministrativa: { id: "adm-2", aprovada: true, motivo: "Administração conferiu.", decisorId: "admin", decisor: decisorAdministrativo } }),
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
    mocks.bases.mockResolvedValue([{ id: "base", memoria: { itens: [] }, criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(1, { decisaoFinanceira: { id: "fin", aprovada: true, motivo: "Conferido.", decisorId: "aprovador", decisor: decisorFinanceiro }, decisaoAdministrativa: { id: "adm", aprovada: true, motivo: "Conferido.", decisorId: "admin", decisor: decisorAdministrativo } }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{ propostas: [{ podeAplicar: false }] }] } });
  });

  it("bloqueia repetição enquanto a versão vigente tem pendência financeira", async () => {
    mocks.bases.mockResolvedValue([{ id: "base", memoria: { itens: [] }, criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(1, { estado: "PENDENCIA_FINANCEIRA", memoriaDelta: { tipo: "PENDENCIA", pendencia: "Há informe de pagamento pendente de conferência.", itens: [], creditosExternos: [] } }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{ podePreparar: false, preparoBloqueadoPor: expect.stringContaining("informe de pagamento") }] } });
  });

  it("libera nova versão quando o informe pendente foi resolvido e a fotografia mudou", async () => {
    mocks.hash.mockReturnValue("b".repeat(64));
    mocks.bases.mockResolvedValue([{ id: "base", memoria: { itens: [] }, criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(1, { estado: "PENDENCIA_FINANCEIRA", memoriaDelta: { tipo: "PENDENCIA", pendencia: "Há informe de pagamento pendente de conferência.", itens: [], creditosExternos: [] } }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{ podePreparar: true, preparoBloqueadoPor: null, propostas: [{ podeDecidirFinanceiro: false, podeDecidirAdministrativo: false }] }] } });
  });

  it("libera novo preparo e remove aplicação de proposta obsoleta por crédito posterior", async () => {
    mocks.hash.mockReturnValue("b".repeat(64));
    mocks.bases.mockResolvedValue([{ id: "base", memoria: { itens: [] }, criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(1, { decisaoFinanceira: { id: "fin", aprovada: true, motivo: "Conferido.", decisorId: "aprovador", decisor: decisorFinanceiro }, decisaoAdministrativa: { id: "adm", aprovada: true, motivo: "Conferido.", decisorId: "admin", decisor: decisorAdministrativo } }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{ podePreparar: true, propostas: [{ podeAplicar: false, podeDecidirFinanceiro: false, podeDecidirAdministrativo: false }] }] } });
  });

  it("mantém proposta pendente obsoleta quando a fotografia ou seu predecessor atual muda", async () => {
    mocks.hash.mockReturnValue("b".repeat(64));
    mocks.ultimaAplicacao.mockResolvedValue({ id: "aplicacao-1", fotografiaPosteriorHash: hash });
    mocks.bases.mockResolvedValue([{ id: "base", memoria: { itens: [] }, criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(2, { aplicacaoDeltaAnteriorId: "aplicacao-1" }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{ podePreparar: true, propostas: [{
      podeDecidirFinanceiro: false,
      podeDecidirAdministrativo: false,
      podeAplicar: false,
    }] }] } });
  });

  it("bloqueia nova versão aplicada quando a fotografia posterior ainda é a atual", async () => {
    mocks.ultimaAplicacao.mockResolvedValue({ id: "aplicacao-1", fotografiaPosteriorHash: hash });
    mocks.bases.mockResolvedValue([{ id: "base", memoria: { itens: [] }, criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(1, { estado: "APLICADA", aplicacao: { id: "aplicacao-1", criadaEm: new Date("2026-09-18T13:00:00Z") } }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{
      podePreparar: false,
      preparoBloqueadoPor: expect.stringContaining("fotografia atual"),
    }] } });
  });

  it("bloqueia aplicação legada cuja fotografia atual ainda coincide com a prévia", async () => {
    mocks.ultimaAplicacao.mockResolvedValue({ id: "aplicacao-legada", fotografiaPosteriorHash: null });
    mocks.bases.mockResolvedValue([{ id: "base", memoria: { itens: [] }, criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(1, { estado: "APLICADA", aplicacao: { id: "aplicacao-legada", criadaEm: new Date("2026-09-18T13:00:00Z") } }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{
      podePreparar: false,
      preparoBloqueadoPor: expect.stringContaining("legada"),
    }] } });
  });

  it("permite uma nova decisão para aplicação legada somente quando a fotografia atual diverge", async () => {
    mocks.hash.mockReturnValue("b".repeat(64));
    mocks.ultimaAplicacao.mockResolvedValue({ id: "aplicacao-legada", fotografiaPosteriorHash: null });
    mocks.bases.mockResolvedValue([{ id: "base", memoria: { itens: [] }, criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(1, { estado: "APLICADA", aplicacao: { id: "aplicacao-legada", criadaEm: new Date("2026-09-18T13:00:00Z") } }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{ podePreparar: true, propostas: [{
      podeDecidirFinanceiro: false,
      podeDecidirAdministrativo: false,
      podeAplicar: false,
    }] }] } });
  });

  it("libera nova preparação quando aprovação existente perde a alçada, mesmo sem fato financeiro", async () => {
    mocks.ultimaAplicacao.mockResolvedValue({ id: "aplicacao-1", fotografiaPosteriorHash: hash });
    mocks.bases.mockResolvedValue([{ id: "base", memoria: { itens: [] }, criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(1, {
        estado: "APLICADA",
        aplicacao: { id: "aplicacao-1", criadaEm: new Date("2026-09-18T13:00:00Z") },
        decisaoFinanceira: { id: "fin", aprovada: true, motivo: "Conferido.", decisorId: "financeiro-revogado", decisor: { ...decisorFinanceiro, ativo: false } },
        decisaoAdministrativa: { id: "adm", aprovada: true, motivo: "Conferido.", decisorId: "admin", decisor: decisorAdministrativo },
      }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{
      podePreparar: true,
      orientacaoPreparacao: expect.stringContaining("perdeu a alçada"),
      propostas: [{ podeDecidirFinanceiro: false, podeDecidirAdministrativo: false, podeAplicar: false }],
    }] } });
  });

  it("reabre decisão independente quando a aprovação administrativa vigente foi revogada", async () => {
    mocks.bases.mockResolvedValue([{ id: "base", memoria: { itens: [] }, criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(1, {
        decisaoFinanceira: { id: "fin", aprovada: true, motivo: "Conferido.", decisorId: "aprovador", decisor: decisorFinanceiro },
        decisaoAdministrativa: { id: "adm", aprovada: true, motivo: "Conferido.", decisorId: "admin-revogado", decisor: { ...decisorAdministrativo, papeis: [] } },
      }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{
      podePreparar: true,
      orientacaoPreparacao: expect.stringContaining("novas decisões independentes"),
      propostas: [{ podeDecidirFinanceiro: false, podeDecidirAdministrativo: false, podeAplicar: false }],
    }] } });
  });

  it("libera nova versão aplicada somente após fato que altera a fotografia posterior", async () => {
    mocks.hash.mockReturnValue("b".repeat(64));
    mocks.ultimaAplicacao.mockResolvedValue({ id: "aplicacao-1", fotografiaPosteriorHash: hash });
    mocks.bases.mockResolvedValue([{ id: "base", memoria: { itens: [] }, criadaEm: new Date("2026-09-18T12:00:00Z"), reconferenciasDelta: [
      proposta(1, { estado: "APLICADA", aplicacao: { id: "aplicacao-1", criadaEm: new Date("2026-09-18T13:00:00Z") } }),
    ] }]);

    const resultado = await consultarReconferenciaDeltaDesistencia({ matriculaId: "matricula" });

    expect(resultado).toMatchObject({ ok: true, dado: { aplicacoesBase: [{ podePreparar: true, propostas: [{
      podeAplicar: false,
      podeDecidirFinanceiro: false,
      podeDecidirAdministrativo: false,
    }] }] } });
  });
});
