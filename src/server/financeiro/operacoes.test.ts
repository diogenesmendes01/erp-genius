import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  papeis: ["SECRETARIA_ACADEMICA"] as string[],
  txConcluida: false,
  $queryRaw: vi.fn(),
  reavaliarAcesso: vi.fn(),
  usuario: { findUniqueOrThrow: vi.fn() },
  configuracaoOperacional: { findUnique: vi.fn() },
  matricula: { findUniqueOrThrow: vi.fn() },
  cobranca: { findUnique: vi.fn(), update: vi.fn() },
  pagamentoInformado: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  recebimento: { findUnique: vi.fn(), create: vi.fn() },
  comissao: { findMany: vi.fn(), update: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/cobrancas/acesso-aulas", () => ({ reavaliarAcessoAutomaticoDaCobranca: m.reavaliarAcesso }));
vi.mock("@/lib/prisma", () => ({ prisma: { ...m, $transaction: async (fn: (tx: typeof m) => Promise<unknown>) => {
  const dado = await fn(m);
  m.txConcluida = true;
  return dado;
} } }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, registrarEvento: vi.fn(), exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = { id: "operador", nome: "Operador", papeis: m.papeis as Papel[] };
    real.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { registrarPagamento, conferirPagamento, fecharMesComissoes } from "./acoes";
import { listarInformesPagamento } from "./consultas";

beforeEach(() => {
  vi.resetAllMocks(); m.papeis = [Papel.SECRETARIA_ACADEMICA];
  m.txConcluida = false;
  m.$queryRaw.mockResolvedValue([]);
  m.usuario.findUniqueOrThrow.mockResolvedValue({ permissoes: [] });
  m.configuracaoOperacional.findUnique.mockResolvedValue(null);
  m.matricula.findUniqueOrThrow.mockResolvedValue({ alunoId: "aluno", leadId: null });
  m.cobranca.findUnique.mockResolvedValue({ id: "cobranca", matriculaId: "matricula", status: "PENDENTE", moeda: "BRL", valorNegociado: new Prisma.Decimal(100), valorRecebido: null, valorLiquidadoCredito: new Prisma.Decimal(0), vencimento: new Date("2030-01-01") });
  m.pagamentoInformado.create.mockResolvedValue({ id: "informe", versao: 1 });
  m.pagamentoInformado.findMany.mockResolvedValue([]);
  m.recebimento.create.mockResolvedValue({ id: "recebimento" });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function falharRecalculoAposCommit() {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const estadoCommit = vi.fn();
  m.reavaliarAcesso.mockImplementation(async () => {
    estadoCommit(m.txConcluida);
    throw new Error("Falha de banco com dados que não devem aparecer no log: aluno-sensivel, valor-sensivel");
  });
  return { log, estadoCommit };
}

describe("pagamentos e conferência pela ação pública", () => {
  it("a secretaria informa sem escrever recebimento ou saldo", async () => {
    const r = await registrarPagamento("cobranca", { chaveIdempotencia: "pagamento-unitario-1", valorRecebido: 40, forma: "DINHEIRO" });
    expect(r).toEqual({ ok: true, dado: { informado: true } });
    expect(m.pagamentoInformado.create).toHaveBeenCalledOnce();
    expect(m.recebimento.create).not.toHaveBeenCalled();
    expect(m.cobranca.update).not.toHaveBeenCalled();
    expect(m.reavaliarAcesso).toHaveBeenCalledWith("cobranca");
  });

  it.each([Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO])("%s recebe sucesso financeiro se o recálculo falhar após o commit", async (papel) => {
    m.papeis = [papel];
    const { log, estadoCommit } = falharRecalculoAposCommit();
    const r = await registrarPagamento("cobranca", { chaveIdempotencia: "pagamento-unitario-poscommit", valorRecebido: 40, forma: "DINHEIRO" });
    const informado = papel === Papel.SECRETARIA_ACADEMICA;
    expect(r).toEqual({ ok: true, dado: { informado } });
    expect(m.pagamentoInformado.create).toHaveBeenCalledTimes(informado ? 1 : 0);
    expect(m.recebimento.create).toHaveBeenCalledTimes(informado ? 0 : 1);
    expect(m.cobranca.update).toHaveBeenCalledTimes(informado ? 0 : 1);
    expect(estadoCommit).toHaveBeenCalledExactlyOnceWith(true);
    expect(log).toHaveBeenCalledExactlyOnceWith("[financeiro] Operação confirmada. Falha no recálculo de acesso às aulas; reavaliação pendente pelo cron institucional.");
  });

  it.each([true, false])("conferência confirmar=%s preserva a decisão se o recálculo falhar após o commit", async (confirmar) => {
    m.papeis = [Papel.FINANCEIRO];
    m.pagamentoInformado.findUnique.mockResolvedValue({ id: "informe", cobrancaId: "cobranca", autorId: "secretaria", versao: 1, status: "A_CONFERIR", moeda: "BRL", valor: new Prisma.Decimal(40), forma: "DINHEIRO", dataPagamento: new Date(), permitirExcedente: false });
    const { log, estadoCommit } = falharRecalculoAposCommit();
    expect(await conferirPagamento("informe", { versao: 1, confirmar, motivo: "Conferência verificada" })).toEqual({ ok: true, dado: undefined });
    expect(m.pagamentoInformado.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: confirmar ? "CONFIRMADO" : "REJEITADO", conferenteId: "operador" }) }));
    expect(m.recebimento.create).toHaveBeenCalledTimes(confirmar ? 1 : 0);
    expect(estadoCommit).toHaveBeenCalledExactlyOnceWith(true);
    expect(log).toHaveBeenCalledExactlyOnceWith("[financeiro] Operação confirmada. Falha no recálculo de acesso às aulas; reavaliação pendente pelo cron institucional.");
  });

  it("cada informe conserva o prazo de 48 horas mesmo se a configuração mudar antes do replay", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
    const entrada = { chaveIdempotencia: "pagamento-unitario-prazo", valorRecebido: 40, forma: "DINHEIRO" as const };
    expect((await registrarPagamento("cobranca", entrada)).ok).toBe(true);
    const data = m.pagamentoInformado.create.mock.calls[0][0].data;
    expect(data.suspenderLembretesAte).toEqual(new Date("2026-09-10T12:00:00Z"));
    m.pagamentoInformado.findUnique.mockResolvedValue({ ...data, id: "informe", versao: 1 });
    m.configuracaoOperacional.findUnique.mockResolvedValue({ prazoConferenciaHoras: 72 });
    vi.setSystemTime(new Date("2026-09-09T12:00:00Z"));
    expect((await registrarPagamento("cobranca", entrada)).ok).toBe(true);
    expect(m.pagamentoInformado.create).toHaveBeenCalledOnce();
    expect(m.configuracaoOperacional.findUnique).toHaveBeenCalledOnce();
  });

  it("SEC não consulta os informes globais, mas consulta atendimento individual", async () => {
    await expect(listarInformesPagamento()).rejects.toThrow(/individual/);
    expect(m.pagamentoInformado.findMany).not.toHaveBeenCalled();
    expect(await listarInformesPagamento("aluno")).toEqual([]);
    expect(m.pagamentoInformado.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { cobranca: { matricula: { alunoId: "aluno" } } } }));
  });

  it("acumular FIN e SEC não permite conferir o próprio informe", async () => {
    m.papeis = [Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO];
    m.pagamentoInformado.findUnique.mockResolvedValue({ id: "informe", autorId: "operador", versao: 1, status: "A_CONFERIR" });
    const r = await conferirPagamento("informe", { versao: 1, confirmar: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/outra pessoa/);
    expect(m.recebimento.create).not.toHaveBeenCalled();
    expect(m.pagamentoInformado.update).not.toHaveBeenCalled();
  });

  it("a conferência rejeita mudança de moeda antes de movimentar saldo", async () => {
    m.papeis = [Papel.FINANCEIRO];
    m.pagamentoInformado.findUnique.mockResolvedValue({ id: "informe", cobrancaId: "cobranca", autorId: "secretaria", versao: 1, status: "A_CONFERIR", moeda: "USD", valor: new Prisma.Decimal(40), forma: "DINHEIRO", dataPagamento: new Date(), permitirExcedente: false });
    const r = await conferirPagamento("informe", { versao: 1, confirmar: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/moeda/);
    expect(m.recebimento.create).not.toHaveBeenCalled();
    expect(m.cobranca.update).not.toHaveBeenCalled();
    expect(m.pagamentoInformado.update).not.toHaveBeenCalled();
    expect(m.reavaliarAcesso).not.toHaveBeenCalled();
  });

  it("versão anterior do informe não pode ser confirmada", async () => {
    m.papeis = [Papel.FINANCEIRO];
    m.pagamentoInformado.findUnique.mockResolvedValue({ id: "informe", autorId: "secretaria", versao: 2, status: "A_CONFERIR" });
    const r = await conferirPagamento("informe", { versao: 1, confirmar: true });
    expect(r.ok).toBe(false);
    expect(m.recebimento.create).not.toHaveBeenCalled();
    expect(m.pagamentoInformado.update).not.toHaveBeenCalled();
  });
});

describe("fechamento de comissões", () => {
  it("não inclui comissão aprovada depois de selecionar e bloquear o lote", async () => {
    m.papeis = [Papel.FINANCEIRO];
    const comissoes = ["selecionada", "aprovada-depois"].map((id) => ({ id, status: "APROVADA", valor: new Prisma.Decimal(10), moeda: "BRL", politicaId: null }));
    m.$queryRaw.mockResolvedValue([{ id: "selecionada" }]);
    m.comissao.findMany.mockImplementation(async ({ where }: { where: { id?: { in: string[] } } }) => comissoes.filter((c) => !where.id || where.id.in.includes(c.id)));
    expect(await fecharMesComissoes()).toEqual({ ok: true, dado: { pagas: 1 } });
    expect(m.comissao.update).toHaveBeenCalledOnce();
    expect(m.comissao.update).toHaveBeenCalledWith({ where: { id: "selecionada" }, data: { status: "PAGA", pagaEm: expect.any(Date) } });
  });
});
