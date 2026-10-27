import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ sessao: vi.fn(), usuario: vi.fn() }));
vi.mock("@/server/_shared", async () => ({
  ...(await vi.importActual<typeof import("@/server/_shared")>("@/server/_shared")),
  exigirSessaoComPapel: m.sessao,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUniqueOrThrow: m.usuario, findUnique: m.usuario } } }));

import { podeConfigurarComissoes } from "./consultas";

beforeEach(() => { vi.clearAllMocks(); });

describe("podeConfigurarComissoes", () => {
  it("administrador sempre; financeiro só com comissao.configurar — sem reler o usuário", async () => {
    m.sessao.mockResolvedValueOnce({ id: "a", papeis: ["ADMINISTRADOR"], permissoes: [] });
    expect(await podeConfigurarComissoes()).toBe(true);
    m.sessao.mockResolvedValueOnce({ id: "f", papeis: ["FINANCEIRO"], permissoes: ["comissao.configurar"] });
    expect(await podeConfigurarComissoes()).toBe(true);
    m.sessao.mockResolvedValueOnce({ id: "f", papeis: ["FINANCEIRO"], permissoes: [] });
    expect(await podeConfigurarComissoes()).toBe(false);
    m.sessao.mockResolvedValueOnce({ id: "f", papeis: ["FINANCEIRO"] });
    expect(await podeConfigurarComissoes()).toBe(false);
    expect(m.usuario).not.toHaveBeenCalled();
  });
});
