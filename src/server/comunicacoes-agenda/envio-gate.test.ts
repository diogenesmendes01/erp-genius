import { afterEach, expect, it, vi } from "vitest";
import { envioAvisosAgendaHabilitado } from "./envio-gate";

afterEach(() => vi.unstubAllEnvs());

it("mantém o envio de avisos de agenda desligado sem habilitação explícita", () => {
  vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", undefined);
  expect(envioAvisosAgendaHabilitado()).toBe(false);
  vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "false");
  expect(envioAvisosAgendaHabilitado()).toBe(false);
  vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "1");
  expect(envioAvisosAgendaHabilitado()).toBe(false);
  vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "true");
  expect(envioAvisosAgendaHabilitado()).toBe(true);
});
