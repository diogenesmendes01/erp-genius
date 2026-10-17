import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { sessaoMock } = vi.hoisted(() => ({ sessaoMock: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (orig) => ({ ...(await orig<typeof import("@/server/_shared/sessao")>()), exigirSessao: async () => { const u = await sessaoMock(); if (u === "SEM_SESSAO") throw new (await orig<typeof import("@/server/_shared/sessao")>()).ErroAutenticacao(); return u; } }));
vi.mock("@/server/inbox/barramento", () => ({ assinarInbox: vi.fn(() => () => {}), iniciarEscuta: vi.fn(async () => {}) }));
import { GET } from "./route";

beforeEach(() => sessaoMock.mockReset());
const sessao = (papeis: Papel[]) => ({ id: "u1", nome: "U", papeis });

describe("GET /api/inbox/eventos", () => {
  it("sem sessão → 401", async () => {
    sessaoMock.mockResolvedValue("SEM_SESSAO");
    expect((await GET(new Request("http://x/api/inbox/eventos"))).status).toBe(401);
  });
  it("aluno → 403", async () => {
    sessaoMock.mockResolvedValue(sessao([Papel.ALUNO]));
    expect((await GET(new Request("http://x/api/inbox/eventos"))).status).toBe(403);
  });
  it("com sessão → text/event-stream", async () => {
    sessaoMock.mockResolvedValue(sessao([Papel.VENDEDOR]));
    const ctl = new AbortController();
    const res = await GET(new Request("http://x/api/inbox/eventos", { signal: ctl.signal }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    ctl.abort();
  });
});
