import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { sincronizarVinculoDocente } from "./vinculo-docente";
const tx = { usuario: { findFirst: vi.fn() }, vinculoDocente: { findMany: vi.fn(), updateMany: vi.fn(), create: vi.fn() } };
beforeEach(() => { vi.clearAllMocks(); tx.usuario.findFirst.mockResolvedValue({ id: "novo" }); tx.vinculoDocente.findMany.mockResolvedValue([{ id: "v1", professorId: "antigo" }]); });
describe("períodos docentes acompanham a atribuição da turma", () => {
  it("substituição fecha antigo e inicia novo no mesmo instante, sem retroagir", async () => {
    const agora = new Date(); await sincronizarVinculoDocente(tx as unknown as Prisma.TransactionClient, "t1", "novo", agora);
    expect(tx.vinculoDocente.updateMany).toHaveBeenCalledWith({ where: { turmaId: "t1", fim: null }, data: { fim: agora } });
    expect(tx.vinculoDocente.create).toHaveBeenCalledWith({ data: { turmaId: "t1", professorId: "novo", inicio: agora } });
  });
  it("edição sem troca de professor não redefine início do vínculo", async () => {
    await sincronizarVinculoDocente(tx as unknown as Prisma.TransactionClient, "t1", "antigo");
    expect(tx.vinculoDocente.updateMany).not.toHaveBeenCalled(); expect(tx.vinculoDocente.create).not.toHaveBeenCalled();
  });
  it("conclusão fecha período sem criar outro", async () => {
    await sincronizarVinculoDocente(tx as unknown as Prisma.TransactionClient, "t1", null);
    expect(tx.vinculoDocente.updateMany).toHaveBeenCalled(); expect(tx.vinculoDocente.create).not.toHaveBeenCalled();
  });
});
