import { SituacaoRelatoMaterialReposicao } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { SITUACAO_RELATO_MATERIAL_REPOSICAO_LABEL, STATUS_MATRICULA_LABEL, rotular } from "./labels";

describe("rotular", () => {
  it("devolve o rótulo do mapa", () => {
    expect(rotular(STATUS_MATRICULA_LABEL, "ATIVA")).toBe("Ativa");
  });

  it("valor sem rótulo devolve o próprio valor, nunca uma frase inventada", () => {
    expect(rotular(STATUS_MATRICULA_LABEL, "VALOR_ANTIGO")).toBe("VALOR_ANTIGO");
  });

  it("ausência de valor vira travessão", () => {
    expect(rotular(STATUS_MATRICULA_LABEL, null)).toBe("—");
    expect(rotular(STATUS_MATRICULA_LABEL, undefined)).toBe("—");
    expect(rotular(STATUS_MATRICULA_LABEL, "")).toBe("—");
  });
});

describe("SITUACAO_RELATO_MATERIAL_REPOSICAO_LABEL", () => {
  it("rotula todo valor do enum, sem repetir o código cru", () => {
    for (const situacao of Object.values(SituacaoRelatoMaterialReposicao)) {
      const rotulo = rotular(SITUACAO_RELATO_MATERIAL_REPOSICAO_LABEL, situacao);
      expect(rotulo.trim()).not.toBe("");
      expect(rotulo).not.toBe(situacao);
    }
    expect(Object.keys(SITUACAO_RELATO_MATERIAL_REPOSICAO_LABEL).sort()).toEqual(Object.values(SituacaoRelatoMaterialReposicao).sort());
  });
});
