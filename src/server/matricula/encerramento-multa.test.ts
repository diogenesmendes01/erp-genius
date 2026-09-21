import { describe, expect, it } from "vitest";
import { calcularMultaEncerramento, MultaEncerramentoSchema } from "./encerramento-multa";
const clausula = { contratoVersaoId: "v1", clausulaId: "clausula-7", condicoesAplicacao: "Encerramento no prazo contratual", evidenciaAplicabilidade: "Evidência conferida no acerto", moeda: "BRL" };
describe("multa contratual de encerramento", () => {
  it("calcula valor fixo e conserva a regra original", () => {
    const r = calcularMultaEncerramento({ ...clausula, tipo: "VALOR_FIXO", valor: "75.20" });
    expect(r.valor).toBe("75.20");
    expect(r.regra).toMatchObject(clausula);
  });
  it("calcula percentual apenas com base identificada", () => {
    const r = calcularMultaEncerramento({ ...clausula, tipo: "PERCENTUAL", percentual: "12.50", baseCalculo: "321.25", descricaoBase: "Base definida pela cláusula" });
    expect(r.valor).toBe("40.16");
    expect(r.memoria.valorAntesArredondamento).toBe("40.15625");
    expect(MultaEncerramentoSchema.safeParse({ ...clausula, tipo: "PERCENTUAL", percentual: "12.50" }).success).toBe(false);
  });
  it("ausência de previsão explícita resulta em zero, sem padrão de multa", () => {
    expect(calcularMultaEncerramento({ tipo: "SEM_PREVISAO", contratoVersaoId: "v1", moeda: "BRL", motivo: "Contrato não prevê multa" }).valor).toBe("0.00");
    expect(MultaEncerramentoSchema.safeParse({}).success).toBe(false);
  });
  it("não aceita dispensa ou valor negativo como alteração implícita", () => {
    expect(MultaEncerramentoSchema.safeParse({ ...clausula, tipo: "VALOR_FIXO", valor: "-10" }).success).toBe(false);
    expect(MultaEncerramentoSchema.safeParse({ ...clausula, tipo: "VALOR_FIXO", valor: "10", dispensar: true }).success).toBe(false);
  });
});
