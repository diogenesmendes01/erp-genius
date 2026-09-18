import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const h = vi.hoisted(() => ({ ator: "fin", proposta: null as any, foto: {} as any, evento: vi.fn(), tx: {
  usuario: { findUnique: vi.fn() }, pedidoDesistenciaPreparacao: { findUnique: vi.fn(), findFirst: vi.fn() },
  matricula: { findUniqueOrThrow: vi.fn() }, efetivacaoPedidoDesistenciaPreparacao: { findFirst: vi.fn() },
  condicoesEncerramentoMatricula: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), count: vi.fn() }, cobranca: { findMany: vi.fn() },
  origemCreditoAcertoTaxaAditivo: { findMany: vi.fn() }, origemCreditoAcertoDesistenciaContratual: { findMany: vi.fn() },
  propostaAcertoDesistenciaContratual: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn() },
  decisaoAcertoDesistenciaContratual: { create: vi.fn() },
  aplicacaoAcertoDesistenciaContratual: { findFirst: vi.fn() },
} }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (f: any) => f(h.tx) } }));
vi.mock("@/server/_shared", () => ({
  exigirSessaoComPapel: async () => ({ id: h.ator }), registrarEvento: h.evento,
  ErroRegra: class extends Error {}, ErroPermissao: class extends Error {},
  executarAcao: async (f: any) => { try { return { ok: true, dado: await f() }; } catch (e) { return { ok: false, erro: String(e) }; } },
}));
vi.mock("@/server/financeiro/recebimentos", () => ({ bloquearMatriculas: vi.fn() }));
vi.mock("./desistencia-financeiro-tx", () => ({ carregarFinanceiroDesistenciaTx: async () => ({ snapshot: structuredClone(h.foto) }) }));
import { prepararAcertoDesistenciaContratual, decidirAcertoDesistenciaContratual } from "./desistencia-acerto-contratual";

beforeEach(() => {
  vi.clearAllMocks(); h.ator = "fin"; h.proposta = null;
  h.tx.aplicacaoAcertoDesistenciaContratual.findFirst.mockResolvedValue(null);
  h.foto = { matriculaId: "m", cobrancas: [{ id: "taxa", versao: 1, recebimentos: [{ id: "r", valor: "100.00" }], utilizacoesCredito: [] }], creditos: [] };
  h.tx.usuario.findUnique.mockResolvedValue({ ativo: true, papeis: ["FINANCEIRO"], permissoes: ["financeiro.aprovar_acertos"] });
  h.tx.pedidoDesistenciaPreparacao.findUnique.mockResolvedValue({ id: "p", matriculaId: "m", estadoHash: "a".repeat(64) });
  h.tx.pedidoDesistenciaPreparacao.findFirst.mockResolvedValue({ id: "p" });
  h.tx.efetivacaoPedidoDesistenciaPreparacao.findFirst.mockResolvedValue(null);
  h.tx.matricula.findUniqueOrThrow.mockResolvedValue({ status: "RASCUNHO", ativadaEm: null, contratoOk: true, contratoDocumentoId: "doc", confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: "sec" });
  h.tx.condicoesEncerramentoMatricula.findFirst.mockResolvedValue({ id: "c", documentoId: "doc", documento: { arquivado: false, matriculaId: "m" }, regras: {
    diaEncerramento: "EXCLUIR", metodoDesconto: "ANTES_DO_PROPORCIONAL", condicoesDescontos: "Conforme contrato", multa: { tipo: "SEM_PREVISAO", motivo: "Sem multa" },
    acertoDesistenciaPreparacao: { tipo: "VALOR_FIXO", valor: "50", clausulaId: "7.6", condicoesAplicacao: { momento: "ANTES_ATIVACAO", unidade: "POR_COBRANCA", alcance: { tipo: "TODAS_COBRANCAS_MATRICULA" } } },
  } });
  h.tx.condicoesEncerramentoMatricula.findUniqueOrThrow.mockResolvedValue({ versao: 1 }); h.tx.condicoesEncerramentoMatricula.count.mockResolvedValue(0);
  h.tx.cobranca.findMany.mockResolvedValue([{ id: "taxa", tipo: "MATRICULA", moeda: "BRL", valorNegociado: new Prisma.Decimal(100), valorRecebido: new Prisma.Decimal(100), valorLiquidadoCredito: new Prisma.Decimal(0), valorCompensadoPermuta: new Prisma.Decimal(0) }]);
  h.tx.origemCreditoAcertoTaxaAditivo.findMany.mockResolvedValue([{ cobrancaId: "taxa", valor: new Prisma.Decimal(20) }]);
  h.tx.origemCreditoAcertoDesistenciaContratual.findMany.mockResolvedValue([]);
  h.tx.propostaAcertoDesistenciaContratual.findUnique.mockResolvedValue(null);
  h.tx.propostaAcertoDesistenciaContratual.create.mockImplementation(async ({ data }) => (h.proposta = { ...data, id: "proposta", pedido: { matriculaId: "m" }, decisao: null }));
  h.tx.propostaAcertoDesistenciaContratual.findUniqueOrThrow.mockImplementation(async () => h.proposta);
  h.tx.decisaoAcertoDesistenciaContratual.create.mockImplementation(async ({ data }) => (h.proposta.decisao = { ...data, id: "decisao" }));
});
async function preparar() {
  expect(await prepararAcertoDesistenciaContratual({ pedidoId: "p", condicoesId: "c", motivo: "Desistência conforme contrato", chaveIdempotencia: "preparo-123" })).toMatchObject({ ok: true });
  h.ator = "outro-fin";
  return { propostaId: "proposta", fotografiaHash: h.proposta.fotografiaHash, aprovada: true, motivo: "Conferência independente", chaveIdempotencia: "decisao-123" };
}
describe("Q165 preparação e decisão com a mesma fotografia", () => {
  it("repete preparação após aplicação sem recalcular nem criar novo acerto", async () => {
    await preparar();
    h.ator = "fin";
    h.tx.propostaAcertoDesistenciaContratual.findUnique.mockResolvedValue(h.proposta);
    h.tx.matricula.findUniqueOrThrow.mockResolvedValue({ status: "CANCELADA" });
    h.foto.creditos.push({ id: "credito-do-acerto-aplicado" });
    h.tx.matricula.findUniqueOrThrow.mockClear();
    h.tx.cobranca.findMany.mockClear();
    const entrada = { pedidoId: "p", condicoesId: "c", motivo: "Desistência conforme contrato", chaveIdempotencia: "preparo-123" };
    expect(await prepararAcertoDesistenciaContratual(entrada)).toMatchObject({ ok: true, dado: { id: "proposta" } });
    expect(h.tx.matricula.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(h.tx.cobranca.findMany).not.toHaveBeenCalled();
    expect(h.tx.propostaAcertoDesistenciaContratual.create).toHaveBeenCalledTimes(1);
    expect(await prepararAcertoDesistenciaContratual({ ...entrada, motivo: "Outro motivo de desistência" })).toMatchObject({ ok: false });
    expect(await prepararAcertoDesistenciaContratual({ ...entrada, condicoesId: "outras-condicoes" })).toMatchObject({ ok: false });
    h.tx.usuario.findUnique.mockResolvedValue({ ativo: false, papeis: ["FINANCEIRO"] });
    expect(await prepararAcertoDesistenciaContratual(entrada)).toMatchObject({ ok: false });
  });
  it("aprova a memória realmente preparada, descontando crédito anterior", async () => {
    const entrada = await preparar();
    expect(h.proposta.memoria.itens[0].creditoApurado).toBe("30.00");
    expect(await decidirAcertoDesistenciaContratual(entrada)).toMatchObject({ ok: true, dado: { aprovada: true } });
    h.foto.creditos.push({ id: "credito-posterior" });
    expect(await decidirAcertoDesistenciaContratual(entrada)).toMatchObject({ ok: true });
    expect(h.tx.decisaoAcertoDesistenciaContratual.create).toHaveBeenCalledTimes(1);
    expect(await decidirAcertoDesistenciaContratual({ ...entrada, motivo: "Justificativa diferente" })).toMatchObject({ ok: false });
  });
  it.each(["recebimento", "credito", "origem"])("recusa mudança de %s antes de decidir", async tipo => {
    const entrada = await preparar();
    if (tipo === "recebimento") h.foto.cobrancas[0].recebimentos[0].valor = "90.00";
    if (tipo === "credito") h.foto.creditos.push({ id: "novo" });
    if (tipo === "origem") h.tx.origemCreditoAcertoTaxaAditivo.findMany.mockResolvedValue([{ cobrancaId: "taxa", valor: new Prisma.Decimal(30) }]);
    expect(await decidirAcertoDesistenciaContratual(entrada)).toMatchObject({ ok: false, erro: expect.stringContaining("fotografia financeira mudou") });
    expect(h.tx.decisaoAcertoDesistenciaContratual.create).not.toHaveBeenCalled();
  });
});
