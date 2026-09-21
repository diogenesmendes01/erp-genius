import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/academico/acoes", () => ({
  solicitarMudancaAcademica: vi.fn(), registrarParecerMudanca: vi.fn(), decidirMudancaAcademica: vi.fn(),
  executarMudancaAcademica: vi.fn(), cancelarMudancaAcademica: vi.fn(),
}));

import { MudancasAcademicasPainel } from "./MudancasAcademicasPainel";

const solicitacao = {
  id: "solicitacao", alunoId: "aluno", alunoNome: "Ana", status: "PENDENTE", criadoEm: "2026-10-01T02:30:00.000Z",
  solicitante: { nome: "Secretaria" }, origem: { label: "Turma A", diasHorario: null }, destino: { label: "Turma B", diasHorario: null },
  motivo: "Mudança necessária", impedimento: null, pareceres: [{ id: "parecer", conteudo: "Apto", autorNome: "Professor", criadoEm: "2026-10-01T03:30:00.000Z" }],
  aprovador: null, decididoEm: null, motivoDecisao: null, justificativaDispensaParecer: null,
  executor: null, executadoEm: null, motivoExecucao: null, cancelador: null, canceladoEm: null, motivoCancelamento: null,
  podeDarParecer: false, podeDecidir: false, podeExecutar: false, podeCancelar: false, temParecerVigente: false,
};

describe("datas do painel de mudanças acadêmicas", () => {
  it("apresenta instantes UTC na preferência atravessando o dia", () => {
    const html = renderToStaticMarkup(createElement(MudancasAcademicasPainel, { solicitacoes: [solicitacao] as never, fusoExibicao: "America/Costa_Rica" }));
    expect(html).toContain("Instantes administrativos exibidos em America/Costa_Rica (origem UTC).");
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toMatch(/30\/09\/2026.*21:30/);
  });

  it("mantém o fallback legado de São Paulo", () => {
    const html = renderToStaticMarkup(createElement(MudancasAcademicasPainel, { solicitacoes: [solicitacao] as never }));
    expect(html).toContain("Instantes administrativos exibidos em America/Sao_Paulo (origem UTC).");
    expect(html).toMatch(/30\/09\/2026.*23:30/);
  });
});
