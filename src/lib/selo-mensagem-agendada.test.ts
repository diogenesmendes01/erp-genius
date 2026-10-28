import { expect, it } from "vitest";
import { AVISO_REMARCACAO_MENSAGEM, quandoDaMensagemAgendada, textoSeloMensagemAgendada } from "./selo-mensagem-agendada";

it("formata o selo como DD/MM HH:mm", () => {
  expect(quandoDaMensagemAgendada("2026-10-29T10:00")).toBe("29/10 10:00");
  expect(quandoDaMensagemAgendada("2026-01-05T09:05:00")).toBe("05/01 09:05");
  expect(quandoDaMensagemAgendada("invalido")).toBeNull();
  expect(textoSeloMensagemAgendada("29/10 10:00")).toBe("Mensagem agendada · 29/10 10:00");
  expect(AVISO_REMARCACAO_MENSAGEM).toBe("Remarcar a tarefa move este envio para o novo horário.");
});
