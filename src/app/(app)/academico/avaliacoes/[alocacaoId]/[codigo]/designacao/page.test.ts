import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/designacao", () => ({ consultarDesignacoesAvaliacao: mocks.consultar, designarAvaliador: vi.fn() }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./Formulario", () => ({ FormularioDesignacao: () => null }));

import Page from "./page";

const dado = {
  titulo: "Avaliação final", identificacao: { aluno: "Ana", matriculaId: "matricula", matriculaCodigo: "M-1", oferta: "Inglês", turma: "Turma 1", nivel: "A1" },
  atual: { professor: { id: "professor", nome: "Bia", ativo: true } }, versaoEsperada: 1, podeAlterar: true,
  historico: [{ id: "designacao", versao: 1, professor: { id: "professor", nome: "Bia", ativo: true }, gestor: { id: "gestao", nome: "Carla" }, criadaEm: "2026-10-01T02:30:00.000Z", motivo: "Designação independente" }],
  pagina: 1, temProxima: false, professores: [], refinarBusca: false, busca: "",
};

const renderizar = () => Page({ params: Promise.resolve({ alocacaoId: "alocacao", codigo: "final" }), searchParams: Promise.resolve({}) });

describe("designação de avaliador", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "gestao" });
    mocks.consultar.mockResolvedValue({ ok: true, dado });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("mostra o histórico administrativo na preferência pessoal sem remover a busca", async () => {
    const html = renderToStaticMarkup(await renderizar());
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toContain('name="busca"');
    expect(html).toContain('href="/academico/avaliacoes/alocacao/final"');
  });

  it("usa UTC sem preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await renderizar());
    expect(html).toMatch(/01\/10\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });

  it("não consulta designações ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(renderizar()).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
