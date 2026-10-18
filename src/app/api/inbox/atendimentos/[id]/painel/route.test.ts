import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { sessaoMock, carregarPainel } = vi.hoisted(() => ({ sessaoMock: vi.fn(), carregarPainel: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (orig) => ({ ...(await orig<typeof import("@/server/_shared/sessao")>()), exigirSessao: async () => { const u = await sessaoMock(); if (u === "SEM_SESSAO") throw new (await orig<typeof import("@/server/_shared/sessao")>()).ErroAutenticacao(); return u; } }));
vi.mock("@/server/inbox/paineis", () => ({ carregarPainel }));
import { GET } from "./route";

beforeEach(() => { sessaoMock.mockReset(); carregarPainel.mockReset(); });
const sessao = (papeis: Papel[]) => ({ id: "u1", nome: "U", papeis });
const chamar = () => GET(new Request("http://x/api/inbox/atendimentos/a1/painel"), { params: Promise.resolve({ id: "a1" }) });

describe("GET /api/inbox/atendimentos/[id]/painel", () => {
  it("sem sessão → 401; papel sem inbox → 403, sem consultar", async () => {
    sessaoMock.mockResolvedValue("SEM_SESSAO");
    expect((await chamar()).status).toBe(401);
    sessaoMock.mockResolvedValue(sessao([Papel.ALUNO]));
    expect((await chamar()).status).toBe(403);
    expect(carregarPainel).not.toHaveBeenCalled();
  });
  it("fora do escopo → 404", async () => {
    sessaoMock.mockResolvedValue(sessao([Papel.FINANCEIRO]));
    carregarPainel.mockResolvedValue(null);
    expect((await chamar()).status).toBe(404);
  });
  it("no escopo → o painel do servidor, sem cache", async () => {
    const u = sessao([Papel.FINANCEIRO]);
    sessaoMock.mockResolvedValue(u);
    carregarPainel.mockResolvedValue({ setor: "FINANCEIRO", matriculaCodigo: "M-1", cobrancas: [] });
    const r = await chamar();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ setor: "FINANCEIRO", matriculaCodigo: "M-1", cobrancas: [] });
    expect(carregarPainel).toHaveBeenCalledWith(u, "a1");
  });
});
