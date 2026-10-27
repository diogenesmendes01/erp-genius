import { expect, it, vi } from "vitest";
import { destinoPrepararGrade, submeterTurma } from "./TurmaFormulario";
import type { TurmaInput } from "@/server/turmas/schema";

const input: TurmaInput = {
  modalidadeId: "modalidade", nivelId: "nivel", diasSemana: [1], horarioInicio: "22:00", horarioFim: "01:00", dataInicio: "2099-10-12", capacidade: 12,
};

it("encaminha a turma recém-criada ao preparador com o identificador codificado", async () => {
  expect(destinoPrepararGrade("turma/ nova")).toBe("/academico/grades/nova?turmaId=turma%2F%20nova");
  const criar = vi.fn().mockResolvedValue({ ok: true, dado: { id: "turma/ nova" } });
  const editar = vi.fn();
  await expect(submeterTurma(undefined, input, { criar, editar })).resolves.toEqual({ ok: true, destino: "/academico/grades/nova?turmaId=turma%2F%20nova" });
  expect(criar).toHaveBeenCalledWith(input);
  expect(editar).not.toHaveBeenCalled();
});

it("preserva o caminho de edição e devolve o erro para o diálogo", async () => {
  const criar = vi.fn();
  const editar = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, erro: "Conflito de agenda" });
  await expect(submeterTurma("turma-1", input, { criar, editar })).resolves.toEqual({ ok: true });
  await expect(submeterTurma("turma-1", input, { criar, editar })).resolves.toEqual({ ok: false, erro: "Conflito de agenda" });
  expect(editar).toHaveBeenNthCalledWith(1, "turma-1", input);
  expect(criar).not.toHaveBeenCalled();
});
