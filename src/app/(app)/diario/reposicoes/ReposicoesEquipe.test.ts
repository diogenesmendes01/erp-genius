import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { ReposicoesEquipe, type ReposicaoEquipe } from "./ReposicoesEquipe";

const reposicoes: ReposicaoEquipe[] = [{
    id: "reposicao-1", modalidade: "PARTICULAR", solicitadaEm: "2026-09-01T10:00:00.000Z", solicitadaPor: "Secretaria",
    motivo: "Ausência conferida", evidencia: "Registro acadêmico", podeDecidir: false, conclusao: null,
    origem: { aulaOriginalId: "aula-1", matriculaId: "matricula-1", participacao: "FALTA", inicio: "2026-09-01T10:00:00.000Z", fim: "2026-09-01T11:00:00.000Z", fuso: "UTC", turma: "T1" },
    decisao: { aprovada: true, motivo: "Autorizada", decididaEm: "2026-09-02T10:00:00.000Z", decisor: "Gestão" },
    agendaInicial: { fuso: "UTC", professores: [{ id: "professor-interno", nome: "Docente disponível" }], autorizacoesExcepcionais: [{ id: "autorizacao-interna", motivo: "Exceção pedagógica aprovada", decididaEm: "2026-09-02T11:00:00.000Z" }] },
    excecoesAgenda: [{ id: "excecao-interna", professor: "Docente disponível", inicio: "2026-10-12T10:00:00.000Z", fim: "2026-10-12T11:00:00.000Z", fuso: "America/Sao_Paulo", motivo: "Disponibilidade somente no recesso", evidencia: "Atendimento registrado", solicitante: "Secretaria", criadaEm: "2026-09-03T01:00:00.000Z", versao: 1, decisao: null, podeDecidir: true }, { id: "excecao-decidida", professor: "Docente disponível", inicio: "2026-10-13T10:00:00.000Z", fim: "2026-10-13T11:00:00.000Z", fuso: "America/Sao_Paulo", motivo: "Outra disponibilidade registrada", evidencia: "Atendimento posterior", solicitante: "Secretaria", criadaEm: "2026-09-04T10:00:00.000Z", versao: 2, decisao: { aprovada: true, motivo: "Exceção conferida", decididaEm: "2026-09-05T01:00:00.000Z", decisor: "Gestão" }, podeDecidir: false }],
  }];

it("exibe histórico no fuso pessoal e preserva os campos locais do agendamento", () => {
  const html = renderToStaticMarkup(createElement(ReposicoesEquipe, {
    fusoExibicao: "America/Costa_Rica", preferenciaFusoExibicao: "America/Costa_Rica", reposicoes,
  }));
  expect(html).toContain("Agendar aula particular autorizada");
  expect(html).toContain("Docente disponível");
  expect(html).toContain("Exceção pedagógica aprovada");
  expect(html).toContain("Conferir agenda");
  expect(html).toContain('name="fuso"');
  expect(html).toContain('value="UTC"');
  expect(html).toContain("Fuso horário");
  expect(html).toContain("exibido em America/Costa_Rica; origem America/Sao_Paulo");
  expect(html).not.toContain("ID do professor");
  expect(html).toContain("Histórico de exceções de agenda");
  expect(html).toContain("Disponibilidade somente no recesso");
  expect(html).toContain("Aprovar exceção pontual");
  expect(html).toContain("12/10/2026, 04:00");
  expect(html).toContain("12/10/2026, 05:00");
  expect(html).toContain("02/09/2026, 19:00");
  expect(html).toContain("04/09/2026, 19:00");
  expect(html).toContain("horário exibido em America/Costa_Rica");
  expect(html).toContain("America/Sao_Paulo");
  expect(html).toContain("Exceção conferida");
});

it("exibe todos os instantes da reposição no fuso pessoal e preserva o fuso de origem", () => {
  const html = renderToStaticMarkup(createElement(ReposicoesEquipe, {
    fusoExibicao: "America/Costa_Rica",
    reposicoes: [{
      id: "reposicao-fuso", modalidade: "GRAVACAO", solicitadaPor: "Secretaria",
      solicitadaEm: "2026-09-01T03:30:00.000Z", motivo: "Ausência conferida", evidencia: "Registro acadêmico", podeDecidir: false,
      origem: { aulaOriginalId: "aula-fuso", matriculaId: "matricula-fuso", participacao: "FALTA", inicio: "2026-09-01T03:30:00.000Z", fim: "2026-09-01T04:30:00.000Z", fuso: "UTC", turma: "T1" },
      decisao: { aprovada: true, motivo: "Autorizada", decididaEm: "2026-09-02T03:30:00.000Z", decisor: "Gestão" },
      conclusao: { concluida: true, dataResultado: "2026-09-03T03:30:00.000Z", versao: 1 },
    }],
  }));

  expect(html).toContain("31/08/2026");
  expect(html).toContain("01/09/2026");
  expect(html).toContain("02/09/2026");
  expect(html).toContain("exibido em America/Costa_Rica; origem UTC");
  expect(html).not.toContain("01/09/2026, 03:30");
});

it("recorre ao fuso registrado na exceção quando não há preferência", () => {
  const html = renderToStaticMarkup(createElement(ReposicoesEquipe, {
    fusoExibicao: "UTC", preferenciaFusoExibicao: null, reposicoes,
  }));

  expect(html).toContain("12/10/2026, 07:00");
  expect(html).toContain("12/10/2026, 08:00");
  expect(html).toContain("02/09/2026, 22:00");
  expect(html).toContain("04/09/2026, 22:00");
  expect(html).toContain("horário exibido em America/Sao_Paulo");
  expect(html).toContain('name="inicioLocal"');
  expect(html).toContain('name="fimLocal"');
  expect(html).toContain('name="fuso"');
  expect(html).toContain('value="UTC"');
});

