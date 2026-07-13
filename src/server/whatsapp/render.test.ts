import { describe, it, expect } from "vitest";
import { renderizarTemplate, TEXTOS_FABRICA } from "./render";

const DADOS = {
  nome: "María",
  valor: 85000,
  moeda: "CRC",
  vencimento: new Date(Date.UTC(2026, 6, 15)), // 2026-07-15
};

describe("whatsapp/render — renderizarTemplate", () => {
  it("substitui {nome} {valor} {vencimento} e devolve as variáveis NA ORDEM de aparição", () => {
    const r = renderizarTemplate("Oi {nome}, valor {valor} vence {vencimento}.", DADOS);
    expect(r.corpo).not.toMatch(/\{(nome|valor|vencimento|link)\}/);
    expect(r.corpo).toContain("María");
    expect(r.variaveis).toHaveLength(3);
    expect(r.variaveis[0]).toBe("María"); // ordem de aparição = posicionais {{1}}..{{n}} da Meta
    expect(r.variaveis[1]).toContain("85"); // valor formatado na moeda
    expect(r.corpo).toContain(r.variaveis[2]); // vencimento formatado presente no corpo
  });

  it("variável repetida entra duas vezes nas posicionais (fidelidade ao corpo)", () => {
    const r = renderizarTemplate("{nome}, confirma? {nome}?", DADOS);
    expect(r.variaveis).toEqual(["María", "María"]);
  });

  it("{link} ausente vira vazio sem quebrar", () => {
    const r = renderizarTemplate("Pague em {link}", DADOS);
    expect(r.corpo).toBe("Pague em ");
    expect(r.variaveis).toEqual([""]);
  });

  it("idioma muda o locale da data (pt-BR usa dd/mm/aaaa)", () => {
    const r = renderizarTemplate("{vencimento}", { ...DADOS, idioma: "pt" });
    expect(r.corpo).toBe("15/07/2026");
  });

  it("todos os textos de fábrica renderizam sem sobrar variável", () => {
    for (const corpo of Object.values(TEXTOS_FABRICA)) {
      const r = renderizarTemplate(corpo, DADOS);
      expect(r.corpo).not.toMatch(/\{(nome|valor|vencimento|link)\}/);
      expect(r.corpo.length).toBeGreaterThan(20);
    }
  });
});
