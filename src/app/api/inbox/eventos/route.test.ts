import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { sessaoMock, sair } = vi.hoisted(() => ({ sessaoMock: vi.fn(), sair: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (orig) => ({ ...(await orig<typeof import("@/server/_shared/sessao")>()), exigirSessao: async () => { const u = await sessaoMock(); if (u === "SEM_SESSAO") throw new (await orig<typeof import("@/server/_shared/sessao")>()).ErroAutenticacao(); return u; } }));
vi.mock("@/server/inbox/barramento", () => ({ assinarInbox: vi.fn(() => sair), iniciarEscuta: vi.fn(async () => {}) }));
import { GET } from "./route";

beforeEach(() => { sessaoMock.mockReset(); sair.mockReset(); });
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
    expect(sair).not.toHaveBeenCalled();
    ctl.abort();
    expect(sair).toHaveBeenCalledTimes(1);
    await res.body!.cancel(); // cancel depois do abort não desassina de novo
    expect(sair).toHaveBeenCalledTimes(1);
  });
  it("cancel do corpo (aba fechada) desassina uma vez", async () => {
    sessaoMock.mockResolvedValue(sessao([Papel.VENDEDOR]));
    const ctl = new AbortController();
    const res = await GET(new Request("http://x/api/inbox/eventos", { signal: ctl.signal }));
    await res.body!.cancel();
    expect(sair).toHaveBeenCalledTimes(1);
    ctl.abort();
    expect(sair).toHaveBeenCalledTimes(1);
  });
});
