import { describe, expect, it } from "vitest";
import { alcadasAplicaveisAditivo, camposDaAlcadaAditivo } from "./aditivo-alcadas-regras";

describe("alçadas de aditivo", () => {
  it("não cria alçada específica para alteração cadastral", () => expect(alcadasAplicaveisAditivo([{ campo: "ALUNO_EMAIL" }])).toEqual([]));
  it("deriva cada alçada apenas de seus campos", () => {
    const alteracoes = [{ campo: "MENSALIDADE_VALOR", rotulo: "Mensalidade", anterior: "10", novo: "20" }, { campo: "AGENDA_PARTICULAR", rotulo: "Agenda", anterior: "A", novo: "B" }];
    expect(alcadasAplicaveisAditivo(alteracoes)).toEqual(["FINANCEIRA", "COMERCIAL", "PEDAGOGICA"]);
    expect(camposDaAlcadaAditivo("COMERCIAL", alteracoes)).toEqual([{ campo: "MENSALIDADE_VALOR", rotulo: "Mensalidade", anterior: "10", novo: "20" }]);
  });
  it("regime exige as três alçadas", () => expect(alcadasAplicaveisAditivo([{ campo: "REGIME" }])).toEqual(["FINANCEIRA", "COMERCIAL", "PEDAGOGICA"]));
});
