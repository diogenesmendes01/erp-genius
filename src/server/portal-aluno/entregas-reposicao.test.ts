import { describe, expect, it } from "vitest";
import { prazoEntregaVigente } from "./entregas-reposicao";

describe("prazo da entrega gravada", () => {
  const prazoInicial = new Date("2026-09-15T12:00:00.000Z");

  it("acrescenta somente indisponibilidades já encerradas e conserva a extensão de gestão", () => {
    const prazo = prazoEntregaVigente(prazoInicial, [
      { inicio: new Date("2026-09-15T10:00:00.000Z"), fim: new Date("2026-09-15T10:20:00.000Z") },
      { inicio: new Date("2026-09-15T11:00:00.000Z"), fim: null },
    ], [{ novoPrazo: new Date("2026-09-15T12:45:00.000Z"), autorizadaEm: new Date("2026-09-15T10:30:00.000Z"), versao: 1 }]);
    expect(prazo?.toISOString()).toBe("2026-09-15T12:45:00.000Z");
  });

  it("não inventa prazo quando não há disponibilidade real", () => {
    expect(prazoEntregaVigente(null, [], [])).toBeNull();
  });

  it("não ressuscita prazo quando a indisponibilidade começa depois do vencimento", () => {
    const prazo = prazoEntregaVigente(prazoInicial, [
      { inicio: new Date("2026-09-15T12:01:00.000Z"), fim: new Date("2026-09-15T15:01:00.000Z") },
    ], []);
    expect(prazo).toEqual(prazoInicial);
  });

  it("une interrupções sobrepostas antes de acrescentar somente o tempo real", () => {
    const prazo = prazoEntregaVigente(prazoInicial, [
      { inicio: new Date("2026-09-15T11:00:00.000Z"), fim: new Date("2026-09-15T11:30:00.000Z") },
      { inicio: new Date("2026-09-15T11:20:00.000Z"), fim: new Date("2026-09-15T11:50:00.000Z") },
    ], []);
    expect(prazo?.toISOString()).toBe("2026-09-15T12:50:00.000Z");
  });

  it("acrescenta pausa iniciada depois do prazo original, quando ela cai dentro de prorrogação", () => {
    const prazo = prazoEntregaVigente(prazoInicial, [
      { inicio: new Date("2026-09-15T12:10:00.000Z"), fim: new Date("2026-09-15T12:40:00.000Z") },
    ], [{ novoPrazo: new Date("2026-09-15T13:00:00.000Z"), autorizadaEm: new Date("2026-09-15T11:30:00.000Z"), versao: 1 }]);
    expect(prazo?.toISOString()).toBe("2026-09-15T13:30:00.000Z");
  });

  it("não soma de novo pausa já absorvida pela autorização da prorrogação", () => {
    const prazo = prazoEntregaVigente(prazoInicial, [
      { inicio: new Date("2026-09-15T11:00:00.000Z"), fim: new Date("2026-09-15T11:30:00.000Z") },
      { inicio: new Date("2026-09-15T12:15:00.000Z"), fim: new Date("2026-09-15T12:35:00.000Z") },
    ], [{ novoPrazo: new Date("2026-09-15T13:00:00.000Z"), autorizadaEm: new Date("2026-09-15T12:00:00.000Z"), versao: 1 }]);
    expect(prazo?.toISOString()).toBe("2026-09-15T13:20:00.000Z");
  });

  it("conta só a cauda de uma pausa que atravessa a autorização", () => {
    const prazo = prazoEntregaVigente(prazoInicial, [
      { inicio: new Date("2026-09-15T11:45:00.000Z"), fim: new Date("2026-09-15T12:30:00.000Z") },
    ], [{ novoPrazo: new Date("2026-09-15T13:00:00.000Z"), autorizadaEm: new Date("2026-09-15T12:00:00.000Z"), versao: 1 }]);
    expect(prazo?.toISOString()).toBe("2026-09-15T13:30:00.000Z");
  });
});
