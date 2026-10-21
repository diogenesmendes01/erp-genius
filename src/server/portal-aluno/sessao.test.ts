import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCookie: vi.fn((nome: string) => nome === "portal_aluno_session" ? undefined : { value: "cookie-de-funcionario" }),
  queryRaw: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.getCookie }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.queryRaw, $executeRaw: vi.fn() } }));

import { lerSessaoPortalAluno } from "./sessao";

describe("sessão exclusiva do portal", () => {
  it("não aceita cookie de funcionário como identidade do aluno", async () => {
    await expect(lerSessaoPortalAluno()).resolves.toBeNull();
    expect(mocks.getCookie).toHaveBeenCalledWith("portal_aluno_session");
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });
});
