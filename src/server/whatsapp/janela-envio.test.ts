import { describe, expect, it } from "vitest";
import { dentroDaJanelaEnvio, mensagemForaDaJanela, type JanelaEnvio } from "./janela-envio";

const UTIL: JanelaEnvio = { janelaInicio: 9, janelaFim: 20, diasSemana: [1, 2, 3, 4, 5] };
const SP = "America/Sao_Paulo";

describe("dentroDaJanelaEnvio", () => {
  it("usa a hora e o dia no fuso informado, não os do servidor", () => {
    expect(dentroDaJanelaEnvio(new Date("2026-10-20T13:00:00Z"), SP, UTIL)).toBe(true);
    expect(dentroDaJanelaEnvio(new Date("2026-10-20T06:00:00Z"), SP, UTIL)).toBe(false);
    expect(dentroDaJanelaEnvio(new Date("2026-10-21T02:00:00Z"), SP, UTIL)).toBe(false);
  });

  it("início incluso, fim excluído", () => {
    expect(dentroDaJanelaEnvio(new Date("2026-10-20T12:00:00Z"), SP, UTIL)).toBe(true);
    expect(dentroDaJanelaEnvio(new Date("2026-10-20T11:59:00Z"), SP, UTIL)).toBe(false);
    expect(dentroDaJanelaEnvio(new Date("2026-10-20T23:00:00Z"), SP, UTIL)).toBe(false);
    expect(dentroDaJanelaEnvio(new Date("2026-10-20T22:59:00Z"), SP, UTIL)).toBe(true);
  });

  it("dia fora da lista fica fora, mesmo no horário", () => {
    expect(dentroDaJanelaEnvio(new Date("2026-10-24T13:00:00Z"), SP, UTIL)).toBe(false);
    expect(dentroDaJanelaEnvio(new Date("2026-10-24T13:00:00Z"), SP, { ...UTIL, diasSemana: [0, 6] })).toBe(true);
  });

  it("fuso que o Intl aceita e o regex institucional recusa (Aluno.fuso é texto livre) usa o Intl (R1 do #254, C4)", () => {
    expect(dentroDaJanelaEnvio(new Date("2026-10-20T23:00:00Z"), "EST5EDT", UTIL)).toBe(true);
    expect(dentroDaJanelaEnvio(new Date("2026-10-21T01:00:00Z"), "EST5EDT", UTIL)).toBe(false);
  });

  it("fuso inválido no cadastro cai na hora do servidor, sem travar a fila", () => {
    expect(() => dentroDaJanelaEnvio(new Date("2026-10-20T13:00:00Z"), "Brasil", UTIL)).not.toThrow();
  });
});

describe("mensagemForaDaJanela", () => {
  it("diz o horário, os dias e o fuso da escola", () => {
    expect(mensagemForaDaJanela(UTIL, SP)).toBe(
      "Fora da janela de envio da escola: as mensagens saem das 9h às 20h, de segunda a sexta (horário de America/Sao_Paulo). Escolha outro horário.",
    );
  });

  it("dias soltos e semana inteira", () => {
    expect(mensagemForaDaJanela({ janelaInicio: 8, janelaFim: 24, diasSemana: [1, 3, 5] }, "UTC")).toContain("das 8h às 24h, na segunda, na quarta e na sexta");
    expect(mensagemForaDaJanela({ janelaInicio: 8, janelaFim: 18, diasSemana: [0, 1, 2, 3, 4, 5, 6] }, "UTC")).toContain("das 8h às 18h, todos os dias");
  });
});
