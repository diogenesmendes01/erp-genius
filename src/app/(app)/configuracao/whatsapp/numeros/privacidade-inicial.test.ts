import { describe, expect, it } from "vitest";
import { PRIV_PADRAO, privacidadeInicial } from "./privacidade-inicial";

describe("privacidadeInicial", () => {
  it("sem_privacidade_gravada_usa_o_padrao", () => expect(privacidadeInicial(null)).toEqual(PRIV_PADRAO));
  // Gravação parcial (o motor aplicou só parte): os campos ausentes não podem ficar undefined nos selects.
  it("privacidade_parcial_completa_com_o_padrao", () =>
    expect(privacidadeInicial({ foto: "NINGUEM" })).toEqual({ vistoPorUltimo: "CONTATOS", foto: "NINGUEM", recado: "CONTATOS", grupos: "CONTATOS" }));
  it("privacidade_completa_prevalece", () => {
    const p = { vistoPorUltimo: "TODOS", foto: "TODOS", recado: "NINGUEM", grupos: "TODOS" } as const;
    expect(privacidadeInicial(p)).toEqual(p);
  });
});
