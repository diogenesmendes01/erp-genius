import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ sessao: vi.fn(), transacao: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transacao } }));
vi.mock("@/server/_shared", async original => ({ ...(await original<typeof import("@/server/_shared")>()), exigirSessaoComPapel: m.sessao }));
vi.mock("next/server", () => ({ NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } }));
import { POST } from "./route";

const transcricao = { moeda: "CRC", aluno: { nome: "Aluno" }, taxa: { valor: "50.00", vencimento: "2025-01-05" },
  aulas: { regime: "MENSALIDADE", valor: "125.00", primeiroVencimento: "2025-01-10", cobertura: { referencia: "MES_CIVIL", inicio: "2025-01-01" } } };
function request(pdf: Uint8Array<ArrayBuffer>, assinadoEm = "2024-12-20") {
  const form = new FormData();
  form.append("pdfAssinado", new File([pdf], "contrato.pdf", { type: "application/pdf" }));
  for (const [k, v] of Object.entries({ referencia: "Contrato 2025/017", assinadoEm, motivo: "Contrato legado digitalizado.", chaveIdempotencia: "origem-historica-1", transcricao: JSON.stringify(transcricao) })) form.append(k, v);
  // Sem content-length, como num upload chunked.
  return new Request("http://localhost/api/matriculas/m1/origem-historica", { method: "POST", body: form });
}
const params = { params: Promise.resolve({ id: "m1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  m.sessao.mockResolvedValue({ id: "secretaria" });
  m.transacao.mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
});

// Revisão 5606023454 da #285.
describe("upload da origem histórica", () => {
  it("PDF acima de 20 MiB sem content-length: 413 antes de ler o arquivo e sem transação", async () => {
    const r = request(new Uint8Array(20 * 1024 * 1024 + 1));
    expect(r.headers.get("content-length")).toBeNull();
    const res = await POST(r, params);
    expect(res.status).toBe(413);
    expect(m.transacao).not.toHaveBeenCalled();
  });

  it("data de assinatura inexistente (2024-02-31) responde 400, não 500", async () => {
    const res = await POST(request(new Uint8Array(Buffer.from("%PDF-1.4 contrato")), "2024-02-31"), params);
    expect(res.status).toBe(400);
    expect((await res.json()).erro).toMatch(/assinadoEm: Data civil inválida/);
  });
});
