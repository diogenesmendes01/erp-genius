import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConfirmarAcao, type PropsConfirmarAcao } from "./ConfirmarAcao";
import { VARIANTES_BOTAO } from "./Botao";

// Marcação do ConfirmarAcao (E1): alertdialog nomeado pelo título e descrito pela consequência; botão
// seguro antes do destrutivo; destrutivo em `perigo`; conferência obrigatória desabilita a confirmação.
// A interação (clique, ocupado, erro, Escape) está em ConfirmarAcao.interacao.test.ts.

function html(extra: Partial<PropsConfirmarAcao<unknown>> = {}) {
  const props: PropsConfirmarAcao<unknown> = {
    titulo: "Cancelar a fatura FAT-0031?",
    confirmacao: "cancelamento da fatura",
    acao: vi.fn(async () => ({ ok: true as const })),
    idempotente: false,
    aoConcluir: vi.fn(),
    aoCancelar: vi.fn(),
    children: createElement("p", null, "As 14 cobranças da fatura deixam de valer. Não há desfazer."),
    ...extra,
  };
  return renderToStaticMarkup(createElement(ConfirmarAcao<unknown>, props));
}

const botoes = (h: string) => [...h.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ atributos: m[1], texto: m[2] }));

describe("ConfirmarAcao — marcação", () => {
  it("é um alertdialog modal, nomeado pelo título e descrito pela consequência", () => {
    const h = html();
    const caixa = h.match(/<div[^>]*role="alertdialog"[^>]*>/)?.[0];
    expect(caixa, "alertdialog").toBeDefined();
    expect(caixa).toContain('aria-modal="true"');
    const titulo = caixa!.match(/aria-labelledby="([^"]+)"/)![1];
    const descricao = caixa!.match(/aria-describedby="([^"]+)"/)![1];
    expect(h).toContain(`<h3 id="${titulo}" class="mb-3 text-sm font-medium">Cancelar a fatura FAT-0031?</h3>`);
    expect(h).toMatch(new RegExp(`<div id="${descricao.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*><p>As 14 cobranças da fatura deixam de valer. Não há desfazer.</p></div>`));
    expect(h).not.toContain('role="dialog"');
  });

  it("botão seguro antes do destrutivo; o destrutivo é perigo e nomeia a ação", () => {
    const [voltar, confirmar, ...resto] = botoes(html());
    expect(resto).toEqual([]);
    expect(voltar.texto).toBe("Voltar");
    expect(voltar.atributos).toContain('type="button"');
    expect(voltar.atributos).toContain(VARIANTES_BOTAO.secundario);
    expect(confirmar.texto.replace(/<!-- -->/g, "")).toBe("Confirmar cancelamento da fatura");
    expect(confirmar.atributos).toContain('type="button"');
    expect(confirmar.atributos).toContain(VARIANTES_BOTAO.perigo);
    expect(confirmar.atributos).not.toContain("disabled");
  });

  it("sem conferência não há caixa de marcar; com ela, a caixa vem desmarcada e a confirmação desabilitada", () => {
    expect(html()).not.toContain('type="checkbox"');
    const h = html({ conferencia: "Confirmo os valores acima." });
    expect(h).toMatch(/<label[^>]*><input type="checkbox"[^>]*\/><span>Confirmo os valores acima\.<\/span><\/label>/);
    expect(h).not.toMatch(/type="checkbox"[^>]*checked/);
    const [voltar, confirmar] = botoes(h);
    expect(voltar.atributos).not.toContain("disabled");
    expect(confirmar.atributos).toContain('disabled=""');
  });

  it("nada de erro antes de confirmar (o FeedbackAcao só aparece com mensagem)", () => {
    expect(html()).not.toContain('role="alert"');
  });
});
