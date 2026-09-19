import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resultados: vi.fn(), fechamentos: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/portal-aluno/resultados", () => ({ consultarResultadosPortalAluno: mocks.resultados }));
vi.mock("@/server/portal-aluno/fechamentos", () => ({ consultarFechamentosPortalAluno: mocks.fechamentos }));
vi.mock("@/server/portal-aluno/preferencia-fuso", () => ({ consultarPreferenciaFusoPortalAluno: mocks.preferencia }));
import Page from "./page";

const pendencias = {
  frequenciaHistorica: 0,
  correcoesRegulares: 0,
  correcoesRecuperacao: 0,
  planosAguardandoDecisao: 0,
  planosSemDisponibilizacao: 0,
  tentativasAguardandoRealizacao: 0,
  habilidadesSemTentativa: 0,
  oportunidadesExtrasAguardandoDecisao: 0,
};

const resultados = {
  situacao: "PARCIAL_NAO_FINAL" as const,
  resultadoFinal: null,
  matriculas: [
    {
      matriculaId: "matricula-a",
      codigo: "MAT-A",
      alocacoes: [{
        alocacaoId: "alocacao-a",
        nivelId: "nivel-a",
        idioma: "Inglês",
        nivel: "A1",
        turma: "Turma A",
        regraVersao: 2,
        situacao: "PARCIAL_NAO_FINAL" as const,
        resultadoFinal: null,
        avaliacoes: [],
        recuperacoes: [],
        frequencia: null,
        consolidado: null,
        pendencias,
      }],
    },
    {
      matriculaId: "matricula-b",
      codigo: "MAT-B",
      alocacoes: [{
        alocacaoId: "alocacao-b",
        nivelId: "nivel-b",
        idioma: "Espanhol",
        nivel: "B1",
        turma: "Turma B",
        regraVersao: 3,
        situacao: "PARCIAL_NAO_FINAL" as const,
        resultadoFinal: null,
        avaliacoes: [],
        recuperacoes: [],
        frequencia: null,
        consolidado: null,
        pendencias,
      }],
    },
  ],
};

const fechamentos = [{
  matriculaId: "matricula-a",
  nivelId: "nivel-a",
  estado: "CONFIRMADO_SUFICIENTE" as const,
  versao: 4,
  confirmadoEm: "2026-10-01T02:30:00.000Z",
  resumo: null,
}];

describe("resultados do portal do aluno", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.resultados.mockResolvedValue(resultados);
    mocks.fechamentos.mockResolvedValue(fechamentos);
    mocks.preferencia.mockResolvedValue({ fusoExibicao: "America/Costa_Rica" });
  });

  it("mostra a confirmação no fuso da própria conta sem misturar matrículas", async () => {
    const html = renderToStaticMarkup(await Page());

    expect(html).toContain("Última confirmação em 30/09/2026, 20:30 (horário exibido em America/Costa_Rica)");
    expect(html).toContain("Matrícula MAT-A");
    expect(html).toContain("Matrícula MAT-B");
    expect(html).toContain("Turma A");
    expect(html).toContain("Turma B");
  });

  it("recorre a UTC sem preferência, sem alterar o fechamento informado", async () => {
    mocks.preferencia.mockResolvedValue({ fusoExibicao: null });

    const html = renderToStaticMarkup(await Page());

    expect(html).toContain("Última confirmação em 01/10/2026, 02:30 (horário exibido em UTC)");
    expect(html).toContain("Versão do fechamento 4");
  });

  it("não lê fechamentos ou preferência quando a autorização inicial falha", async () => {
    mocks.resultados.mockRejectedValue(new Error("Sessão inválida"));

    await expect(Page()).rejects.toThrow("Sessão inválida");
    expect(mocks.fechamentos).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
