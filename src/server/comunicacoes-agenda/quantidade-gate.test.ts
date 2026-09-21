import { afterEach, expect, it } from "vitest";
import { envioQuantidadeAulasHabilitado } from "./quantidade-gate";

const original = process.env.COMUNICACOES_AGENDA_QUANTIDADE_ENVIO_ENABLED;
afterEach(() => { if (original === undefined) delete process.env.COMUNICACOES_AGENDA_QUANTIDADE_ENVIO_ENABLED; else process.env.COMUNICACOES_AGENDA_QUANTIDADE_ENVIO_ENABLED = original; });

it("mantém transporte de quantidade desligado sem habilitação explícita", () => {
  delete process.env.COMUNICACOES_AGENDA_QUANTIDADE_ENVIO_ENABLED;
  expect(envioQuantidadeAulasHabilitado()).toBe(false);
  process.env.COMUNICACOES_AGENDA_QUANTIDADE_ENVIO_ENABLED = "false";
  expect(envioQuantidadeAulasHabilitado()).toBe(false);
  process.env.COMUNICACOES_AGENDA_QUANTIDADE_ENVIO_ENABLED = "true";
  expect(envioQuantidadeAulasHabilitado()).toBe(true);
});
