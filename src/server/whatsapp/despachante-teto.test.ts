import { describe, expect, it } from "vitest";
import { retornoAposTeto } from "./despachante";

const SP = "America/Sao_Paulo";
const TODOS = [0, 1, 2, 3, 4, 5, 6];
const amanhaSP = new Date("2026-03-11T03:00:00.000Z");

describe("retornoAposTeto", () => {
  it("janela 8–18 em Brasília: volta às 08h do dia seguinte, não à meia-noite", () => {
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 8, janelaFim: 18, diasSemana: TODOS }, SP)).toEqual(new Date("2026-03-11T11:00:00.000Z"));
  });

  it("janela aberta à meia-noite (0–24): volta no início do dia seguinte da escola", () => {
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 0, janelaFim: 24, diasSemana: TODOS }, SP)).toEqual(amanhaSP);
  });

  it("dia seguinte fora dos dias da semana: pula para a abertura do próximo dia permitido", () => {
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 8, janelaFim: 18, diasSemana: [5] }, SP)).toEqual(new Date("2026-03-13T11:00:00.000Z"));
  });

  it("contato em outro fuso: a abertura é no fuso do contato", () => {
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 8, janelaFim: 18, diasSemana: TODOS }, "Asia/Tokyo")).toEqual(amanhaSP);
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 19, janelaFim: 22, diasSemana: TODOS }, "Asia/Tokyo")).toEqual(new Date("2026-03-11T10:00:00.000Z"));
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 8, janelaFim: 18, diasSemana: TODOS }, "America/Costa_Rica")).toEqual(new Date("2026-03-11T14:00:00.000Z"));
  });

  it("hora de abertura pulada pelo horário de verão: primeira hora existente da janela", () => {
    const inicio = new Date("2026-09-06T04:00:00.000Z");
    expect(retornoAposTeto(new Date("2026-09-06T03:30:00.000Z"), { janelaInicio: 0, janelaFim: 6, diasSemana: TODOS }, "America/Santiago")).toEqual(inicio);
  });

  it("sem janela possível (dias vazios ou fuso inválido): fica no início do dia seguinte da escola", () => {
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 8, janelaFim: 18, diasSemana: [] }, SP)).toEqual(amanhaSP);
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 8, janelaFim: 18, diasSemana: TODOS }, "Fuso/Inexistente")).toEqual(amanhaSP);
  });
});
