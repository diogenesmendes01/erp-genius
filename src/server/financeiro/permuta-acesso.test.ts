import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ consultar: vi.fn(), reavaliar: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { aplicacaoCompensacaoPermuta: { findMany: mocks.consultar } } }));
vi.mock("@/server/cobrancas/acesso-aulas", () => ({ reavaliarAcessoAutomaticoDaCobranca: mocks.reavaliar }));
import { reavaliarAcessoAposPermuta } from "./permuta-acesso";
beforeEach(() => { vi.resetAllMocks(); });
it("reavalia somente cobranças efetivamente compensadas pela decisão, sem duplicar", async () => {
  mocks.consultar.mockResolvedValue([{ cobrancaId: "a" }, { cobrancaId: "a" }, { cobrancaId: "b" }]);
  await reavaliarAcessoAposPermuta("decisao");
  expect(mocks.consultar).toHaveBeenCalledWith({ where: { decisaoId: "decisao" }, select: { cobrancaId: true } });
  expect(mocks.reavaliar.mock.calls).toEqual([["a"], ["b"]]);
});
it("falha no acesso não desfaz sucesso financeiro nem impede os outros destinos", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.consultar.mockResolvedValue([{ cobrancaId: "a" }, { cobrancaId: "b" }]);
  mocks.reavaliar.mockRejectedValueOnce(new Error("dado privado"));
  await expect(reavaliarAcessoAposPermuta("decisao")).resolves.toBeUndefined();
  expect(mocks.reavaliar).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(log.mock.calls)).not.toContain("dado privado");
  log.mockRestore();
});
it("falha na consulta posterior ao commit também preserva o sucesso", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.consultar.mockRejectedValue(new Error("indisponível"));
  await expect(reavaliarAcessoAposPermuta("decisao")).resolves.toBeUndefined();
  expect(mocks.reavaliar).not.toHaveBeenCalled();
  log.mockRestore();
});
