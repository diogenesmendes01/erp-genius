import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VoltarPara } from "./VoltarPara";
import { rotuloDoDestino } from "@/lib/trilha";

const render = (props: Parameters<typeof VoltarPara>[0]) => renderToStaticMarkup(createElement(VoltarPara, props));

describe("VoltarPara (E2)", () => {
  it("formato único: seta decorativa + nome do destino; nome acessível \"Voltar para …\"", () => {
    const html = render({ href: "/secretaria", para: "Matrículas" });
    expect(html).toContain('href="/secretaria"');
    expect(html).toContain('aria-label="Voltar para Secretaria"');
    expect(html).toContain('<span aria-hidden="true">←</span> Secretaria');
  });

  it("o nome vem do mapa da trilha quando o destino é página conhecida — mesmo destino, mesmo nome", () => {
    // Antes: "Voltar à Secretaria", "Voltar à secretaria", "Voltar a Secretaria", "Voltar às matrículas"…
    for (const para of ["Secretaria", "secretaria", "Matrículas"]) expect(render({ href: "/secretaria", para })).toContain("> Secretaria</a>");
    expect(render({ href: "/alunos/clx1a2b3c", para: "Ficha" })).toContain("> Ficha do aluno</a>");
  });

  it("destino fora do mapa usa `para`; sem nenhum, \"página anterior\"", () => {
    expect(render({ href: "/matriculas/cm0xyz9/preparacao", para: "Preparação" })).toContain('aria-label="Voltar para Preparação"');
    expect(render({ href: "/portal-aluno" })).toContain('aria-label="Voltar para página anterior"');
  });

  it("rotuloDoDestino: só quando o caminho É uma página do mapa (query ignorada)", () => {
    expect(rotuloDoDestino("/financeiro")).toBe("Financeiro");
    expect(rotuloDoDestino("/secretaria/reservas?tipo=particular")).toBe("Reservas");
    expect(rotuloDoDestino("/matriculas/cm0xyz9/preparacao")).toBeNull(); // não pega o ancestral "Matrícula"
    expect(rotuloDoDestino("/")).toBeNull();
  });
});
