import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  usuario: vi.fn(),
  versoes: vi.fn(),
  conjuntos: vi.fn(),
  cobrancas: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {
  usuario: { findUnique: mocks.usuario },
  versaoCondicoesAditivo: { findMany: mocks.versoes, findFirst: vi.fn() },
  conjuntoImpactosCoberturaAditivo: { findFirst: mocks.conjuntos },
  cobranca: { findMany: mocks.cobrancas },
} }));
vi.mock("@/server/_shared", async importOriginal => ({
  ...await importOriginal<typeof import("@/server/_shared")>(),
  exigirSessaoComPapel: mocks.auth,
}));

import { ErroPermissao } from "@/server/_shared";
import { listarAditivosParaCobertura } from "./aditivo-cobertura-consulta";

describe("lista financeira de cobertura", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejeita a chamada direta sem alçada antes de ler versões", async () => {
    mocks.auth.mockRejectedValue(new ErroPermissao());
    expect((await listarAditivosParaCobertura(1)).ok).toBe(false);
    expect(mocks.versoes).not.toHaveBeenCalled();
  });

  it("reconfere usuário ativo e papel atual antes de ler versões", async () => {
    mocks.auth.mockResolvedValue({ id: "financeiro" });
    mocks.usuario.mockResolvedValue({ ativo: false, papeis: ["FINANCEIRO"], permissoes: [] });
    expect((await listarAditivosParaCobertura(1)).ok).toBe(false);
    expect(mocks.versoes).not.toHaveBeenCalled();
  });

  it("recusa o papel financeiro removido depois da sessão", async () => {
    mocks.auth.mockResolvedValue({ id: "financeiro" });
    mocks.usuario.mockResolvedValue({ ativo: true, papeis: ["SECRETARIA_ACADEMICA"], permissoes: [] });
    expect((await listarAditivosParaCobertura(1)).ok).toBe(false);
    expect(mocks.versoes).not.toHaveBeenCalled();
  });

  it("filtra as duas datas de cobertura no banco e pagina ordenadamente", async () => {
    mocks.auth.mockResolvedValue({ id: "financeiro" });
    mocks.usuario.mockResolvedValue({ ativo: true, papeis: ["FINANCEIRO"], permissoes: [] });
    mocks.versoes.mockResolvedValue(Array.from({ length: 21 }, (_, indice) => ({ matriculaId: `m-${indice}`, propostaId: `p-${indice}`, versao: indice + 1 })));

    const resultado = await listarAditivosParaCobertura(3);

    expect(resultado).toMatchObject({ ok: true, dado: { itens: expect.any(Array), temProxima: true } });
    expect(resultado.ok && resultado.dado?.itens).toHaveLength(20);
    expect(mocks.versoes).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        expect.objectContaining({ condicoes: expect.objectContaining({ path: ["COBERTURA_INICIO"] }) }),
        expect.objectContaining({ condicoes: expect.objectContaining({ path: ["COBERTURA_FIM"] }) }),
      ]) },
      orderBy: [{ registradaEm: "desc" }, { id: "desc" }],
      skip: 40,
      take: 21,
      select: { matriculaId: true, propostaId: true, versao: true },
    }));
  });
});
