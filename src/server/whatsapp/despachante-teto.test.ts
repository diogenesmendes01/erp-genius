import { describe, expect, it } from "vitest";
import { retornoAposTeto } from "./despachante";

// C3 da revisão do #247: a mensagem barrada pelo teto diário volta direto no primeiro instante permitido, o maior
// entre o início do dia seguinte da escola e a abertura da janela do contato, sem a escala de adiamentos de hora
// em hora até a janela abrir. Instantes fixos; verde com TZ=UTC e TZ=America/Sao_Paulo.
const SP = "America/Sao_Paulo";
const TODOS = [0, 1, 2, 3, 4, 5, 6];
const amanhaSP = new Date("2026-03-11T03:00:00.000Z"); // 11/03/2026 (quarta), 00h de Brasília

describe("retornoAposTeto", () => {
  it("janela 8–18 em Brasília: volta às 08h do dia seguinte, não à meia-noite", () => {
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 8, janelaFim: 18, diasSemana: TODOS }, SP)).toEqual(new Date("2026-03-11T11:00:00.000Z"));
  });

  it("janela aberta à meia-noite (0–24): volta no início do dia seguinte da escola", () => {
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 0, janelaFim: 24, diasSemana: TODOS }, SP)).toEqual(amanhaSP);
  });

  it("dia seguinte fora dos dias da semana: pula para a abertura do próximo dia permitido", () => {
    // Quarta (3) não está na lista: o próximo permitido é sexta, 13/03, às 08h de Brasília.
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 8, janelaFim: 18, diasSemana: [5] }, SP)).toEqual(new Date("2026-03-13T11:00:00.000Z"));
  });

  it("contato em outro fuso: a abertura é no fuso do contato", () => {
    // 00h de Brasília = 12h em Tóquio, dentro de 8–18: já pode sair.
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 8, janelaFim: 18, diasSemana: TODOS }, "Asia/Tokyo")).toEqual(amanhaSP);
    // Janela 19–22 em Tóquio: 19h de 11/03 em Tóquio = 10h UTC.
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 19, janelaFim: 22, diasSemana: TODOS }, "Asia/Tokyo")).toEqual(new Date("2026-03-11T10:00:00.000Z"));
    // Costa Rica (−06): 00h de Brasília = 21h de 10/03, depois do fim; abre às 08h de 11/03 = 14h UTC.
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 8, janelaFim: 18, diasSemana: TODOS }, "America/Costa_Rica")).toEqual(new Date("2026-03-11T14:00:00.000Z"));
  });

  it("hora de abertura pulada pelo horário de verão: primeira hora existente da janela", () => {
    // America/Santiago, 06/09/2026: a 00h não existe (o relógio vai de 23h59 para 01h).
    const inicio = new Date("2026-09-06T04:00:00.000Z"); // 06/09, 01h em Santiago
    expect(retornoAposTeto(new Date("2026-09-06T03:30:00.000Z"), { janelaInicio: 0, janelaFim: 6, diasSemana: TODOS }, "America/Santiago")).toEqual(inicio);
  });

  it("sem janela possível (dias vazios ou fuso inválido): fica no início do dia seguinte da escola", () => {
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 8, janelaFim: 18, diasSemana: [] }, SP)).toEqual(amanhaSP);
    expect(retornoAposTeto(amanhaSP, { janelaInicio: 8, janelaFim: 18, diasSemana: TODOS }, "Fuso/Inexistente")).toEqual(amanhaSP);
  });
});
