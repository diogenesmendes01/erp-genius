import { describe, expect, it } from "vitest";
import { DESTINO_ORDENACAO, ORIGEM_ORDENACAO, normalizarParaOrdenacao } from "./nome-ordenacao";

describe("normalizarParaOrdenacao", () => {
  it("tira o acento de Á/á/À/Â/Ã/Ç e põe em minúsculas", () => {
    expect(normalizarParaOrdenacao("Álvaro")).toBe("alvaro");
    expect(normalizarParaOrdenacao("álvaro")).toBe("alvaro");
    expect(normalizarParaOrdenacao("Àquila")).toBe("aquila");
    expect(normalizarParaOrdenacao("Ângela")).toBe("angela");
    expect(normalizarParaOrdenacao("Ãnia")).toBe("ania");
    expect(normalizarParaOrdenacao("Çeliane")).toBe("celiane");
    expect(normalizarParaOrdenacao("ç")).toBe("c");
  });

  it("combinados: vários acentos, maiúsculas e outras línguas no mesmo nome", () => {
    expect(normalizarParaOrdenacao("JOÃO CONCEIÇÃO")).toBe("joao conceicao");
    expect(normalizarParaOrdenacao("Ênio Ávila Ñúñez")).toBe("enio avila nunez");
    expect(normalizarParaOrdenacao("Zoë Øster Łukasz Ștefan")).toBe("zoe oster lukasz stefan");
    expect(normalizarParaOrdenacao("A\u0301lvaro Conceic\u0327a\u0303o")).toBe("alvaro conceicao");
  });

  it("colapsa espaços repetidos (inclusive tab e espaço duro) e apara as pontas", () => {
    expect(normalizarParaOrdenacao("  Ana   Maria  ")).toBe("ana maria");
    expect(normalizarParaOrdenacao("Ana\t\u00A0 Maria")).toBe("ana maria");
    expect(normalizarParaOrdenacao("")).toBe("");
  });

  it("caracteres fora do mapa ficam como estão", () => {
    expect(normalizarParaOrdenacao("O'Neil-2")).toBe("o'neil-2");
  });

  it("ordenar pela forma normalizada põe Álvaro entre Alice e Bruno", () => {
    const nomes = ["Bruno", "Álvaro", "Zé", "alice", "Ângela"];
    const ordenados = [...nomes].sort((a, b) => {
      const x = normalizarParaOrdenacao(a), y = normalizarParaOrdenacao(b);
      return x < y ? -1 : x > y ? 1 : 0;
    });
    expect(ordenados).toEqual(["alice", "Álvaro", "Ângela", "Bruno", "Zé"]);
  });
});

describe("mapa do translate", () => {
  it("cada caractere de origem aparece uma vez e só os combinantes ficam sem par", () => {
    const origem = [...ORIGEM_ORDENACAO];
    expect(new Set(origem).size).toBe(origem.length);
    const semPar = origem.slice([...DESTINO_ORDENACAO].length);
    expect(semPar.every((c) => c.charCodeAt(0) >= 0x300 && c.charCodeAt(0) <= 0x36f)).toBe(true);
    expect(semPar).toHaveLength(0x70);
    expect(ORIGEM_ORDENACAO + DESTINO_ORDENACAO).not.toMatch(/['\\]/);
    expect([...DESTINO_ORDENACAO].every((c) => /^[a-z ]$/.test(c))).toBe(true);
  });
});
