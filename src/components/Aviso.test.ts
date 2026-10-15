import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Aviso } from "./Aviso";
import { AvisoFusoNaoConfigurado } from "./AvisoFusoNaoConfigurado";
import { FeedbackAcao } from "./FeedbackAcao";
import { MensagemStatus } from "./MensagemStatus";

const html = (tom: "info" | "sucesso" | "atencao" | "erro") => renderToStaticMarkup(createElement(Aviso, { tom } as ComponentProps<typeof Aviso>, "Texto"));

describe("Aviso", () => {
  it("Aviso de erro tem role alert e borda inicial de 3 px", () => {
    const h = html("erro");
    expect(h).toContain('role="alert"');
    expect(h).toContain("border-s-[3px]");
    expect(h).toContain("rounded-md p-3 text-sm");
  });

  it.each([
    ["info", "bg-surface-muted"],
    ["sucesso", "bg-green-100 text-green-700 border-s-[3px] border-green-700"],
    ["atencao", "bg-amber-100 text-amber-800 border-s-[3px] border-amber-600"],
    ["erro", "bg-red-100 text-red-700 border-s-[3px] border-red-600"],
  ] as const)("tom %s: classes exatas", (tom, classes) => {
    expect(html(tom)).toContain(classes);
  });

  it("os tons que não são erro usam role status; info não tem borda", () => {
    for (const tom of ["info", "sucesso", "atencao"] as const) expect(html(tom)).toContain('role="status"');
    expect(html("info")).not.toContain("border-s-");
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
