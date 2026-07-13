import { describe, it, expect } from "vitest";
import { ehPedidoOptOut } from "./inbound";
import { sessaoDeEstadoEvolution } from "./sessao";

// Captura de opt-out por keyword (S10) — match EXATO e conservador: frase que contém a
// palavra NÃO conta (falso positivo mataria a régua de quem disse "vou parar de atrasar").

describe("ehPedidoOptOut", () => {
  it("aceita as keywords exatas, com espaços e caixa variados", () => {
    expect(ehPedidoOptOut("SAIR")).toBe(true);
    expect(ehPedidoOptOut("  parar ")).toBe(true);
    expect(ehPedidoOptOut("Stop")).toBe(true);
    expect(ehPedidoOptOut("BAJA")).toBe(true);
    expect(ehPedidoOptOut("no enviar")).toBe(true);
  });

  it("frase que só contém a palavra não conta", () => {
    expect(ehPedidoOptOut("vou parar de atrasar, prometo")).toBe(false);
    expect(ehPedidoOptOut("quero sair da turma de sábado")).toBe(false);
    expect(ehPedidoOptOut(null)).toBe(false);
    expect(ehPedidoOptOut("")).toBe(false);
  });
});

describe("sessaoDeEstadoEvolution", () => {
  it("mapeia os estados do connection.update para o enum do número", () => {
    expect(sessaoDeEstadoEvolution("open")).toBe("CONECTADO");
    expect(sessaoDeEstadoEvolution("connecting")).toBe("AGUARDANDO_QR");
    expect(sessaoDeEstadoEvolution("close")).toBe("CAIU");
    expect(sessaoDeEstadoEvolution("banana")).toBeNull();
    expect(sessaoDeEstadoEvolution(null)).toBeNull();
  });
});
