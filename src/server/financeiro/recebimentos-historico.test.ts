import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ auth: vi.fn(), registros: vi.fn(), eventos: vi.fn(), tx: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.tx } }));
vi.mock("@/server/_shared", async original => ({ ...await original<typeof import("@/server/_shared")>(), exigirSessaoComPapel: m.auth }));
import { ErroPermissao } from "@/server/_shared";
import { consultarHistoricoRecebimentos } from "./recebimentos-historico";
const prova = { recebimentoId: "r", titularMatriculaId: "m", hashDados: "hash", comprovanteUrl: "/api/files/antecipacao.pdf", comprovanteNome: "Transferência", comentario: "Adiantamento" };
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ id: "f" });
  m.tx.mockImplementation(fn => fn({ recebimento: { findMany: m.registros }, evento: { findMany: m.eventos } }));
  m.registros.mockResolvedValue([{ id: "r", titularMatriculaId: "m", hashDados: "hash", moeda: "BRL", valor: new Prisma.Decimal(100), forma: "TRANSFERENCIA", dataPagamento: new Date("2026-09-01"), destinacoes: [{ id: "d", tipo: "CREDITO_SEM_DESTINO", cobrancaId: null, valor: new Prisma.Decimal(100), evidencia: "Acordo" }] }]);
  m.eventos.mockResolvedValue([{ agregadoId: "r", payload: prova }]);
});
it("exige Financeiro antes de consultar o caixa", async () => {
  m.auth.mockRejectedValue(new ErroPermissao()); expect((await consultarHistoricoRecebimentos({})).ok).toBe(false); expect(m.tx).not.toHaveBeenCalled();
});
it("consulta prova ligada ao recebimento e contrato, com destinação explícita", async () => {
  const r = await consultarHistoricoRecebimentos({ matriculaId: "m" });
  expect(m.registros).toHaveBeenCalledWith(expect.objectContaining({ where: { titularMatriculaId: "m" } }));
  expect(r).toMatchObject({ ok: true, dado: { itens: [{ valor: "100.00", comprovante: { url: prova.comprovanteUrl }, destinos: [{ tipo: "CREDITO_SEM_DESTINO", valor: "100.00" }] }] } });
});
it.each([{ ...prova, titularMatriculaId: "outra" }, { ...prova, recebimentoId: "outro" }, { ...prova, hashDados: "outro" }, { ...prova, comprovanteUrl: "https://example.test/prova.pdf" }])("não associa prova divergente: %j", async payload => {
  m.eventos.mockResolvedValue([{ agregadoId: "r", payload }]);
  expect(await consultarHistoricoRecebimentos({})).toMatchObject({ ok: true, dado: { itens: [{ comprovante: null, evidenciaCaixaRegistrada: false }] } });
});
it("registro legado não recebe uma prova presumida", async () => {
  m.eventos.mockResolvedValue([]); expect(await consultarHistoricoRecebimentos({})).toMatchObject({ ok: true, dado: { itens: [{ comprovante: null, evidenciaCaixaRegistrada: false }] } });
});
