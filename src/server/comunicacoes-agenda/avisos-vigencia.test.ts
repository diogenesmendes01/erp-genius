import { expect, it } from "vitest";
import { alocacaoDaMatriculaCobreEncontro } from "./avisos";

it("atribui aviso de substituição à matrícula migrada somente na vigência histórica", () => {
  const alocacao = { turmaId: "turma-1", criadoEm: new Date("2100-01-01T00:00:00Z"), encerradaEm: null, ativa: true, provenienciaVinculo: "MIGRACAO" as const, inicioVigencia: new Date("2099-09-01T00:00:00Z"), fimVigencia: new Date("2099-10-02T00:00:00Z") };
  expect(alocacaoDaMatriculaCobreEncontro(alocacao, "turma-1", new Date("2099-10-01T19:00:00Z"))).toBe(true);
  expect(alocacaoDaMatriculaCobreEncontro(alocacao, "turma-1", new Date("2099-10-08T19:00:00Z"))).toBe(false);
  expect(alocacaoDaMatriculaCobreEncontro(alocacao, "outra-turma", new Date("2099-10-01T19:00:00Z"))).toBe(false);
});