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
    expect(html).toContain("40% da meta");
    expect(html).toContain("font-mono");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("bg-brand-solid");
    expect(html).toContain("bg-surface-muted");
    expect(html).toContain("min-h-[52px]");
    expect(html).toContain("min-w-0 rounded-lg border border-gray-200 bg-surface p-4");
    expect(html).toContain("flex min-h-[52px] min-w-0 items-center justify-between gap-2.5");
    expect(html).toContain('aria-label="Próximas ações" class="grid gap-6 lg:grid-cols-3"');
    expect(html).toContain("max-w-[140px] truncate");
    expect(html).toContain('<span class="truncate">Experimental hoje</span>');
    expect(html).toContain("hover:bg-surface-muted");
    expect(html).toContain("rounded-[6px]");
    expect(html).toContain("bg-brand-bg");
    expect(html).toContain("Aguardando retorno");
    expect(html).toContain("atrasada");
    expect(html).toContain("Experimental hoje");
    expect(html).toContain("Ver extrato completo →");
    expect(html).toContain("Ver inbox →");
    expect(html).toContain("Ver todas as tarefas →");
    expect(html).toContain("Ver funil →");
    expect(html).toContain('style="width:40%"');
    expect(html).not.toContain("border-gray-300");
    expect(html).not.toContain("bg-green-100");
    expect(html).not.toContain("bg-red-100");
    expect(html).not.toContain("bg-amber-100");
    expect(html).not.toContain("bg-yellow-100");
  });

  it("meta_atingida_quando_nao_falta_nada", () => {
    const html = renderToStaticMarkup(createElement(HomeVendedor, {
      nome: "Vera Souza",
      dados: { ...dados, metaMes: [{ metrica: "MATRICULAS", meta: 10, realizado: 10, faltam: 0, pct: 1, moeda: null }] },
    }));
    expect(html).toContain("10 de 10");
    expect(html).toContain("meta atingida");
    expect(html).toContain("100% da meta");
    expect(html).not.toContain("faltam 0");
  });

  it("estados_vazios_compactos_sem_borda_pesada", () => {
    const html = renderToStaticMarkup(createElement(HomeVendedor, {
      nome: "Vera Souza",
      dados: {
        ...dados,
        metaMes: [],
        comissoesConfirmadas: [],
        comissoesPendentesLiquidacao: [],
        comissoesPipelineAberto: [],
        retornos: { total: 0, itens: [] },
        tarefas: { total: 0, itens: [] },
        oportunidadesPrioritarias: [],
      },
    }));
    expect(html).toContain("Nenhuma meta pessoal neste mês.");
    expect(html).toContain("Nenhuma comissão confirmada neste mês.");
    expect(html).toContain("Nenhuma comissão aguardando pagamento da taxa.");
    expect(html).toContain("Nenhuma comissão prevista no pipeline.");
    expect(html).toContain("Nenhuma conversa aguardando a sua resposta.");
    expect(html).toContain("Nada para hoje.");
    expect(html).toContain("Nenhuma oportunidade pedindo ação agora.");
    expect(html).toContain("rounded-item bg-surface-muted");
    expect(html).not.toContain("border-gray-300");
    expect(html).not.toContain("bg-green-100");
    expect(html).not.toContain("bg-red-100");
    expect(html).not.toContain("bg-amber-100");
  });
});
