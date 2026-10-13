import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Campo, type LigacaoCampo } from "./Campo";
import { CampoMoeda } from "./CampoMoeda";
import { DICA_PONTO_DECIMAL, DICA_PONTO_MILHAR } from "@/lib/dinheiro";
import { elementos, texto, type No } from "@/test/tela-sem-dom";

// C6 do doc 44 (issue #167): em moeda sem centavos (CRC, CLP), sair do campo com "100,50" virava "101"
// em silêncio. Agora o texto fica como o operador digitou e um aviso visível, ligado ao input, aparece.
// CampoMoeda não usa ganchos de React, então é chamado como função para ler a árvore e disparar o blur
// (mesmo padrão sem DOM de src/test/tela-sem-dom.ts).

type Props = Parameters<typeof CampoMoeda>[0];
const props = (p: Partial<Props>): Props => ({ value: "", onChange: () => {}, className: "c", ...p });
const html = (p: Partial<Props>) => renderToStaticMarkup(createElement(CampoMoeda, props(p)));

const tag = (h: string, nome: string) => new RegExp(`<${nome}\\b[^>]*>`).exec(h)?.[0] ?? "";
const attr = (trecho: string, nome: string) => new RegExp(`\\s${nome}="([^"]*)"`).exec(trecho)?.[1];

/** Renderiza como função, dispara o onBlur do <input> e devolve o que o campo pediu para gravar. */
function sairDoCampo(p: Partial<Props>) {
  const onChange = vi.fn();
  const arvore = CampoMoeda(props({ ...p, onChange })) as ReactNode;
  const input = elementos(arvore).find((n: No) => n.type === "input")!;
  (input.props.onBlur as () => void)();
  return { onChange, arvore };
}

const avisos = (arvore: ReactNode) => elementos(arvore).filter((n) => n.props.role === "alert");

const AVISO_CRC = "CRC normalmente não usa centavos — confira o valor. Ele será registrado exatamente como digitado, sem arredondamento.";

describe("CampoMoeda — moeda sem centavos não arredonda no blur (C6, issue #167)", () => {
  it("100,50 em CRC: ao sair do campo o valor NÃO muda e o aviso aparece", () => {
    const { onChange, arvore } = sairDoCampo({ value: "100,50", moeda: "CRC" });
    expect(onChange).not.toHaveBeenCalled();
    expect(avisos(arvore).map((n) => texto(n))).toEqual([AVISO_CRC]);
    const input = elementos(arvore).find((n) => n.type === "input")!;
    expect(input.props.value).toBe("100,50");
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
      }
    }
  });

  it("texto inválido sem ponto (abc) fica como está, sem dica nem aviso", () => {
    const { onChange, arvore } = sairDoCampo({ value: "abc", moeda: "BRL" });
    expect(onChange).not.toHaveBeenCalled();
    expect(avisos(arvore)).toHaveLength(0);
  });

  it("1,23 em BRL é aceito e normalizado", () => {
    expect(sairDoCampo({ value: "1,23", moeda: "BRL" }).onChange).toHaveBeenCalledWith("1,23");
  });
});

describe("CampoMoeda — aviso visível e associado ao campo", () => {
  it("com id: o aviso tem id próprio, role=alert, e entra no aria-describedby do input", () => {
    const h = html({ id: "valor", value: "100,50", moeda: "CRC" });
    const input = tag(h, "input");
    expect(attr(input, "aria-describedby")).toBe("valor-aviso-moeda");
    expect(h).toContain(`<span id="valor-aviso-moeda" role="alert" class="mt-1 block text-xs text-amber-700">${AVISO_CRC}</span>`);
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
    expect(h).toContain(`<span id="valor-aviso-moeda" role="alert" class="mt-1 block text-xs text-amber-700">${DICA_PONTO_DECIMAL}</span>`);
    expect(attr(tag(h, "input"), "value")).toBe("100.50");
  });

  it("sem id: o aviso continua visível e anunciado (role=alert), sem inventar describedby", () => {
    const h = html({ value: "100,50", moeda: "CRC" });
    expect(h).toContain(`<span role="alert" class="mt-1 block text-xs text-amber-700">${AVISO_CRC}</span>`);
    expect(tag(h, "input")).not.toContain("aria-describedby");
  });

  it("sem aviso: nenhum role=alert e o describedby recebido passa intacto", () => {
    expect(html({ id: "v", value: "100", moeda: "CRC" })).not.toContain("role=");
    expect(html({ id: "v", value: "100,50", moeda: "BRL" })).not.toContain("role=");
    expect(html({ id: "v", value: "100,50" })).not.toContain("role=");
    expect(attr(tag(html({ id: "v", value: "100", moeda: "CRC", "aria-describedby": "v-dica" }), "input"), "aria-describedby")).toBe("v-dica");
  });

  it("o símbolo continua à esquerda do input, dentro do mesmo bloco relativo", () => {
    const h = html({ value: "100", moeda: "CRC" });
    expect(h).toMatch(/^<div><div class="relative"><span aria-hidden="true"[^>]*>₡<\/span><input /);
  });
});
