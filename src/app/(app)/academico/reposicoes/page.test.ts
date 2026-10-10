import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/42 L1244 (docs/43 §6 item 7): sem ?matriculaId= a tela mostrava só "Abra esta tela pelo contexto da
// matrícula" — sem busca, sem lista, sem link. Agora tem a busca, a lista e a saída para a ficha do aluno.
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), preferencia: vi.fn(), buscar: vi.fn(), consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/diario/reposicao-busca-matricula", () => ({ buscarMatriculasParaReposicao: mocks.buscar, LIMITE_BUSCA_REPOSICAO: 20 }));
vi.mock("@/server/diario/reposicao-consulta", () => ({ consultarReposicoesEquipe: mocks.consultar }));
vi.mock("@/server/diario/reposicao-entrega-operacional", () => ({ consultarOperacaoEntregaReposicao: vi.fn() }));
vi.mock("@/app/(app)/diario/reposicoes/ReposicoesEquipe", () => ({ ReposicoesEquipe: () => null, SolicitarReposicao: () => null }));
import Page from "./page";

const renderizar = async (busca?: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(busca ?? {}) }));

describe("/academico/reposicoes sem matrícula na URL", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "sec", papeis: [Papel.SECRETARIA_ACADEMICA] });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
  });

  it("sem busca: o formulário de busca e a saída para a lista de alunos, sem consultar", async () => {
    const html = await renderizar();
    expect(html).toMatch(/<form method="get" action="\/academico\/reposicoes" role="search"/);
    expect(html).toContain('name="busca"');
    expect(html).toContain('href="/alunos"');
    expect(html).not.toContain("Abra esta tela pelo contexto da matrícula");
    expect(mocks.buscar).not.toHaveBeenCalled();
    expect(mocks.consultar).not.toHaveBeenCalled();
  });

  it("com busca: a lista de matrículas, cada uma levando ao contexto dela (código, aluno; nunca o id como texto)", async () => {
    mocks.buscar.mockResolvedValue({ ok: true, dado: { maisResultados: true, itens: [
      { id: "matricula/1", codigo: "M-000010", status: "ATIVA", aluno: "Ana Souza", produto: "Inglês · Regular" },
      { id: "matricula-sem-codigo", codigo: null, status: "PAUSADA", aluno: "Bruno Lima", produto: "Espanhol · Particular" },
    ] } });
    const html = await renderizar({ busca: "  an  " });
    expect(mocks.buscar).toHaveBeenCalledWith({ busca: "an" });
    expect(html).toContain('href="/academico/reposicoes?matriculaId=matricula%2F1">M-000010 · Ana Souza</a>');
    expect(html).toContain(">Matrícula sem código · Bruno Lima</a>");
    expect(html).toContain("Pausada");
    expect(html).toContain("Mostrando as 20 matrículas mais recentes da busca.");
    expect(html.replace(/href="[^"]*"/g, "")).not.toContain("matricula-sem-codigo");
  });

  it("busca sem resultado: estado vazio com saída; falha da busca: o erro", async () => {
    mocks.buscar.mockResolvedValue({ ok: true, dado: { maisResultados: false, itens: [] } });
    const vazio = await renderizar({ busca: "zz" });
    expect(vazio).toContain("Nenhuma matrícula encontrada para “zz”.");
    expect(vazio).toContain('href="/alunos"');
    mocks.buscar.mockResolvedValue({ ok: false, erro: "Busca recusada." });
    expect(await renderizar({ busca: "zz" })).toContain('role="alert">Busca recusada.');
  });

  it("uma letra só não consulta (pede ao menos duas)", async () => {
    const html = await renderizar({ busca: "a" });
    expect(mocks.buscar).not.toHaveBeenCalled();
    expect(html).toContain("Digite ao menos duas letras");
  });
});
