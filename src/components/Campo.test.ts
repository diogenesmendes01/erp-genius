import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTROLE_INVALIDO, Campo, DICA_CAMPO, ERRO_CAMPO, ROTULO_CAMPO, focarPrimeiroComErro, type LigacaoCampo } from "./Campo";
import { CampoTexto } from "./CampoTexto";
import { CampoMoeda } from "./CampoMoeda";
import { CampoFuso } from "./CampoFuso";

type Props = { rotulo?: ReactNode; obrigatorio?: boolean; dica?: ReactNode; erro?: string | null; id?: string; className?: string };
type PropsCampo = Parameters<typeof Campo>[0];

/** <Campo> com o controle como filho: a função vai no 3º argumento do createElement (o React a entrega em `children`). */
const elCampo = (props: Omit<PropsCampo, "children">, filho: PropsCampo["children"]) =>
  createElement(Campo, props as PropsCampo, filho as unknown as ReactNode);

/** Campo com um <input> espalhando a ligação — o uso padrão nas telas. */
const comInput = (props: Props) =>
  renderToStaticMarkup(elCampo({ rotulo: "Nome", ...props }, (campo: LigacaoCampo) => createElement("input", { ...campo, className: "c" })));

const tag = (html: string, nome: string) => new RegExp(`<${nome}\\b[^>]*>`).exec(html)?.[0] ?? "";
const attr = (trecho: string, nome: string) => new RegExp(`\\s${nome}="([^"]*)"`).exec(trecho)?.[1];

describe("Campo (E1/E7): rótulo, dica, erro e obrigatoriedade ligados ao controle", () => {
  it("o rótulo aponta para o id do controle (htmlFor ↔ id); classes só de tokens", () => {
    const html = comInput({ id: "aluno-nome" });
    expect(tag(html, "label")).toBe(`<label for="aluno-nome" class="${ROTULO_CAMPO}">`);
    expect(attr(tag(html, "input"), "id")).toBe("aluno-nome");
    expect(ROTULO_CAMPO).toBe("mb-1 block text-xs text-gray-600");
    expect(DICA_CAMPO).toBe("mt-1 block text-xs text-gray-500");
    expect(ERRO_CAMPO).toBe("mt-1 block text-xs text-red-700");
    expect(CONTROLE_INVALIDO).toBe("aria-[invalid=true]:border-red-500");
  });

  it("sem id fixo, useId: rótulo e controle combinam e dois Campos na mesma tela não colidem", () => {
    const html = renderToStaticMarkup(createElement("div", null,
      elCampo({ rotulo: "A" }, (c: LigacaoCampo) => createElement("input", c)),
      elCampo({ rotulo: "B" }, (c: LigacaoCampo) => createElement("input", c)),
    ));
    const fors = [...html.matchAll(/<label for="([^"]+)"/g)].map((m) => m[1]);
    const ids = [...html.matchAll(/<input id="([^"]+)"/g)].map((m) => m[1]);
    expect(fors).toHaveLength(2);
    expect(ids).toEqual(fors);
    expect(fors[0]).not.toBe(fors[1]);
  });

  it("obrigatório: aria-required no controle e asterisco fora do nome (aria-hidden); opcional não marca nada", () => {
    const obrig = comInput({ id: "n", obrigatorio: true });
    expect(attr(tag(obrig, "input"), "aria-required")).toBe("true");
    expect(obrig).toContain('<span aria-hidden="true" class="text-red-700"> *</span></label>');
    // Não põe `required` nativo: bloquear o envio é decisão da tela.
    expect(tag(obrig, "input")).not.toMatch(/\srequired=/);
    const opcional = comInput({ id: "n" });
    expect(opcional).not.toContain("aria-required");
    expect(opcional).not.toContain(" *");
  });

  it("aria-invalid só com mensagem de erro; a mensagem é role=\"alert\" e entra em aria-describedby", () => {
    const comErro = comInput({ id: "n", erro: "Informe o nome." });
    const input = tag(comErro, "input");
    expect(attr(input, "aria-invalid")).toBe("true");
    expect(attr(input, "aria-describedby")).toBe("n-erro");
    expect(comErro).toContain(`<span id="n-erro" role="alert" class="${ERRO_CAMPO}">Informe o nome.</span>`);
    for (const erro of [undefined, null, ""]) {
      const html = comInput({ id: "n", erro });
      expect(html, String(erro)).not.toContain("aria-invalid");
      expect(html, String(erro)).not.toContain('role="alert"');
      expect(html, String(erro)).not.toContain("aria-describedby");
    }
  });

  it("dica + erro: os dois em aria-describedby, dica antes do erro; dica sozinha também liga", () => {
    const html = comInput({ id: "n", dica: "Como no documento.", erro: "Informe o nome." });
    expect(attr(tag(html, "input"), "aria-describedby")).toBe("n-dica n-erro");
    expect(html).toContain(`<span id="n-dica" class="${DICA_CAMPO}">Como no documento.</span>`);
    // Ordem visual: controle, dica, erro.
    expect(html.indexOf("<input")).toBeLessThan(html.indexOf('id="n-dica"'));
    expect(html.indexOf('id="n-dica"')).toBeLessThan(html.indexOf('id="n-erro"'));
    const soDica = comInput({ id: "n", dica: "Como no documento." });
    expect(attr(tag(soDica, "input"), "aria-describedby")).toBe("n-dica");
    expect(soDica).not.toContain("aria-invalid");
  });

  it("className é do invólucro (posição na grade); o rótulo aceita nó", () => {
    const html = renderToStaticMarkup(elCampo(
      { rotulo: createElement("span", null, "Taxa"), className: "sm:col-span-2", id: "t" },
      (c: LigacaoCampo) => createElement("input", c),
    ));
    expect(html.startsWith('<div class="sm:col-span-2"><label for="t"')).toBe(true);
    expect(html).toContain("<span>Taxa</span>");
  });
});

describe("Campo compõe com os campos do design system (sem duplicá-los)", () => {
  it("CampoTexto: recebe id, aria-required e aria-invalid; o describedby do Campo se junta à dica de mínimo", () => {
    const html = renderToStaticMarkup(elCampo(
      { rotulo: "Motivo", id: "motivo", obrigatorio: true, dica: "Fica na auditoria.", erro: "Informe o motivo." },
      (c: LigacaoCampo) => createElement(CampoTexto, { ...c, minLength: 5, value: "", onChange: () => {} }),
    ));
    const campo = /<textarea\b[^>]*>/.exec(html)?.[0] ?? "";
    expect(attr(campo, "id")).toBe("motivo");
    expect(attr(campo, "aria-required")).toBe("true");
    expect(attr(campo, "aria-invalid")).toBe("true");
    expect(attr(campo, "aria-describedby")).toMatch(/^motivo-dica motivo-erro \S+-dica$/);
    expect(html).toContain('<label for="motivo"');
  });

  it("CampoTexto sem erro do Campo: continua marcando inválido só abaixo do mínimo (regra dele)", () => {
    const render = (value: string) => renderToStaticMarkup(elCampo(
      { rotulo: "Motivo", id: "motivo" }, (c: LigacaoCampo) => createElement(CampoTexto, { ...c, minLength: 5, value, onChange: () => {} }),
    ));
    expect(render("ok")).toMatch(/<textarea[^>]*aria-invalid="true"/);
    expect(render("motivo longo")).not.toContain("aria-invalid");
  });

  it("CampoMoeda: o <input> recebe a ligação inteira", () => {
    const html = renderToStaticMarkup(elCampo(
      { rotulo: "Taxa de matrícula", id: "taxa", obrigatorio: true, dica: "Sugerido: R$ 100,00", erro: "Informe a taxa." },
      (c: LigacaoCampo) => createElement(CampoMoeda, { ...c, value: "", onChange: () => {}, moeda: "BRL", className: "c" }),
    ));
    const input = tag(html, "input");
    expect(attr(input, "id")).toBe("taxa");
    expect(attr(input, "aria-required")).toBe("true");
    expect(attr(input, "aria-invalid")).toBe("true");
    expect(attr(input, "aria-describedby")).toBe("taxa-dica taxa-erro");
    expect(html).toContain('<label for="taxa"');
  });

  it("CampoFuso: o <input> recebe a ligação; o datalist continua com id próprio", () => {
    const html = renderToStaticMarkup(elCampo(
      { rotulo: "Fuso horário", id: "fuso", obrigatorio: true, erro: "Informe o fuso." },
      (c: LigacaoCampo) => createElement(CampoFuso, { ...c, padrao: "", className: "c" }),
    ));
    const input = tag(html, "input");
    expect(attr(input, "id")).toBe("fuso");
    expect(attr(input, "aria-required")).toBe("true");
    expect(attr(input, "aria-invalid")).toBe("true");
    expect(attr(input, "aria-describedby")).toBe("fuso-erro");
    expect(attr(input, "list")).not.toBe("fuso");
  });

  it("sem Campo, CampoMoeda e CampoFuso não inventam atributos de ligação", () => {
    const moeda = renderToStaticMarkup(createElement(CampoMoeda, { value: "", onChange: () => {}, className: "c" }));
    const fuso = renderToStaticMarkup(createElement(CampoFuso, { padrao: "", className: "c" }));
    for (const html of [moeda, fuso]) expect(html).not.toMatch(/aria-(?:required|invalid|describedby)/);
  });
});

describe("focarPrimeiroComErro", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("foca o primeiro campo com mensagem, na ordem da validação; devolve se havia erro", () => {
    const focados: string[] = [];
    vi.stubGlobal("document", { getElementById: (id: string) => ({ focus: () => focados.push(id) }) });
    const ids = { nome: "f-nome", email: "f-email", pais: "f-pais" };
    expect(focarPrimeiroComErro({ email: "E-mail inválido.", nome: "Informe o nome." }, ids)).toBe(true);
    expect(focados).toEqual(["f-email"]);
    // Chave sem mensagem não conta.
    expect(focarPrimeiroComErro({ nome: "", pais: "Selecione o país." }, ids)).toBe(true);
    expect(focados).toEqual(["f-email", "f-pais"]);
    expect(focarPrimeiroComErro({}, ids)).toBe(false);
    expect(focados).toHaveLength(2);
  });

  it("sem document (renderização no servidor) só informa se havia erro", () => {
    expect(focarPrimeiroComErro({ nome: "Informe o nome." }, { nome: "f-nome" })).toBe(true);
    expect(focarPrimeiroComErro({}, { nome: "f-nome" })).toBe(false);
  });
});
