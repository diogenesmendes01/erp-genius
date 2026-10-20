import { describe, expect, it } from "vitest";
import { resumoMinutosCompra, situacaoReserva } from "./ComprasHorasPainel";

const base = { convertidaCredito: false, liberada: false, consumo: null };

describe("situação das horas pré-pagas (Q175)", () => {
  it("consumo estornado por aula não cobrável aparece como minutos devolvidos, não como aula consumida", () => {
    expect(situacaoReserva({ ...base, consumo: { conferenciaOcorrencia: null, estorno: { id: "e" } } })).toBe("aula declarada não cobrável: minutos devolvidos ao saldo");
    expect(situacaoReserva({ ...base, consumo: { conferenciaOcorrencia: null, estorno: null } })).toBe("consumo por aula realizada");
    expect(situacaoReserva({ ...base, consumo: { conferenciaOcorrencia: { desfecho: "FALTA_COBRAVEL" }, estorno: null } })).toMatch(/^consumida por /);
    expect(situacaoReserva(base)).toBe("reserva registrada");
  });

  it("o resumo só cita minutos devolvidos quando existem", () => {
    const c = { minutosReservados: 1, minutosConsumidos: 0, minutosConvertidosCredito: 0, minutosDisponiveis: 179 };
    expect(resumoMinutosCompra({ ...c, minutosEstornados: 1 })).toBe("1 minutos reservados · 0 consumidos · 1 devolvidos por aula não cobrável · 0 convertidos em crédito · 179 ainda não reservados.");
    expect(resumoMinutosCompra({ ...c, minutosEstornados: 0 })).toBe("1 minutos reservados · 0 consumidos · 0 convertidos em crédito · 179 ainda não reservados.");
  });
});
