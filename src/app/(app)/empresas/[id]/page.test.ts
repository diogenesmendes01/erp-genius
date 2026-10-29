import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const estado = vi.hoisted(() => ({ papeis: ["FINANCEIRO"] as string[] }));
const mocks = vi.hoisted(() => ({
  empresa: vi.fn(),
  competencias: vi.fn(async () => [] as string[]),
  produtos: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("Registro não encontrado");
  }),
}));

vi.mock("@/lib/guards", () => ({
  exigirPapelLeitura: async (...alvo: string[]) => {
    const papeis = estado.papeis;
    const ok = papeis.includes("ADMINISTRADOR") || alvo.some((p) => papeis.includes(p));
    return ok ? papeis : null;
  },
}));
vi.mock("@/server/empresas/consultas", () => ({
  obterEmpresa: mocks.empresa,
  competenciasFaturaveis: mocks.competencias,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { produto: { findMany: mocks.produtos } } }));
vi.mock("@/server/_shared", () => ({
  exigirSessaoComPapel: async (...alvo: string[]) => {
    const papeis = estado.papeis;
    if (!(papeis.includes("ADMINISTRADOR") || alvo.some((p) => papeis.includes(p)))) {
      const erro = new Error("Você não tem permissão para esta ação.");
      erro.name = "ErroPermissao";
      throw erro;
    }
    return { id: "u1", nome: "U", papeis };
  },
}));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: async () => ({ vendedorDonoId: { in: ["u1"] } }) }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("./FichaEmpresa", () => ({
  FichaEmpresa: ({ empresa }: { empresa: { nome: string } }) => createElement("h1", null, empresa.nome),
}));

import EmpresaDetalhePage from "./page";

const ficha = {
  empresa: {
    id: "qa_empresa_3", codigo: "E3", nome: "QA Empresa 3", paisId: null, documento: null,
    contatoNome: null, contatoEmail: null, contatoTelefone: null, diaVencimento: 10, observacoes: null, ativo: true,
  },
  colaboradores: [],
  faturas: [],
};

const html = async () => renderToStaticMarkup(await EmpresaDetalhePage({ params: Promise.resolve({ id: "qa_empresa_3" }) }));

describe("ficha /empresas/[id] por papel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estado.papeis = [Papel.FINANCEIRO];
    mocks.empresa.mockResolvedValue(ficha);
    mocks.competencias.mockResolvedValue([]);
    mocks.produtos.mockResolvedValue([{ id: "p1", idioma: { nome: "Inglês" }, modalidade: { nome: "Grupo" } }]);
  });

  it("FINANCEIRO vê a ficha; o catálogo de matrícula não derruba o render", async () => {
    expect(await html()).toContain("QA Empresa 3");
    expect(mocks.empresa).toHaveBeenCalledWith("qa_empresa_3");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("ADMINISTRADOR vê a ficha", async () => {
    estado.papeis = [Papel.ADMINISTRADOR];
    expect(await html()).toContain("QA Empresa 3");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it.each([Papel.PROFESSOR, Papel.SECRETARIA_ACADEMICA])("%s continua sem acesso e sem consulta", async (papel) => {
    estado.papeis = [papel];
    expect(await html()).toContain("Acesso negado");
    expect(mocks.empresa).not.toHaveBeenCalled();
    expect(mocks.produtos).not.toHaveBeenCalled();
  });

  it.each([Papel.GERENTE_COMERCIAL, Papel.VENDEDOR])("%s fora da carteira segue como registro não encontrado", async (papel) => {
    estado.papeis = [papel];
    mocks.empresa.mockResolvedValue(null);
    await expect(html()).rejects.toThrow("Registro não encontrado");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.produtos).not.toHaveBeenCalled();
  });
});
