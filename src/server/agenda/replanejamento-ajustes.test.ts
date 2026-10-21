import { expect, it } from "vitest";
import { ajustarPrevisaoReplanejamento } from "./replanejamento-ajustes";
const entrada = () => ({
  agora: new Date("2026-09-01T12:00:00Z"), fusoOrigem: "America/Sao_Paulo", fusoEscola: "UTC", periodos: [] as { id: string; inicio: string; fim: string }[],
  ajustes: [{ encontroId: "a", data: "2026-09-10", horario: "23:30", motivo: "Ajustar horário acordado" }],
  previsao: { propostas: [{ encontroId: "a", inicioAnterior: "2026-09-09T19:00:00.000Z", fimAnterior: "2026-09-09T20:00:00.000Z", inicioProposto: "2026-09-09T19:00:00.000Z", fimProposto: "2026-09-09T20:00:00.000Z", alterado: false }],
    preservados: [], previsaoTermino: "2026-09-09T20:00:00.000Z", verificacoesPendentes: [], aplicada: false as const },
});
it("converte o horário de origem, conserva duração e recalcula o término sem mutar a base", () => {
  const d = entrada(), r = ajustarPrevisaoReplanejamento(d);
  expect(r.propostas[0]).toMatchObject({ inicioProposto: "2026-09-11T02:30:00.000Z", fimProposto: "2026-09-11T03:30:00.000Z", motivoAjuste: d.ajustes[0].motivo });
  expect(r.previsaoTermino).toBe("2026-09-11T03:30:00.000Z");
  expect(d.previsao.propostas[0].alterado).toBe(false);
});
it("identifica dia não letivo pelo fuso da escola sem autorizar a exceção", () => {
  const d = entrada(); d.periodos = [{ id: "feriado", inicio: "2026-09-11", fim: "2026-09-11" }];
  const r = ajustarPrevisaoReplanejamento(d);
  expect(r.propostas[0].periodosNaoLetivos).toEqual(["feriado"]); expect(r.aplicada).toBe(false);
});
it("recusa encontro alheio, duplicação, passado e horário ambíguo", () => {
  const d = entrada();
  expect(() => ajustarPrevisaoReplanejamento({ ...d, ajustes: [{ ...d.ajustes[0], encontroId: "alheio" }] })).toThrow("fora");
  expect(() => ajustarPrevisaoReplanejamento({ ...d, ajustes: [...d.ajustes, ...d.ajustes] })).toThrow("repetido");
  expect(() => ajustarPrevisaoReplanejamento({ ...d, ajustes: [{ ...d.ajustes[0], data: "2026-08-01" }] })).toThrow("futura");
  expect(() => ajustarPrevisaoReplanejamento({ ...d, fusoOrigem: "America/New_York", ajustes: [{ ...d.ajustes[0], data: "2026-11-01", horario: "01:30" }] })).toThrow("ambíguo");
});
