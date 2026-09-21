import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const m = vi.hoisted(() => ({ auth: vi.fn(), usuario: vi.fn(), registro: vi.fn(), matricula: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn(), unlink: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique: m.usuario }, registroUpload: { create: m.registro }, matricula: { findUnique: m.matricula } } }));
vi.mock("fs/promises", () => ({ writeFile: m.writeFile, mkdir: m.mkdir, unlink: m.unlink }));
vi.mock("next/server", () => ({ NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } }));
import { POST } from "./route";
function request(matriculaId?: string) {
  const form = new FormData(); form.append("file", new File(["%PDF-1.7"], "documento.html", { type: "application/pdf" }));
  if (matriculaId) { form.append("matriculaId", matriculaId); form.append("categoriaDocumento", "CONTRATO"); }
  return new Request("http://localhost/api/upload", { method: "POST", body: form });
}
beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "autor", papeis: [Papel.VENDEDOR] } });
  m.usuario.mockResolvedValue({ nome: "Autor", ativo: true, papeis: [Papel.VENDEDOR] });
});
describe("upload usa estado atual da sessão", () => {
  it("cookie válido de usuário desativado recebe 401 sem gravação", async () => {
    m.usuario.mockResolvedValue({ nome: "Autor", ativo: false, papeis: [Papel.VENDEDOR] });
    expect((await POST(request())).status).toBe(401);
    expect(m.writeFile).not.toHaveBeenCalled(); expect(m.registro).not.toHaveBeenCalled();
  });
  it("papel comercial revogado não autoriza envio com dados antigos do JWT", async () => {
    m.usuario.mockResolvedValue({ nome: "Autor", ativo: true, papeis: [Papel.PROFESSOR] });
    expect((await POST(request())).status).toBe(403);
    expect(m.writeFile).not.toHaveBeenCalled();
  });
  it("upload autorizado registra autoria e deriva extensão do tipo permitido", async () => {
    const res = await POST(request()); expect(res.status).toBe(200);
    const body = await res.json(); expect(body.url).toMatch(/^\/api\/files\/[a-f0-9-]+\.pdf$/);
    expect(m.registro.mock.calls[0][0].data).toMatchObject({ autorId: "autor", mime: "application/pdf", nome: "documento.html", url: body.url });
  });
  it("Secretaria envia contrato diretamente para matrícula assumida", async () => {
    m.usuario.mockResolvedValue({ nome: "Autor", ativo: true, papeis: [Papel.SECRETARIA_ACADEMICA] });
    m.matricula.mockResolvedValue({ alunoId: "aluno", secretariaAssumiuEm: new Date() });
    expect((await POST(request("matricula"))).status).toBe(200);
    expect(m.registro.mock.calls[0][0].data).toMatchObject({ autorId: "autor", alunoId: "aluno", matriculaId: "matricula", categoriaDocumento: "CONTRATO" });
  });
  it("vendedor não envia documento diretamente para matrícula", async () => {
    expect((await POST(request("matricula"))).status).toBe(403);
    expect(m.writeFile).not.toHaveBeenCalled();
  });
});
