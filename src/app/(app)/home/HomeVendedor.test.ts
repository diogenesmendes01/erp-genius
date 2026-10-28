import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { HomeVendedor } from "./HomeVendedor";
import type { dadosHomeVendedor } from "@/server/home/consultas";

type Dados = Awaited<ReturnType<typeof dadosHomeVendedor>>;

const dados: Dados = {
  competencia: "2026-10",
  diasRestantesMes: 16,
  metaMes: [{ metrica: "MATRICULAS", meta: 10, realizado: 4, faltam: 6, pct: 0.4, moeda: null }],
  comissoesConfirmadas: [{ moeda: "CRC", valor: 40, status: "APROVADA" }],
  comissoesPendentesLiquidacao: [{ moeda: "CRC", valor: 15 }],
  comissoesPipelineAberto: [{ moeda: "CRC", valor: 25 }],
  retornos: { total: 1, itens: [{ id: "a1", nome: "Ana", href: "/inbox?c=a1" }] },
  tarefas: { total: 1, itens: [{ id: "t1", titulo: "Ligar", atrasada: true, href: "/tarefas?t=t1" }] },
  oportunidadesPrioritarias: [{ id: "o1", nome: "Aula de hoje", motivo: "Experimental hoje", href: "/funil?o=o1" }],
};

describe("HomeVendedor", () => {
  it("separa_meta_comissoes_e_proximas_acoes_sem_ranking", () => {
    const html = renderToStaticMarkup(createElement(HomeVendedor, { nome: "Vera Souza", dados }));
    expect(html).toContain("Olá, Vera");
    expect(html).toContain("Faltam 16 dias neste mês.");
    expect(html).toContain("4 de 10");
    expect(html).toContain("faltam 6");
    expect(html).toContain("Confirmadas no mês");
    expect(html).toContain("aguardando a taxa");
    expect(html).toContain("pipeline aberto");
    expect(html).toContain('href="/comissoes"');
    expect(html).toContain('href="/inbox?c=a1"');
    expect(html).toContain('href="/tarefas?t=t1"');
    expect(html).toContain('href="/funil?o=o1"');
    expect(html).not.toMatch(/ranking/i);
    expect(html).not.toContain("refinar (P10)");
  });
});
