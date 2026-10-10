import { describe, expect, it } from "vitest";
import { MSG_FUSO_PAIS_INVALIDO, MSG_FUSO_PAIS_VAZIO, PaisSchema } from "./schema";

// docs/43 §6 item 6 (docs/42 L2429): o fuso do país era `z.string().min(1)` — "America/SaoPaulo" gravava e
// quebrava em silêncio as datas de todo o país. Agora é IANA, no servidor, com a mesma regra do CampoFuso.
const base = { nome: "Costa Rica", codigoISO: "cr", moedaLocal: "crc", ddi: "+506", idioma: "es", tiposDocumento: [] };
const mensagens = (fuso: unknown) => {
  const r = PaisSchema.safeParse({ ...base, fuso });
  return r.success ? [] : r.error.issues.filter((i) => i.path[0] === "fuso").map((i) => i.message);
};

describe("PaisSchema — fuso", () => {
  it("aceita fuso IANA (com espaço em volta, que é aparado)", () => {
    expect(PaisSchema.parse({ ...base, fuso: "America/Costa_Rica" }).fuso).toBe("America/Costa_Rica");
    expect(PaisSchema.parse({ ...base, fuso: " America/Sao_Paulo " }).fuso).toBe("America/Sao_Paulo");
    expect(PaisSchema.parse({ ...base, fuso: "UTC" }).fuso).toBe("UTC");
  });

  it.each(["America/SaoPaulo", "America/Sao Paulo", "GMT-3", "+03:00", "Brasil", "America/Inexistente"])("recusa %s com mensagem clara", (fuso) => {
    expect(mensagens(fuso)).toEqual([MSG_FUSO_PAIS_INVALIDO]);
  });

  it("vazio pede o fuso; ausente usa o padrão de sempre", () => {
    expect(mensagens("")).toEqual([MSG_FUSO_PAIS_VAZIO]);
    expect(mensagens("   ")).toEqual([MSG_FUSO_PAIS_VAZIO]);
    expect(PaisSchema.parse(base).fuso).toBe("America/Sao_Paulo");
  });

  it("as mensagens dizem o que fazer, sem jargão", () => {
    expect(MSG_FUSO_PAIS_INVALIDO).toMatch(/Escolha um da lista/);
    expect(MSG_FUSO_PAIS_INVALIDO).not.toMatch(/IANA/);
  });
});
