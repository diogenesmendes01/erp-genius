import { describe, expect, it } from "vitest";

import { normalizarInsight as normalizar } from "./saida";
const completo = () => ({
  temperatura: "MORNO", chanceFechar: 62, sentimento: "POSITIVO",
  melhorHorario: "À tarde, conforme informado", intencao: "Comparar horários",
  sinais: ["Perguntou por horários"], riscos: ["Disponibilidade ainda não confirmada"],
  proximoPasso: "Confirmar preferência", textoSugerido: "Qual horário você prefere?",
});
describe("saída fechada de Insights D12", () => {
  it("preserva todos os campos e o mesmo texto sugerido", async () => {
    expect(await normalizar(completo())).toEqual(completo());
  });
  it("aceita ausência de evidência sem inventar valor", async () => {
    const v = { temperatura: null, chanceFechar: null, sentimento: null, melhorHorario: null,
      intencao: null, sinais: [], riscos: [], proximoPasso: null, textoSugerido: null };
    expect(await normalizar(v)).toEqual(v);
  });
  it.each([-1, 101, NaN, Infinity, "62"])("recusa chance inválida %s", async (chanceFechar) => {
    expect(await normalizar({ ...completo(), chanceFechar })).toBeNull();
  });
  it.each(["temperatura", "sentimento"])("recusa enum desconhecido em %s", async (campo) => {
    expect(await normalizar({ ...completo(), [campo]: "INVENTADO" })).toBeNull();
  });
  it("recusa chaves inesperadas e objeto incompleto", async () => {
    expect(await normalizar({ ...completo(), leadId: "segredo" })).toBeNull();
    expect(await normalizar({ textoSugerido: "isolado" })).toBeNull();
  });
  it("aceita exatamente 8 itens de 500 caracteres e sugestão de 4000", async () => {
    const v = { ...completo(), sinais: Array(8).fill("x".repeat(500)), textoSugerido: "s".repeat(4000) };
    expect(await normalizar(v)).toEqual(v);
  });
  it.each([
    { sinais: Array(9).fill("sinal") }, { riscos: ["x".repeat(501)] },
    { intencao: "x".repeat(501) }, { textoSugerido: "x".repeat(4001) },
    { sinais: [""] }, { melhorHorario: "   " },
  ])("recusa limite/valor vazio %j", async (delta) => {
    expect(await normalizar({ ...completo(), ...delta })).toBeNull();
  });
  it("valida JSON simples sem aceitar markdown ou texto extra", async () => {
    expect(await normalizar(JSON.stringify(completo()))).toEqual(completo());
    expect(await normalizar("```json\n" + JSON.stringify(completo()) + "\n```")).toBeNull();
    expect(await normalizar("prefixo" + JSON.stringify(completo()))).toBeNull();
  });
});
