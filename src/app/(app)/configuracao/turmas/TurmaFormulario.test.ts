import { expect, it } from "vitest";
import { destinoPrepararGrade } from "./TurmaFormulario";

it("encaminha a turma recém-criada ao preparador com o identificador codificado", () => {
  expect(destinoPrepararGrade("turma/ nova")).toBe("/academico/grades/nova?turmaId=turma%2F%20nova");
});
