import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import type { Db } from "./escopo";
const { globalDb } = vi.hoisted(() => ({ globalDb: { oportunidade: { count: vi.fn() }, participanteAtendimentoWhatsApp: { count: vi.fn() }, coberturaCarteira: { findMany: vi.fn() }, usuario: { findMany: vi.fn() } } }));
vi.mock("@/lib/prisma", () => ({ prisma: globalDb }));
import { podeVerLeadNaThread } from "./consultas-inbox";
const usuario = (papel: Papel) => ({ id: "u1", nome: "Usuário", papeis: [papel] });
const instante = Date.UTC(2026, 9, 23, 12);
function transacao() {
  const query = { oportunidade: { count: vi.fn().mockResolvedValue(1) }, participanteAtendimentoWhatsApp: { count: vi.fn().mockResolvedValue(0) }, coberturaCarteira: { findMany: vi.fn().mockResolvedValue([{ titularId: "coberto" }]) }, usuario: { findMany: vi.fn().mockResolvedValue([{ id: "equipe" }]) } };
  return { query, db: query as unknown as Db };
}
beforeEach(() => { vi.clearAllMocks(); for (const grupo of Object.values(globalDb)) for (const f of Object.values(grupo)) f.mockRejectedValue(new Error("cliente global indevido")); });
describe("visibilidade do lead usa o mesmo cliente do chamador", () => {
  it("vendedor/cobertura consultam tx, sem pedir conexão global", async () => {
    const { query, db } = transacao();
    expect(await podeVerLeadNaThread(usuario(Papel.VENDEDOR), "at1", "lead1", instante, db)).toBe(true);
    expect(query.oportunidade.count).toHaveBeenCalledWith({ where: { AND: [{ id: "lead1" }, { vendedorDonoId: { in: ["u1", "coberto"] } }] } });
    expect(globalDb.oportunidade.count).not.toHaveBeenCalled(); expect(globalDb.coberturaCarteira.findMany).not.toHaveBeenCalled();
  });
  it("equipe do gerente é lida na tx", async () => {
    const { query, db } = transacao();
    expect(await podeVerLeadNaThread(usuario(Papel.GERENTE_COMERCIAL), "at1", "lead1", instante, db)).toBe(true);
    expect(query.oportunidade.count).toHaveBeenCalledWith({ where: { AND: [{ id: "lead1" }, { vendedorDonoId: { in: ["equipe"] } }] } });
    expect(globalDb.usuario.findMany).not.toHaveBeenCalled();
  });
  it("convidado sem carteira usa participação vigente na mesma tx; revogado deixa de passar", async () => {
    const { query, db } = transacao(); query.participanteAtendimentoWhatsApp.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    expect(await podeVerLeadNaThread(usuario(Papel.FINANCEIRO), "at1", "lead1", instante, db)).toBe(true);
    expect(await podeVerLeadNaThread(usuario(Papel.FINANCEIRO), "at1", "lead1", instante, db)).toBe(false);
    expect(query.participanteAtendimentoWhatsApp.count).toHaveBeenCalledWith({ where: { atendimentoId: "at1", usuarioId: "u1", inicio: { lte: new Date(instante) }, fim: { gt: new Date(instante) }, revogadoEm: null } });
    expect(globalDb.participanteAtendimentoWhatsApp.count).not.toHaveBeenCalled();
  });
  it("administrador conserva atalho atual sem query", async () => {
    const { query, db } = transacao(); expect(await podeVerLeadNaThread(usuario(Papel.ADMINISTRADOR), "at1", "lead1", instante, db)).toBe(true);
    expect(query.oportunidade.count).not.toHaveBeenCalled(); expect(query.participanteAtendimentoWhatsApp.count).not.toHaveBeenCalled();
  });
  it("chamador antigo sem Db conserva defaultprisma", async () => {
    globalDb.participanteAtendimentoWhatsApp.count.mockResolvedValue(1);
    expect(await podeVerLeadNaThread(usuario(Papel.FINANCEIRO), "at1", "lead1", instante)).toBe(true);
  });
});
