import { describe, expect, it } from "vitest";
import { subtituloContato, autoriaDosCampos } from "./painel-detalhes";

describe("subtítulo contextual do contato", () => {
  const base = { b2b: false, produto: null, cargo: null, empresa: null, interlocutor: null };
  it("B2C com produto e sem oportunidade", () => {
    expect(subtituloContato({ ...base, produto: "Inglês Intensivo B1" })).toBe("Pessoa física · Inglês Intensivo B1");
    expect(subtituloContato(base)).toBe("Pessoa física");
  });
  it("B2B usa interlocutor efetivo e rótulo do papel", () => {
    expect(subtituloContato({ ...base, b2b: true, cargo: "Cargo principal", empresa: "Empresa", interlocutor: { nome: "Camila", papel: "DECISOR" } })).toBe("Falando com Camila · Decisor");
    expect(subtituloContato({ ...base, b2b: true, interlocutor: { nome: "Rafael", papel: "RH_OPERACIONAL" } })).toBe("Falando com Rafael · Recursos humanos");
  });
  it("B2B junta cargo/empresa sem partes vazias e não inventa empresa ou pessoa física", () => {
    expect(subtituloContato({ ...base, b2b: true, cargo: "RH", empresa: "Empresa fictícia" })).toBe("RH · Empresa fictícia");
    expect(subtituloContato({ ...base, b2b: true, empresa: "Empresa fictícia" })).toBe("Empresa fictícia");
    expect(subtituloContato({ ...base, b2b: true, cargo: "RH" })).toBe("RH");
    expect(subtituloContato({ ...base, b2b: true })).toBe("");
  });
});

describe("autoria do último evento de cada campo", () => {
  it("sem evento não é IA; humano posterior vence IA e não contamina outro campo", () => {
    const resultado = autoriaDosCampos([
      { campoId: "nivel", autorId: "humano" },
      { campoId: "objetivo", autorId: null },
      { campoId: "nivel", autorId: null },
      { campoId: "objetivo", autorId: "humano" },
    ]);
    expect(resultado.get("nivel")).toBe(false);
    expect(resultado.get("objetivo")).toBe(true);
    expect(resultado.get("sem-evento") ?? false).toBe(false);
  });
});
