import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StatusCobranca, TipoCobranca } from "@prisma/client";
import type { VencimentoVisivel } from "@/lib/vencimento-civil";

// R1 da #173 (C2): o "Novo valor" do RenegociarModal começa pelo valor negociado no formato do próprio
// campo ("150,50"), nunca String(150.5) = "150.5", que parseMoeda recusa (ponto ambíguo, issue #167).
// Sem banco: as actions do servidor (ajuste e, pela ficha, o pagamento) e o upload são dublês.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/ajustes/acoes", () => ({ ajustarCobranca: vi.fn() }));
vi.mock("@/server/financeiro/acoes", () => ({ registrarPagamento: vi.fn() }));
vi.mock("@/components/UploadArquivo", () => ({ UploadArquivo: () => null }));

import { RenegociarModal, type FichaFinanceiraDados } from "./FichaFinanceira";

type Cobranca = FichaFinanceiraDados["cobrancas"][number];
const vencimento: VencimentoVisivel = { estado: "A_CONFERIR", motivo: "legado" };
const cobranca = (valorNegociado: number, moeda = "BRL"): Cobranca => ({
  id: "cobranca", tipo: TipoCobranca.MENSALIDADE, status: StatusCobranca.PENDENTE, valorNegociado, valorRecebido: 0, saldo: valorNegociado,
  moeda, vencimento, pagoEm: null, forma: null, regua: null,
});
const render = (valorNegociado: number, moeda = "BRL") =>
  renderToStaticMarkup(createElement(RenegociarModal, { cobranca: cobranca(valorNegociado, moeda), moeda, podePerdao: false, onClose: () => {}, onDone: () => {} }));

/** O <input> do novo valor: o CampoMoeda recebe o id `${useId}-valor`. */
const inputNovoValor = (html: string) => /<input\b[^>]*\sid="[^"]*-valor"[^>]*>/.exec(html)?.[0] ?? "";
const attr = (trecho: string, nome: string) => new RegExp(`\\s${nome}="([^"]*)"`).exec(trecho)?.[1];

describe("RenegociarModal — valor inicial do campo (R1 da #173, C2)", () => {
  it("valor negociado fracionado de 1 a 3 dígitos (150.5) começa como 150,50, não 150.5", () => {
    const input = inputNovoValor(render(150.5));
    expect(input).not.toBe("");
    expect(attr(input, "value")).toBe("150,50");
  });

  it("valor inteiro em BRL começa com duas casas; em CRC, sem casas", () => {
    expect(attr(inputNovoValor(render(150)), "value")).toBe("150,00");
    expect(attr(inputNovoValor(render(1250, "CRC")), "value")).toBe("1250");
  });

  it("fracionado em CRC começa exato (1250,50), sem arredondar, com o aviso neutro ligado ao input", () => {
    const html = render(1250.5, "CRC");
    const input = inputNovoValor(html);
    expect(attr(input, "value")).toBe("1250,50");
    expect(attr(input, "aria-describedby")).toBe(`${attr(input, "id")}-aviso-moeda`);
    expect(html).toContain("CRC normalmente não usa centavos — confira o valor.");
  });
});
