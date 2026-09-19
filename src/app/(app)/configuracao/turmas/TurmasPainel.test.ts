import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("./TurmaFormulario", () => ({ TurmaFormulario: () => "formulario-turma" }));
vi.mock("./ImportarTurmasModal", () => ({ ImportarTurmasModal: () => "importar-turmas" }));

import { TurmasPainel, type TurmaRow } from "./TurmasPainel";

const turma: TurmaRow = {
  id: "turma-1",
  codigo: "T-001",
  nome: "Turma aberta antiga",
  online: false,
  diasHorario: "Seg · 22:00–01:00",
  diasSemana: [1],
  horarioInicio: "22:00",
  horarioFim: "01:00",
  dataInicio: "2020-01-01T12:00:00.000Z",
  dataFim: "2020-02-01T12:00:00.000Z",
  capacidade: 12,
  rolling: false,
  status: "ABERTA",
  modalidadeId: "modalidade-1",
  nivelId: "nivel-1",
  modalidade: { nome: "Regular" },
  nivel: { codigo: "A1", idioma: { nome: "Português" } },
  professor: null,
  regraAvaliacao: null,
  _count: { alocacoes: 0, reservasMatricula: 0 },
};

it("exibe o status canônico mesmo quando a referência de período já passou", () => {
  const html = renderToStaticMarkup(createElement(TurmasPainel, {
    turmas: [turma],
    modalidades: [{ id: "modalidade-1", label: "Regular", frequencia: "1x/semana", horasAula: 3 }],
    niveis: [{ id: "nivel-1", label: "Português A1" }],
    professores: [],
  }));

  expect(html).toContain("Aberta");
  expect(html).not.toContain("Aceitando matrícula");
  expect(html).not.toContain("Encerrada");
  expect(html).toContain("22:00–01:00");
});
