import { describe, it, expect } from "vitest";
import { periodoDoFiltro, periodoAnterior, variacao } from "./periodo";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("periodo dos relatórios", () => {
  it("variacao_com_anterior_zero_e_borda_de_fuso", () => {
    expect(variacao(10, 0)).toEqual({ valor: null, texto: "—" });
    expect(variacao(0, 0)).toEqual({ valor: null, texto: "—" });
    expect(variacao(null, 5)).toEqual({ valor: null, texto: "—" });
    expect(variacao(12, 10)).toEqual({ valor: 0.2, texto: "+20%" });
    const hoje = periodoDoFiltro({ tipo: "HOJE" }, "America/Costa_Rica", new Date("2026-11-15T05:30:00Z")); // 23h30 de 14/11 na Costa Rica
    expect(hoje).toEqual({ inicio: new Date("2026-11-14T06:00:00Z"), fim: new Date("2026-11-15T06:00:00Z") });
  });
  it("variacao_negativa_usa_sinal_de_menos_tipografico", () => {
    expect(variacao(95, 100)).toEqual({ valor: -0.05, texto: "−5%" });
    expect(variacao(5, null)).toEqual({ valor: null, texto: "—" });
    expect(variacao(Number.NaN, 5)).toEqual({ valor: null, texto: "—" });
  });
  it("anterior_tem_mesma_duracao", () =>
    expect(periodoAnterior({ inicio: d("2026-11-08"), fim: d("2026-11-15") })).toEqual({ inicio: d("2026-11-01"), fim: d("2026-11-08") }));
  it("7d_e_30d_terminam_no_fim_do_dia_corrente_do_fuso", () => {
    const agora = new Date("2026-11-15T05:30:00Z");
    expect(periodoDoFiltro({ tipo: "7D" }, "America/Costa_Rica", agora)).toEqual({ inicio: new Date("2026-11-08T06:00:00Z"), fim: new Date("2026-11-15T06:00:00Z") });
    const p30 = periodoDoFiltro({ tipo: "30D" }, "America/Costa_Rica", agora);
    expect(p30.fim).toEqual(new Date("2026-11-15T06:00:00Z"));
    expect(p30.inicio).toEqual(new Date("2026-10-16T06:00:00Z"));
  });
  it("personalizado_inclui_o_dia_final", () => {
    expect(periodoDoFiltro({ tipo: "PERSONALIZADO", de: "2026-11-01", ate: "2026-11-07" }, "UTC")).toEqual({ inicio: d("2026-11-01"), fim: d("2026-11-08") });
  });
  it("personalizado_invertido_ou_acima_de_366_dias_falha", () => {
    expect(() => periodoDoFiltro({ tipo: "PERSONALIZADO", de: "2026-11-10", ate: "2026-11-01" }, "UTC")).toThrow();
    expect(() => periodoDoFiltro({ tipo: "PERSONALIZADO", de: "2025-01-01", ate: "2026-11-01" }, "UTC")).toThrow();
    expect(() => periodoDoFiltro({ tipo: "PERSONALIZADO" }, "UTC")).toThrow();
    expect(() => periodoDoFiltro({ tipo: "PERSONALIZADO", de: "2026-02-31", ate: "2026-03-05" }, "UTC")).toThrow();
  });
});
