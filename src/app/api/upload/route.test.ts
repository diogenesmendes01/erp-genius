import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const m = vi.hoisted(() => ({ auth: vi.fn(), usuario: vi.fn(), registro: vi.fn(), matricula: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn(), unlink: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique: m.usuario }, registroUpload: { create: m.registro }, matricula: { findUnique: m.matricula } } }));
vi.mock("fs/promises", () => ({ writeFile: m.writeFile, mkdir: m.mkdir, unlink: m.unlink }));
vi.mock("next/server", () => ({ NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } }));
import { POST } from "./route";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function request(matriculaId?: string, arquivo: { bytes?: Uint8Array; type?: string; nome?: string } = {}) {
  const form = new FormData();
  form.append("file", new File([arquivo.bytes ?? PDF], arquivo.nome ?? "documento.html", { type: arquivo.type ?? "application/pdf" }));
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

describe("upload confere magic bytes com o MIME declarado", () => {
  it.each([
    ["application/pdf", PDF, "pdf"],
    ["image/png", PNG, "png"],
    ["image/jpeg", JPEG, "jpg"],
    ["image/jpg", JPEG, "jpg"],
  ] as const)("aceita %s quando a assinatura real confere", async (type, bytes, extensao) => {
    const res = await POST(request(undefined, { bytes, type, nome: "comprovante.bin" }));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toMatch(new RegExp(`^/api/files/[a-f0-9-]+\\.${extensao}$`));
    expect(m.writeFile).toHaveBeenCalledOnce();
  });

  it("rejeita payload com MIME falsificado e não grava o arquivo", async () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    const res = await POST(request(undefined, { bytes: html, type: "application/pdf", nome: "contrato.pdf" }));
    expect(res.status).toBe(400);
    expect((await res.json()).erro).toMatch(/não corresponde ao tipo/);
    expect(m.writeFile).not.toHaveBeenCalled();
    expect(m.registro).not.toHaveBeenCalled();
  });

  it.each([
    ["image/png", JPEG],
    ["image/jpeg", PNG],
    ["image/jpg", PDF],
    ["application/pdf", PNG],
  ] as const)("rejeita %s quando os bytes são de outro formato", async (type, bytes) => {
    const res = await POST(request(undefined, { bytes, type }));
    expect(res.status).toBe(400);
    expect(m.writeFile).not.toHaveBeenCalled();
  });

  it("rejeita assinatura truncada", async () => {
    const res = await POST(request(undefined, { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]), type: "image/png" }));
    expect(res.status).toBe(400);
    expect(m.writeFile).not.toHaveBeenCalled();
  });
});
