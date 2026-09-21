import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  usuarioSessao: { findUnique: vi.fn() },
  tx: {
    usuario: { findUnique: vi.fn() },
    pedidoDesistenciaPreparacao: { findUnique: vi.fn(), findFirst: vi.fn() },
    matricula: { findUniqueOrThrow: vi.fn() },
    efetivacaoPedidoDesistenciaPreparacao: { findFirst: vi.fn() },
    condicoesEncerramentoMatricula: { findFirst: vi.fn() },
    propostaAcertoDesistenciaContratual: { create: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  usuario: h.usuarioSessao,
  $transaction: (f: (tx: typeof h.tx) => unknown) => f(h.tx),
} }));
vi.mock("@/server/financeiro/recebimentos", () => ({ bloquearMatriculas: vi.fn() }));

import { prepararAcertoDesistenciaContratual } from "./desistencia-acerto-contratual";

const entrada = { pedidoId: "p", condicoesId: "c", motivo: "Motivo válido", chaveIdempotencia: "chave-123" };

describe("prepararAcertoDesistenciaContratual", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    h.auth.mockResolvedValue({ user: { id: "fin" } });
    const usuario = { nome: "Financeiro", ativo: true, papeis: ["FINANCEIRO"] };
    h.usuarioSessao.findUnique.mockResolvedValue(usuario);
    h.tx.usuario.findUnique.mockResolvedValue(usuario);
    h.tx.pedidoDesistenciaPreparacao.findUnique.mockResolvedValue({ id: "p", matriculaId: "m" });
    h.tx.pedidoDesistenciaPreparacao.findFirst.mockResolvedValue({ id: "p" });
    h.tx.propostaAcertoDesistenciaContratual.findUnique.mockResolvedValue(null);
    h.tx.efetivacaoPedidoDesistenciaPreparacao.findFirst.mockResolvedValue(null);
    h.tx.matricula.findUniqueOrThrow.mockResolvedValue({
      status: "RASCUNHO", ativadaEm: null, contratoOk: true, contratoDocumentoId: "d",
      confirmacaoContratoEm: new Date("2026-09-01T12:00:00Z"), confirmacaoContratoPorId: "s",
    });
  });

  it("recusa matrícula ativa antes de criar proposta", async () => {
    h.tx.matricula.findUniqueOrThrow.mockResolvedValue({ status: "ATIVA", ativadaEm: new Date("2026-09-01T12:00:00Z") });
    expect(await prepararAcertoDesistenciaContratual(entrada)).toEqual({
      ok: false, erro: "O acerto contratual exige matrícula em preparação.",
    });
    expect(h.usuarioSessao.findUnique).toHaveBeenCalled();
    expect(h.tx.usuario.findUnique).toHaveBeenCalled();
    expect(h.tx.matricula.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "m" } }));
    expect(h.tx.propostaAcertoDesistenciaContratual.create).not.toHaveBeenCalled();
  });

  it("recusa ausência de versão contratual aprovada sem criar proposta", async () => {
    h.tx.condicoesEncerramentoMatricula.findFirst.mockResolvedValue(null);
    expect(await prepararAcertoDesistenciaContratual(entrada)).toEqual({
      ok: false, erro: "Use a versão contratual estruturada vigente e aprovada.",
    });
    expect(h.tx.condicoesEncerramentoMatricula.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "c", matriculaId: "m", status: "APROVADA" },
    }));
    expect(h.tx.propostaAcertoDesistenciaContratual.create).not.toHaveBeenCalled();
  });

  it("recusa pedido antigo sem criar proposta", async () => {
    h.tx.pedidoDesistenciaPreparacao.findFirst.mockResolvedValue({ id: "novo" });
    expect(await prepararAcertoDesistenciaContratual(entrada)).toEqual({
      ok: false, erro: "Use o pedido atual ainda não efetivado.",
    });
    expect(h.tx.pedidoDesistenciaPreparacao.findFirst).toHaveBeenCalledWith({
      where: { matriculaId: "m" }, orderBy: { versao: "desc" },
    });
    expect(h.tx.condicoesEncerramentoMatricula.findFirst).not.toHaveBeenCalled();
    expect(h.tx.propostaAcertoDesistenciaContratual.create).not.toHaveBeenCalled();
  });
});

// Prova apenas a sensibilidade do hash; os cenários integrados conferem sua aplicação.
it("detecta fotografia financeira alterada", async () => {
  const { hashSubstituicao } = await import("@/server/contratos/substituicao-estado");
  const antes = { cobrancas: [{ id: "c", versao: 1, valorNegociado: "100.00", valorRecebido: null, valorLiquidadoCredito: "0.00", valorCompensadoPermuta: "0.00" }] };
  const depois = { cobrancas: [{ id: "c", versao: 1, valorNegociado: "100.00", valorRecebido: "30.00", valorLiquidadoCredito: "0.00", valorCompensadoPermuta: "0.00" }] };
  expect(hashSubstituicao(depois)).not.toBe(hashSubstituicao(antes));
});
