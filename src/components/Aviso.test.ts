import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { razao } from "@/app/contraste-nucleo";
import { fundosDoTailwind } from "@/test/fundo-visivel";
import config from "../../tailwind.config";
import { Aviso, TONS_AVISO, type TomAviso } from "./Aviso";
import { AvisoFusoNaoConfigurado } from "./AvisoFusoNaoConfigurado";
import { FeedbackAcao } from "./FeedbackAcao";
import { MensagemStatus } from "./MensagemStatus";

const html = (tom: "info" | "sucesso" | "atencao" | "erro") => renderToStaticMarkup(createElement(Aviso, { tom } as ComponentProps<typeof Aviso>, "Texto"));

const { cor } = fundosDoTailwind(config);

describe("Aviso", () => {
  it("Aviso de erro tem role alert e borda inicial de 3 px", () => {
    const h = html("erro");
    expect(h).toContain('role="alert"');
    expect(h).toContain("border-s-[3px]");
    expect(h).toContain("rounded-md p-3 text-sm");
  });

  it.each([
    ["info", "bg-blue-100 text-blue-700 border-s-[3px] border-blue-700"],
    ["sucesso", "bg-green-100 text-green-700 border-s-[3px] border-green-700"],
    ["atencao", "bg-amber-100 text-amber-800 border-s-[3px] border-amber-600"],
    ["erro", "bg-red-100 text-red-700 border-s-[3px] border-red-600"],
  ] as const)("tom %s: classes exatas", (tom, classes) => {
    expect(html(tom)).toContain(classes);
  });

  it("os tons que não são erro usam role status", () => {
    for (const tom of ["info", "sucesso", "atencao"] as const) expect(html(tom)).toContain('role="status"');
  });

  // Revisão R1 do #269: o info era `bg-surface-muted` sem borda, igual ao fundo da página no tema claro; direto
  // sobre a página (fora de cartão, como em /aria), a caixa sumia. O fundo tingido dos tons quase não muda a
  // luminância (green-100 sobre a página dá ~1,02:1), então quem marca a caixa é a borda inicial: ≥ 3:1 (WCAG
  // 1.4.11) sobre a página e sobre o cartão, e o texto ≥ 4,5:1 sobre o próprio fundo, nos dois temas.
  it.each(Object.keys(TONS_AVISO) as TomAviso[])("tom %s: caixa visível direto na página ou no cartão, nos dois temas", (tom) => {
    const cls = TONS_AVISO[tom].split(" ");
    const achar = (re: RegExp) => {
      const c = cls.find((x) => re.test(x));
      if (!c) throw new Error(`${tom} sem ${re}`);
      return c;
    };
    const fundo = achar(/^bg-/);
    const texto = achar(/^text-/);
    const borda = achar(/^border-(?!s-)/);
    expect(cls).toContain("border-s-[3px]");
    for (const tema of ["claro", "escuro"] as const) {
      for (const sob of ["var(--bg-page)", "var(--surface)"]) {
        expect(razao(cor(tema, borda), cor(tema, sob)), `${tom} ${tema}: borda sobre ${sob}`).toBeGreaterThanOrEqual(3);
      }
      expect(razao(cor(tema, texto), cor(tema, fundo)), `${tom} ${tema}: texto sobre o fundo`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("título e ação aparecem quando passados", () => {
    const h = renderToStaticMarkup(createElement(Aviso, { tom: "atencao", titulo: "Atenção", acao: createElement("a", { href: "/x" }, "Ver") } as ComponentProps<typeof Aviso>, "Corpo"));
    expect(h).toContain("Atenção");
    expect(h).toContain('href="/x"');
  });

  it("FeedbackAcao de erro renderiza Aviso erro", () => {
    const h = renderToStaticMarkup(createElement(FeedbackAcao, { erro: "Falhou" }));
    expect(h).toContain('role="alert"');
    expect(h).toContain('tabindex="-1"');
    expect(h).toContain("bg-red-100 text-red-700 border-s-[3px] border-red-600");
    expect(h).toContain("Falhou");
  });

  it("FeedbackAcao de sucesso: região sr-only anuncia e a caixa visível é Aviso sucesso escondido do leitor", () => {
    const h = renderToStaticMarkup(createElement(FeedbackAcao, { erro: null, sucesso: "Salvo." }));
    expect(h).toContain('<p role="status" class="sr-only">Salvo.</p>');
    expect(h).toContain("bg-green-100 text-green-700 border-s-[3px] border-green-700");
    expect(h.match(/role="status"/g)).toHaveLength(1);
    expect(h).toContain('aria-hidden="true"');
  });

  it("MensagemStatus sem tom continua com o parágrafo simples", () => {
    expect(renderToStaticMarkup(createElement(MensagemStatus, { texto: "Oi", className: "x" }))).toContain('<p aria-hidden="true" class="x">Oi</p>');
  });

  it("AvisoFusoNaoConfigurado usa Aviso atenção", () => {
    const h = renderToStaticMarkup(createElement(AvisoFusoNaoConfigurado));
    expect(h).toContain("bg-amber-100 text-amber-800 border-s-[3px] border-amber-600");
    expect(h).toContain("Fuso da escola não configurado");
  });
});
