import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), vendedor: vi.fn(), gerente: vi.fn(), professor: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/home/consultas", () => ({ dadosHomeVendedor: mocks.vendedor, dadosHomeGerente: mocks.gerente, dadosHomeProfessor: mocks.professor }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./HomeVendedor", () => ({ HomeVendedor: (p: { preferenciaFusoExibicao: string | null }) => `vendedor:${p.preferenciaFusoExibicao}` }));
vi.mock("./HomeProfessor", () => ({ HomeProfessor: (p: { preferenciaFusoExibicao: string | null; proximaExperimental: unknown }) => `professor:${p.preferenciaFusoExibicao}:${p.proximaExperimental ? "com-proxima" : "sem-proxima"}` }));
vi.mock("./HomeGerente", () => ({ HomeGerente: () => "gerente" }));

import Page from "./page";

describe("HomePage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("lê a preferência após a guarda e a encaminha para a home do professor", async () => {
    mocks.sessao.mockResolvedValue({ id: "prof", nome: "Prof", papeis: ["PROFESSOR"] });
    mocks.professor.mockResolvedValue({ turmas: [], experimentais: [], proximaExperimental: null });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });

    expect(renderToStaticMarkup(await Page())).toBe("professor:America/Costa_Rica:sem-proxima");
    expect(mocks.sessao.mock.invocationCallOrder[0]).toBeLessThan(mocks.professor.mock.invocationCallOrder[0]!);
    expect(mocks.sessao.mock.invocationCallOrder[0]).toBeLessThan(mocks.preferencia.mock.invocationCallOrder[0]!);
  });

  it("usa UTC implícito quando a preferência falha e não consulta nada se a guarda falha", async () => {
    mocks.sessao.mockResolvedValue({ id: "vend", nome: "Vend", papeis: ["VENDEDOR"] });
    mocks.vendedor.mockResolvedValue({});
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "indisponível" });
    expect(renderToStaticMarkup(await Page())).toBe("vendedor:null");

    vi.clearAllMocks();
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page()).rejects.toThrow("Sem sessão");
    expect(mocks.vendedor).not.toHaveBeenCalled();
    expect(mocks.professor).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
