import { describe, expect, it } from "vitest";
import { OrigemCampoSchema, ROTULOS_ORIGEM } from "./campos";
import { classificarAlteracoesAditivo } from "./aditivo-impactos";

const alterar = (campo: string) => ({ campo, rotulo: ROTULOS_ORIGEM[campo as keyof typeof ROTULOS_ORIGEM] ?? campo, anterior: "antes", novo: "depois" });

describe("classificarAlteracoesAditivo", () => {
  it("classifica todas as origens aplicáveis sem inferir efeitos", () => {
    const campos = OrigemCampoSchema.options.filter(campo => !campo.startsWith("ADITIVO_"));
    const resultado = classificarAlteracoesAditivo(campos.map(alterar));
    expect(resultado.impactos).toHaveLength(campos.length);
    expect(resultado.impactos.every(i => i.exigeEstruturacao)).toBe(true);
    expect(resultado.grupos).toEqual(["ACADEMICO", "CADASTRAL", "FINANCEIRO", "CONTRATUAL"].filter(grupo => resultado.impactos.some(i => i.grupo === grupo)));
  });

  it("preserva a ordem do snapshot e separa os tipos", () => {
    const entrada = [alterar("ALUNO_EMAIL"), alterar("TAXA_VALOR"), alterar("REGIME"), alterar("AGENDA_PARTICULAR")];
    const resultado = classificarAlteracoesAditivo(entrada);
    expect(resultado.impactos.map(i => [i.campo, i.grupo, i.tipo])).toEqual([
      ["ALUNO_EMAIL", "CADASTRAL", "EMAIL"], ["TAXA_VALOR", "FINANCEIRO", "DINHEIRO"], ["REGIME", "CONTRATUAL", "REGIME"], ["AGENDA_PARTICULAR", "ACADEMICO", "AGENDA"],
    ]);
    expect(resultado.impactos[2]!.pendencias.join(" ")).toMatch(/financeiro e acadêmico/);
  });

  it("rejeita derivadas, duplicadas, vazias e desconhecidas", () => {
    expect(() => classificarAlteracoesAditivo([alterar("ADITIVO_VIGENCIA")])).toThrow(/derivados/);
    expect(() => classificarAlteracoesAditivo([alterar("MOEDA"), alterar("MOEDA")])).toThrow(/mais de uma vez/);
    expect(() => classificarAlteracoesAditivo([])).toThrow();
    expect(() => classificarAlteracoesAditivo([{ ...alterar("MOEDA"), campo: "DESCONTO" }])).toThrow();
  });

  it("não altera o snapshot recebido", () => {
    const entrada = [alterar("MENSALIDADE_VALOR")];
    const antes = structuredClone(entrada);
    classificarAlteracoesAditivo(entrada);
    expect(entrada).toEqual(antes);
  });
});
