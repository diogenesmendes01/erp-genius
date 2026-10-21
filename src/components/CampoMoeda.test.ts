import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Campo, type LigacaoCampo } from "./Campo";
import { DICA_PONTO_DECIMAL, DICA_PONTO_MILHAR } from "@/lib/dinheiro";
import { criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

// C6 do doc 44 (issue #167): em moeda sem centavos (CRC, CLP), sair do campo com "100,50" virava "101"
// em silêncio. Agora o texto fica como o operador digitou e um aviso visível, ligado ao input, aparece.
// C6 da #173 (B12 da triagem): o aviso visível muda a cada tecla, mas o anúncio ao leitor de tela só sai
// no blur, por uma região polite sempre montada. CampoMoeda é chamado como função, com o useState de
// src/test/tela-sem-dom.ts, para ler a árvore e disparar digitação e blur sem DOM.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real, useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState };
});

import { CampoMoeda } from "./CampoMoeda";

beforeEach(() => { m.ganchos = criarGanchos(); });

type Props = Parameters<typeof CampoMoeda>[0];
const props = (p: Partial<Props>): Props => ({ value: "", onChange: () => {}, className: "c", ...p });
const html = (p: Partial<Props>) => { m.ganchos!.reiniciar(); return renderToStaticMarkup(createElement(CampoMoeda, props(p))); };

const tag = (h: string, nome: string) => new RegExp(`<${nome}\\b[^>]*>`).exec(h)?.[0] ?? "";
const attr = (trecho: string, nome: string) => new RegExp(`\\s${nome}="([^"]*)"`).exec(trecho)?.[1];

const desenhar = (p: Partial<Props>) => m.ganchos!.renderizar(CampoMoeda, props(p));
const inputDe = (arvore: ReactNode) => elementos(arvore).find((n: No) => n.type === "input")!;

/** Renderiza, dispara o onBlur do <input> e desenha de novo: devolve o que o campo pediu para gravar e a árvore depois do blur. */
function sairDoCampo(p: Partial<Props>) {
  const onChange = vi.fn();
  (inputDe(desenhar({ ...p, onChange })).props.onBlur as () => void)();
  return { onChange, arvore: desenhar({ ...p, onChange }) };
}

/** Os avisos visíveis (texto amarelo abaixo do campo). */
const avisos = (arvore: ReactNode) => elementos(arvore).filter((n) => n.type === "span" && String(n.props.className ?? "").includes("text-amber-700"));
/** O que a região polite está anunciando. */
function anuncio(arvore: ReactNode) {
  const regioes = elementos(arvore).filter((n) => n.props.role === "status");
  expect(regioes, "uma região polite sempre montada").toHaveLength(1);
  return texto(regioes[0]);
}

const AVISO_CRC = "CRC normalmente não usa centavos — confira o valor. Ele será registrado exatamente como digitado, sem arredondamento.";

describe("CampoMoeda — moeda sem centavos não arredonda no blur (C6, issue #167)", () => {
  it("100,50 em CRC: ao sair do campo o valor NÃO muda e o aviso aparece", () => {
    const { onChange, arvore } = sairDoCampo({ value: "100,50", moeda: "CRC" });
    expect(onChange).not.toHaveBeenCalled();
    expect(avisos(arvore).map((n) => texto(n))).toEqual([AVISO_CRC]);
    expect(anuncio(arvore)).toBe(AVISO_CRC);
    expect(inputDe(arvore).props.value).toBe("100,50");
  });

  it("100,50 em CLP: mesmo comportamento, com o código da moeda no aviso", () => {
    const { onChange, arvore } = sairDoCampo({ value: "100,50", moeda: "CLP" });
    expect(onChange).not.toHaveBeenCalled();
    expect(texto(avisos(arvore)[0])).toMatch(/^CLP normalmente não usa centavos/);
  });

  it("100 em CRC: sem aviso, e o blur continua normalizando (sem casas)", () => {
    const { onChange, arvore } = sairDoCampo({ value: "100", moeda: "CRC" });
    expect(onChange).toHaveBeenCalledWith("100");
    expect(avisos(arvore)).toHaveLength(0);
  });

  it("100,00 em CRC é inteiro: normaliza para 100, sem aviso e sem perder nada", () => {
    const { onChange, arvore } = sairDoCampo({ value: "100,00", moeda: "CRC" });
    expect(onChange).toHaveBeenCalledWith("100");
    expect(avisos(arvore)).toHaveLength(0);
  });

  it("100,50 e 100,5 em BRL: normaliza com duas casas, sem aviso", () => {
    expect(sairDoCampo({ value: "100,50", moeda: "BRL" }).onChange).toHaveBeenCalledWith("100,50");
    const { onChange, arvore } = sairDoCampo({ value: "100,5", moeda: "BRL" });
    expect(onChange).toHaveBeenCalledWith("100,50");
    expect(avisos(arvore)).toHaveLength(0);
  });

  it("pré-preenchimento fracionado em CRC (saldo 1250,50): o blur não mexe e o aviso é o neutro (R1 da #173, B1)", () => {
    const { onChange, arvore } = sairDoCampo({ value: "1250,50", moeda: "CRC" });
    expect(onChange).not.toHaveBeenCalled();
    expect(avisos(arvore).map((n) => texto(n))).toEqual([AVISO_CRC]);
  });

  it("texto ambíguo ou inválido (1.23, 1.234, 1.234,56) fica como está; ganha a dica do ponto, não o aviso de centavos", () => {
    const esperado: Record<string, string> = { "1.23": DICA_PONTO_DECIMAL, "1.234": DICA_PONTO_MILHAR, "1.234,56": DICA_PONTO_MILHAR };
    for (const value of Object.keys(esperado)) {
      for (const moeda of ["BRL", "CRC"]) {
        const { onChange, arvore } = sairDoCampo({ value, moeda });
        expect(onChange, `${value} ${moeda}`).not.toHaveBeenCalled();
        expect(avisos(arvore).map((n) => texto(n)), `${value} ${moeda}`).toEqual([esperado[value]]);
        expect(anuncio(arvore), `${value} ${moeda}`).toBe(esperado[value]);
      }
    }
  });

  it("texto inválido sem ponto (abc) fica como está, sem dica nem aviso", () => {
    const { onChange, arvore } = sairDoCampo({ value: "abc", moeda: "BRL" });
    expect(onChange).not.toHaveBeenCalled();
    expect(avisos(arvore)).toHaveLength(0);
    expect(anuncio(arvore)).toBe("");
  });

  it("1,23 em BRL é aceito e normalizado", () => {
    expect(sairDoCampo({ value: "1,23", moeda: "BRL" }).onChange).toHaveBeenCalledWith("1,23");
  });
});

describe("CampoMoeda — aviso visível e associado ao campo", () => {
  it("com id: o aviso tem id próprio e entra no aria-describedby do input; a região polite nasce vazia", () => {
    const h = html({ id: "valor", value: "100,50", moeda: "CRC" });
    const input = tag(h, "input");
    expect(attr(input, "aria-describedby")).toBe("valor-aviso-moeda");
    expect(h).toContain(`<span id="valor-aviso-moeda" aria-hidden="true" class="mt-1 block text-xs text-amber-700">${AVISO_CRC}</span><span role="status" class="sr-only"></span>`);
    expect(attr(input, "value")).toBe("100,50");
  });

  it("dentro de <Campo>: o aviso se junta à dica e ao erro do Campo, sem substituí-los", () => {
    const h = renderToStaticMarkup(createElement(
      Campo,
      { rotulo: "Valor", id: "taxa", dica: "Sugerido: ₡ 100", erro: "Confira o valor." } as Parameters<typeof Campo>[0],
      ((c: LigacaoCampo) => createElement(CampoMoeda, { ...c, value: "100,50", onChange: () => {}, moeda: "CRC", className: "c" })) as unknown as ReactNode,
    ));
    expect(attr(tag(h, "input"), "aria-describedby")).toBe("taxa-dica taxa-erro taxa-aviso-moeda");
    expect(h).toContain('id="taxa-aviso-moeda"');
  });

  it("dica do ponto (R1 da #173, C1): 100.50 mostra \"use vírgula\" ligada ao input pelo mesmo id do aviso", () => {
    const h = html({ id: "valor", value: "100.50", moeda: "BRL" });
    expect(attr(tag(h, "input"), "aria-describedby")).toBe("valor-aviso-moeda");
    expect(h).toContain(`<span id="valor-aviso-moeda" aria-hidden="true" class="mt-1 block text-xs text-amber-700">${DICA_PONTO_DECIMAL}</span>`);
    expect(attr(tag(h, "input"), "value")).toBe("100.50");
  });

  it("sem id: o aviso continua visível (e anunciado no blur), sem inventar describedby", () => {
    const h = html({ value: "100,50", moeda: "CRC" });
    expect(h).toContain(`<span aria-hidden="true" class="mt-1 block text-xs text-amber-700">${AVISO_CRC}</span>`);
    expect(tag(h, "input")).not.toContain("aria-describedby");
  });

  it("sem aviso: só a região polite vazia (nenhum role=alert) e o describedby recebido passa intacto", () => {
    for (const p of [{ value: "100", moeda: "CRC" }, { value: "100,50", moeda: "BRL" }, { value: "100,50" }]) {
      const h = html({ id: "v", ...p });
      expect(h).not.toContain('role="alert"');
      expect(h).not.toContain("text-amber-700");
      expect(h).toMatch(/<span role="status" class="sr-only"><\/span><\/div>$/);
    }
    expect(attr(tag(html({ id: "v", value: "100", moeda: "CRC", "aria-describedby": "v-dica" }), "input"), "aria-describedby")).toBe("v-dica");
  });

  it("o símbolo continua à esquerda do input, dentro do mesmo bloco relativo", () => {
    const h = html({ value: "100", moeda: "CRC" });
    expect(h).toMatch(/^<div><div class="relative"><span aria-hidden="true"[^>]*>₡<\/span><input /);
  });
});

describe("CampoMoeda — anúncio só no blur (C6 da #173, B12)", () => {
  it("digitando 1 → 1.2 → 1.234: o aviso visível acompanha, mas nada é anunciado e não há role=alert", () => {
    const valores: string[] = [];
    const onChange = (v: string) => { valores.push(v); };
    let arvore = desenhar({ id: "v", value: "", onChange });
    for (const tecla of ["1", "1.2", "1.23", "1.234"]) {
      (inputDe(arvore).props.onChange as (e: { target: { value: string } }) => void)({ target: { value: tecla } });
      arvore = desenhar({ id: "v", value: tecla, onChange });
      expect(anuncio(arvore), tecla).toBe("");
      expect(elementos(arvore).some((n) => n.props.role === "alert"), tecla).toBe(false);
    }
    expect(valores).toEqual(["1", "1.2", "1.23", "1.234"]);
    expect(avisos(arvore).map((n) => texto(n))).toEqual([DICA_PONTO_MILHAR]);
  });

  it("blur anuncia o aviso que ficou; voltar a digitar esvazia; o próximo blur anuncia de novo", () => {
    const onChange = vi.fn();
    const p = { id: "v", value: "1.234", moeda: "BRL", onChange };
    (inputDe(desenhar(p)).props.onBlur as () => void)();
    let arvore = desenhar(p);
    expect(anuncio(arvore)).toBe(DICA_PONTO_MILHAR);
    (inputDe(arvore).props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "1.23" } });
    arvore = desenhar({ ...p, value: "1.23" });
    expect(anuncio(arvore)).toBe("");
    (inputDe(arvore).props.onBlur as () => void)();
    expect(anuncio(desenhar({ ...p, value: "1.23" }))).toBe(DICA_PONTO_DECIMAL);
  });

  it("blur que normaliza (texto válido) não anuncia nada e apaga um anúncio anterior", () => {
    const onChange = vi.fn();
    const p = { id: "v", value: "1.234", moeda: "BRL", onChange };
    (inputDe(desenhar(p)).props.onBlur as () => void)();
    expect(anuncio(desenhar(p))).toBe(DICA_PONTO_MILHAR);
    (inputDe(desenhar({ ...p, value: "1234" })).props.onBlur as () => void)();
    expect(onChange).toHaveBeenCalledWith("1234,00");
    expect(anuncio(desenhar({ ...p, value: "1234,00" }))).toBe("");
  });
});
