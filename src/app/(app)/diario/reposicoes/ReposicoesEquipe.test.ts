import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { ReposicoesEquipe } from "./ReposicoesEquipe";

it("oferece agendamento inicial somente por docente legível e autorização excepcional aprovada", () => {
  const html = renderToStaticMarkup(createElement(ReposicoesEquipe, { reposicoes: [{
    id: "reposicao-1", modalidade: "PARTICULAR", solicitadaEm: "2026-09-01T10:00:00.000Z", solicitadaPor: "Secretaria",
    motivo: "Ausência conferida", evidencia: "Registro acadêmico", podeDecidir: false, conclusao: null,
    origem: { aulaOriginalId: "aula-1", matriculaId: "matricula-1", participacao: "FALTA", inicio: "2026-09-01T10:00:00.000Z", fim: "2026-09-01T11:00:00.000Z", fuso: "UTC", turma: "T1" },
    decisao: { aprovada: true, motivo: "Autorizada", decididaEm: "2026-09-02T10:00:00.000Z", decisor: "Gestão" },
    agendaInicial: { fuso: "UTC", professores: [{ id: "professor-interno", nome: "Docente disponível" }], autorizacoesExcepcionais: [{ id: "autorizacao-interna", motivo: "Exceção pedagógica aprovada", decididaEm: "2026-09-02T11:00:00.000Z" }] },
  }] }));
  expect(html).toContain("Agendar aula particular autorizada");
  expect(html).toContain("Docente disponível");
  expect(html).toContain("Exceção pedagógica aprovada");
  expect(html).toContain("Conferir agenda");
  expect(html).toContain('name="fuso"');
  expect(html).toContain('value="UTC"');
  expect(html).toContain("Fuso horário");
  expect(html).toContain("America/Sao_Paulo");
  expect(html).not.toContain("ID do professor");
});
