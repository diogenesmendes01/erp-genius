import { describe, expect, it } from "vitest";
import { analisarPlanilhaContatos, chaveColuna, COLUNAS_IMPORTACAO_CONTATOS } from "./importacao-contatos";

describe("importação de contatos (análise)", () => {
  it("valida nome, telefone e e-mail; repetidas contam uma vez", () => {
    const r = analisarPlanilhaContatos([{ Nome: "Ana", WhatsApp: "11 98888-7777" }, { Nome: "", WhatsApp: "1" }, { Nome: "Ana", WhatsApp: "+5511988887777" }], "+55");
    expect(r.validas).toHaveLength(1);
    expect(r.validas[0].telefoneE164).toBe("+5511988887777");
    expect(r.invalidas).toEqual([{ linha: 3, motivo: "Informe o nome." }]);
    expect(r.repetidasNaPlanilha).toBe(1);
  });
  it("não existe coluna de opt-in", () => expect(COLUNAS_IMPORTACAO_CONTATOS).not.toContain("Opt-in"));
  it("rejeita e-mail e telefone inválidos e linha sem identidade", () => {
    const r = analisarPlanilhaContatos([{ Nome: "A", "E-mail": "x" }, { Nome: "B", WhatsApp: "12" }, { Nome: "C" }], "+55");
    expect(r.invalidas.map((i) => i.motivo)).toEqual(["E-mail inválido.", "WhatsApp inválido.", "Informe o WhatsApp ou o e-mail."]);
  });
  it("reconhece origem pelo rótulo e ignora a desconhecida; cabeçalho tolera caixa", () => {
    const r = analisarPlanilhaContatos([{ Nome: "A", "E-mail": "a@x.test", Origem: "indicação" }, { Nome: "B", "E-mail": "b@x.test", Origem: "???" }], "+55");
    expect(r.validas.map((v) => v.origemCanal)).toEqual(["INDICACAO", null]);
    expect(chaveColuna("E-MAIL")).toBe("E-mail");
  });
});
