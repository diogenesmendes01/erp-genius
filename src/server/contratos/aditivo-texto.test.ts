import { describe, expect, it } from "vitest";
import { BaseTextoAditivoSchema, preencherTextoAditivo } from "./aditivo-texto";

const campos = [
  ["original", "ADITIVO_CONTRATO_ORIGINAL"], ["anteriores", "ADITIVO_ANTERIORES"],
  ["alteracoes", "ADITIVO_ALTERACOES"], ["vigencia", "ADITIVO_VIGENCIA"],
];
function modelo() { return {
  titulo: "Aditivo institucional", finalidade: "ADITIVO", regimes: ["MENSALIDADE"], aplicacao: "Condições aprovadas pela escola",
  campos: campos.map(([chave, origem]) => ({ chave, origem, descricao: chave })),
  secoes: [{ titulo: "Condições", texto: "{{original}}\n{{anteriores}}\n{{alteracoes}}\n{{vigencia}}" }],
  assinaturas: [{ papel: "ALUNO", condicao: "SEMPRE" }],
}; }
function base() { return {
  contratoOriginal: { documentoId: "original-1", pdfHash: "a".repeat(64) }, aditivosAnteriores: [],
  vigenciaInicio: "2026-10-01T00:00:00-03:00",
  alteracoes: [{ campo: "mensalidade", rotulo: "Mensalidade", anterior: "BRL 500,00", novo: "BRL 450,00" }],
}; }

describe("projeção documental do aditivo Q117", () => {
  it("preserva referências, valores e instante de vigência sem aplicar efeitos", () => {
    const documento = preencherTextoAditivo(modelo(), base(), { ADITIVO_ALTERACOES: "injeção de outra fonte" });
    expect(documento.finalidade).toBe("ADITIVO");
    expect(documento.secoes[0].texto).toContain("original-1 — SHA-256 " + "a".repeat(64));
    expect(documento.secoes[0].texto).toContain("Nenhum aditivo anterior vinculado.");
    expect(documento.secoes[0].texto).toContain("Condição anterior: BRL 500,00\nNova condição: BRL 450,00");
    expect(documento.secoes[0].texto).toContain("2026-10-01T03:00:00.000Z");
    expect(documento.secoes[0].texto).not.toContain("injeção");
  });
  it("mantém a ordem das referências anteriores e não interpreta valores como campos", () => {
    const dados = { ...base(), aditivosAnteriores: [
      { documentoId: "aditivo-2", pdfHash: "b".repeat(64) },
      { documentoId: "aditivo-3", pdfHash: "c".repeat(64) },
    ] };
    dados.alteracoes[0].novo = "{{original}} literal da condição";
    const texto = preencherTextoAditivo(modelo(), dados, {}).secoes[0].texto;
    expect(texto.indexOf("aditivo-2")).toBeLessThan(texto.indexOf("aditivo-3"));
    expect(texto).toContain("Nova condição: {{original}} literal da condição");
  });
  it.each(campos)("exige %s no corpo, não apenas no título ou declaração", (chave) => {
    const m = modelo(); m.titulo += ` {{${chave}}}`;
    m.secoes[0].texto = m.secoes[0].texto.replace(`{{${chave}}}`, "");
    expect(() => preencherTextoAditivo(m, base(), {})).toThrow("corpo do modelo");
  });
  it("recusa modelo de contrato inicial e base incompleta ou adulterada", () => {
    expect(() => preencherTextoAditivo({ ...modelo(), finalidade: "CONTRATO" }, base(), {})).toThrow("finalidade ADITIVO");
    expect(() => preencherTextoAditivo({ ...modelo(), finalidade: "CONTRATO", campos: [], secoes: [{ titulo: "Contrato", texto: "Texto fixo" }] }, base(), {})).toThrow("modelo institucional de aditivo");
    expect(BaseTextoAditivoSchema.safeParse({ ...base(), aprovada: true }).success).toBe(false);
    expect(BaseTextoAditivoSchema.safeParse({ ...base(), vigenciaInicio: "2026-10-01" }).success).toBe(false);
    expect(BaseTextoAditivoSchema.safeParse({ ...base(), alteracoes: [] }).success).toBe(false);
  });
  it("recusa cadeia duplicada, condições duplicadas e alterações sem diferença", () => {
    const b = base();
    expect(BaseTextoAditivoSchema.safeParse({ ...b, aditivosAnteriores: [b.contratoOriginal] }).success).toBe(false);
    expect(BaseTextoAditivoSchema.safeParse({ ...b, alteracoes: [b.alteracoes[0], b.alteracoes[0]] }).success).toBe(false);
    expect(BaseTextoAditivoSchema.safeParse({ ...b, alteracoes: [{ ...b.alteracoes[0], novo: b.alteracoes[0].anterior }] }).success).toBe(false);
  });
});
