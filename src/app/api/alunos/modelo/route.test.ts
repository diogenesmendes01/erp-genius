import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import ExcelJS from "exceljs";

const m = vi.hoisted(() => ({ auth: vi.fn(), usuario: vi.fn(), paises: vi.fn(), modalidades: vi.fn(), niveis: vi.fn(), professores: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  usuario: { findUnique: m.usuario, findMany: m.professores }, pais: { findMany: m.paises },
  modalidade: { findMany: m.modalidades }, nivel: { findMany: m.niveis },
} }));

import { GET as alunos } from "./route";
import { GET as turmas } from "@/app/api/turmas/modelo/route";

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "admin", papeis: [Papel.ADMINISTRADOR] } });
  m.usuario.mockResolvedValue({ nome: "Admin", ativo: true, papeis: [Papel.ADMINISTRADOR] });
  m.paises.mockResolvedValue([{ nome: "Costa Rica", tiposDocumento: [{ nome: "Cédula" }] }]);
  m.modalidades.mockResolvedValue([{ nome: "Regular" }]);
  m.niveis.mockResolvedValue([{ codigo: "A1", idioma: { nome: "Português" } }]);
  m.professores.mockResolvedValue([{ nome: "Professor ativo" }]);
});

describe.each([{ nome: "alunos", get: alunos, aba: "Alunos", opcao: "Costa Rica" }, { nome: "turmas", get: turmas, aba: "Turmas", opcao: "Professor ativo" }])("modelo de $nome exige estado atual", ({ get, aba, opcao }) => {
  it("nega sessão ausente antes de consultar o catálogo", async () => {
    m.auth.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    expect(m.usuario).not.toHaveBeenCalled();
    expect(m.paises).not.toHaveBeenCalled();
    expect(m.modalidades).not.toHaveBeenCalled();
  });
  it("desativação invalida o cookie administrativo", async () => {
    m.usuario.mockResolvedValue({ nome: "Admin", ativo: false, papeis: [Papel.ADMINISTRADOR] });
    expect((await get()).status).toBe(401);
    expect(m.paises).not.toHaveBeenCalled();
    expect(m.modalidades).not.toHaveBeenCalled();
  });
  it("revogação do papel bloqueia o download apesar do JWT antigo", async () => {
    m.usuario.mockResolvedValue({ nome: "Admin", ativo: true, papeis: [Papel.SECRETARIA_ACADEMICA] });
    expect((await get()).status).toBe(403);
    expect(m.paises).not.toHaveBeenCalled();
    expect(m.modalidades).not.toHaveBeenCalled();
  });
  it("admin atual recebe uma planilha legível com as opções autorizadas", async () => {
    m.auth.mockResolvedValue({ user: { id: "admin", papeis: [Papel.VENDEDOR] } });
    const resposta = await get();
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Content-Type")).toContain("spreadsheetml");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await resposta.arrayBuffer());
    expect(workbook.getWorksheet(aba)?.rowCount).toBeGreaterThan(1);
    expect(JSON.stringify(workbook.getWorksheet("Listas")?.getSheetValues())).toContain(opcao);
  });
});
