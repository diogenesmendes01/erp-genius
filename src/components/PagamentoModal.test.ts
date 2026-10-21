import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// R1 da #173 (C2 e C3): o valor recebido começa pelo saldo no formato do próprio campo ("150,50"), nunca
// String(150.5) = "150.5", que parseMoeda recusa (ponto ambíguo, issue #167). E o CampoMoeda recebe o id
// do modal, então o aviso de centavos em CRC entra no aria-describedby do input.
// Sem banco: a action do servidor e o upload são trocados por dublês.
vi.mock("@/server/financeiro/acoes", () => ({ registrarPagamento: vi.fn() }));
vi.mock("@/components/UploadArquivo", () => ({ UploadArquivo: () => null }));

import { PagamentoModal } from "./PagamentoModal";

type Props = Parameters<typeof PagamentoModal>[0];
const render = (p: Partial<Props>) =>
  renderToStaticMarkup(createElement(PagamentoModal, { cobrancaId: "c", moeda: "BRL", valorEsperado: 150.5, onClose: () => {}, onDone: () => {}, ...p }));

/** O <input> do valor recebido (o único com esse nome acessível). */
const inputValor = (html: string) => /<input\b[^>]*aria-label="Valor recebido"[^>]*>/.exec(html)?.[0] ?? "";
const attr = (trecho: string, nome: string) => new RegExp(`\\s${nome}="([^"]*)"`).exec(trecho)?.[1];

beforeEach(() => vi.stubGlobal("crypto", { randomUUID: () => "chave-teste" }));
afterEach(() => vi.unstubAllGlobals());

describe("PagamentoModal — valor inicial do campo (R1 da #173, C2)", () => {
  it("saldo fracionado de 1 a 3 dígitos (150.5) começa como 150,50, não 150.5", () => {
    const input = inputValor(render({ valorEsperado: 150.5 }));
    expect(input).not.toBe("");
    expect(attr(input, "value")).toBe("150,50");
  });

  it("saldo restante (parciais anteriores) também entra no formato do campo", () => {
    expect(attr(inputValor(render({ valorEsperado: 300, jaRecebido: 149.5, saldoRestante: 150.5 })), "value")).toBe("150,50");
  });

  it("saldo inteiro em CRC começa sem casas, sem aviso", () => {
    const html = render({ moeda: "CRC", valorEsperado: 1250 });
    expect(attr(inputValor(html), "value")).toBe("1250");
    expect(html).not.toContain("normalmente não usa centavos");
  });
});

describe("PagamentoModal — aviso ligado ao input (R1 da #173, B1 e C3)", () => {
  it("saldo fracionado em CRC (1250,50) começa exato, com o aviso neutro no aria-describedby do input", () => {
    const html = render({ moeda: "CRC", valorEsperado: 1250.5 });
    const input = inputValor(html);
    expect(attr(input, "value")).toBe("1250,50");
    const id = attr(input, "id");
    expect(id).toBeTruthy();
    expect(attr(input, "aria-describedby")).toBe(`${id}-aviso-moeda`);
    expect(html).toContain(`<span id="${id}-aviso-moeda" aria-hidden="true" class="mt-1 block text-xs text-amber-700">CRC normalmente não usa centavos — confira o valor. Ele será registrado exatamente como digitado, sem arredondamento.</span>`);
  });
});
