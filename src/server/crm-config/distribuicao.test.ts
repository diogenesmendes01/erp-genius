import { describe, expect, it } from "vitest";
import { escolherResponsavel } from "./distribuicao";

const base = { regra: "RODIZIO" as const, participantes: ["a", "b"], ultimoAtribuidoId: null, cargaAberta: {}, donoCarteira: null };

describe("escolherResponsavel", () => {
  it("carteira_vem_primeiro", () => expect(escolherResponsavel({ ...base, donoCarteira: "c" })).toBe("c"));
  it("rodizio_segue_a_ordem", () => expect(escolherResponsavel({ ...base, participantes: ["a", "b", "c"], ultimoAtribuidoId: "b" })).toBe("c"));
  it("rodizio_volta_ao_inicio", () => expect(escolherResponsavel({ ...base, participantes: ["a", "b", "c"], ultimoAtribuidoId: "c" })).toBe("a"));
  it("menor_carga_empate_pela_ordem", () => expect(escolherResponsavel({ ...base, regra: "MENOR_CARGA", cargaAberta: { a: 2, b: 2 } })).toBe("a"));
  it("menor_carga_escolhe_o_menos_carregado", () => expect(escolherResponsavel({ ...base, regra: "MENOR_CARGA", cargaAberta: { a: 3 } })).toBe("b"));
  it("manual_ou_sem_participantes_vai_para_fila", () => {
    expect(escolherResponsavel({ ...base, regra: "MANUAL" })).toBeNull();
    expect(escolherResponsavel({ ...base, participantes: [] })).toBeNull();
  });
});
