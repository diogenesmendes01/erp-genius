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
    // A tentativa da recuperação (tela do professor) fica fora do mapa de propósito (FORA_DA_TRILHA).
    expect(render({ href: "/academico/recuperacoes/tentativas/ct1x2y3", para: "Tentativa" })).toContain('aria-label="Voltar para Tentativa"');
    expect(render({ href: "/rota-desconhecida" })).toContain('aria-label="Voltar para página anterior"');
  });

  it("seção da matrícula entrou no mapa (C22 da #170): o nome vem dele, igual à aba", () => {
    expect(render({ href: "/matriculas/cm0xyz9/preparacao", para: "Proposta" })).toContain('aria-label="Voltar para Preparação"');
  });

  it("rotuloDoDestino: só quando o caminho É uma página do mapa (query ignorada)", () => {
    expect(rotuloDoDestino("/financeiro")).toBe("Financeiro");
    expect(rotuloDoDestino("/secretaria/reservas?tipo=particular")).toBe("Reservas");
    expect(rotuloDoDestino("/academico/recuperacoes/tentativas/ct1x2y3")).toBeNull(); // não pega o ancestral "Recuperações"
    expect(rotuloDoDestino("/")).toBeNull();
  });
});
