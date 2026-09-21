import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessao: vi.fn(),
  aluno: vi.fn(),
  paises: vi.fn(),
  preferencia: vi.fn(),
  impedimento: vi.fn(),
  turmaSugerida: vi.fn(),
}));

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/alunos/consultas", () => ({
  obterAluno: mocks.aluno,
  podeEditarCadastroAluno: () => true,
  podeMovimentarAluno: () => true,
}));
vi.mock("@/server/paises/consultas", () => ({ listarPaisesOperacionais: mocks.paises }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/matricula/limite-legado", () => ({ impedimentoFluxoGlobal: mocks.impedimento }));
vi.mock("@/server/matricula/consultas", () => ({ turmaSugeridaParaAluno: mocks.turmaSugerida }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("Não encontrado"); }) }));
vi.mock("./FichaAluno", () => ({
  FichaAluno: ({ aluno, preferenciaFusoExibicao }: { aluno: { financeiro: unknown }; preferenciaFusoExibicao: string | null }) =>
    createElement("pre", null, JSON.stringify({ financeiro: aluno.financeiro, preferenciaFusoExibicao })),
}));

import Page from "./page";

const dados = {
  aluno: {
    id: "aluno", codigo: "A-1", primeiroNome: "Ana", sobrenome: "Silva", nomePreferido: null,
    status: "ATIVO", pais: { nome: "Costa Rica" }, paisId: "pais", nascimento: null, genero: null,
    tipoDocumentoId: null, documento: null, documentoValido: false, documentoPaisEmissor: null,
    nacionalidade: null, segundaNacionalidade: null, telefoneE164: null, email: null, whatsapp: false,
    aceitaComunicacoes: false, paisResidencia: null, cep: null, rua: null, numero: null, complemento: null,
    bairro: null, cidade: null, regiao: null, escolaridade: null, idiomaNativo: null, fuso: null,
    observacoes: null, alocacoes: [], movimentacoes: [],
  },
  financeiro: {
    atrasado: false,
    emAberto: [{ moeda: "CRC", valor: 80 }],
    proximoVencimento: { estado: "CONFIRMADO", dataCivil: "2099-10-05", fuso: "Pacific/Kiritimati", origem: "EMISSAO_ENTRADA" },
  },
};

describe("ficha principal do aluno", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "secretaria", papeis: ["SECRETARIA_ACADEMICA"] });
    mocks.aluno.mockResolvedValue(dados);
    mocks.paises.mockResolvedValue([]);
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    mocks.impedimento.mockResolvedValue(false);
    mocks.turmaSugerida.mockResolvedValue(null);
  });

  it("passa a referência civil confirmada e a preferência depois da guarda", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "aluno" }) }));

    expect(html).toContain("2099-10-05");
    expect(html).toContain("America/Costa_Rica");
    expect(mocks.aluno).toHaveBeenCalledWith("aluno", expect.objectContaining({ id: "secretaria" }));
  });

  it("mantém a conferência sem fonte e não consulta dados ou preferência quando a guarda falha", async () => {
    mocks.aluno.mockResolvedValueOnce({
      ...dados,
      financeiro: { ...dados.financeiro, proximoVencimento: { estado: "A_CONFERIR", motivo: "Memória ausente" } },
    });
    mocks.preferencia.mockResolvedValueOnce({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "aluno" }) }));
    expect(html).toContain("A_CONFERIR");
    expect(html).toContain("preferenciaFusoExibicao&quot;:null");

    vi.resetAllMocks();
    mocks.sessao.mockRejectedValueOnce(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ id: "outro" }) })).rejects.toThrow("Sem sessão");
    expect(mocks.aluno).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
