import { describe, it, expect, vi, beforeEach } from "vitest";
import { Papel } from "@prisma/client";

// Mocks: sessão (auth), Prisma e o sistema de arquivos. Testa a rota ponta a ponta
// (autenticação + autorização por objeto + defesa contra path traversal).
const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));

const cobrancaFindFirst = vi.fn();
const documentoFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cobranca: { findFirst: (...a: unknown[]) => cobrancaFindFirst(...a) },
    documento: { findFirst: (...a: unknown[]) => documentoFindFirst(...a) },
  },
}));

const readFileMock = vi.fn();
vi.mock("fs/promises", () => ({ readFile: (...a: unknown[]) => readFileMock(...a) }));

import { GET } from "./route";

function ctx(segmentos: string[]) {
  return { params: Promise.resolve({ path: segmentos }) };
}
const req = new Request("http://localhost/api/files/x");

beforeEach(() => {
  authMock.mockReset();
  cobrancaFindFirst.mockReset().mockResolvedValue(null);
  documentoFindFirst.mockReset().mockResolvedValue(null);
  readFileMock.mockReset().mockResolvedValue(Buffer.from("PDFDATA"));
});

describe("GET /api/files/[...path]", () => {
  it("401 sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(req, ctx(["a.pdf"]));
    expect(res.status).toBe(401);
  });

  it("usuário autorizado lê o arquivo (200) e marca como privado", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", papeis: [Papel.FINANCEIRO] } });
    cobrancaFindFirst.mockResolvedValue({ id: "c1" }); // comprovante existe

    const res = await GET(req, ctx(["123-comprovante.pdf"]));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(readFileMock).toHaveBeenCalled();
  });

  it("usuário autenticado sem escopo recebe 403 e NÃO lê o arquivo", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", papeis: [Papel.VENDEDOR] } });
    cobrancaFindFirst.mockResolvedValue({ id: "c1" }); // comprovante: vendedor não pode

    const res = await GET(req, ctx(["123-comprovante.pdf"]));
    expect(res.status).toBe(403);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("arquivo órfão (sem agregado) -> 403", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", papeis: [Papel.ADMINISTRADOR] } });
    const res = await GET(req, ctx(["orfao.pdf"]));
    expect(res.status).toBe(403);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("path traversal bloqueado (400) antes de qualquer leitura", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", papeis: [Papel.ADMINISTRADOR] } });
    const res = await GET(req, ctx(["..", "..", "etc", "passwd"]));
    expect(res.status).toBe(400);
    expect(readFileMock).not.toHaveBeenCalled();
    expect(cobrancaFindFirst).not.toHaveBeenCalled();
  });

  it("extensão não permitida -> 400", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", papeis: [Papel.ADMINISTRADOR] } });
    const res = await GET(req, ctx(["malware.exe"]));
    expect(res.status).toBe(400);
    expect(readFileMock).not.toHaveBeenCalled();
  });
});
