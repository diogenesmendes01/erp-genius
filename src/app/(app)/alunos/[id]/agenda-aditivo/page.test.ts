import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/42 L268–269 (docs/43 §6 item 7): a agenda não dizia de quem era, e em erro a tela virava um parágrafo solto.
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn(), identificacao: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/contratos/agenda-aditivo", () => ({ listarMatriculasConferenciaAgendaAditivo: mocks.listar }));
vi.mock("@/server/identificacao-registro", () => ({ consultarIdentificacaoAluno: mocks.identificacao }));
import Page from "./page";

const usuario = { id: "sec", papeis: [Papel.SECRETARIA_ACADEMICA] };
const renderizar = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "aluno-interno" }) }));

describe("conferir agenda para aditivo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue(usuario);
    mocks.identificacao.mockResolvedValue({ alunoId: "aluno-interno", aluno: "Carla Dias" });
  });

  it("identifica o aluno da agenda (nome, com link para a ficha) e lista as matrículas pelo código", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: [{ id: "matricula-interna", codigo: "M-000321", produto: { idioma: { nome: "Inglês" }, modalidade: { nome: "Particular" } } }] });
    const html = await renderizar();
    expect(mocks.identificacao).toHaveBeenCalledWith(usuario, "aluno-interno");
    expect(html).toContain('aria-label="Aluno desta agenda"');
    expect(html).toContain('<a class="text-brand-700 hover:underline" href="/alunos/aluno-interno">Carla Dias</a>');
    expect(html).toContain("Inglês · Particular · M-000321");
    expect(html.replace(/href="[^"]*"/g, "")).not.toMatch(/aluno-interno|matricula-interna/);
  });

  it("em erro, título, volta e identificação ficam; só o corpo vira o alerta", async () => {
    mocks.listar.mockResolvedValue({ ok: false, erro: "Permissão operacional necessária." });
    const html = await renderizar();
    expect(html).toContain("Conferir agenda para aditivo");
    expect(html).toContain('href="/alunos/aluno-interno"');
    expect(html).toContain("Carla Dias");
    expect(html).toContain('role="alert">Permissão operacional necessária.');
  });

  it("aluno fora do alcance: sem identificação, sem inventar nome", async () => {
    mocks.identificacao.mockResolvedValue(null);
    mocks.listar.mockResolvedValue({ ok: true, dado: [] });
    const html = await renderizar();
    expect(html).not.toContain("Aluno desta agenda");
    expect(html).toContain("Não há matrícula particular ativa com encontro futuro disponível.");
  });
});
