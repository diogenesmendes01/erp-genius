import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EtapaLead, Temperatura } from "@prisma/client";
import type { Active, Over } from "@dnd-kit/core";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/comercial/acoes", () => ({ moverEtapa: vi.fn(), marcarPerdido: vi.fn() }));

import { INSTRUCOES_KANBAN, KanbanBoard, anunciosKanban, colunaVizinha, type KanbanLead } from "./KanbanBoard";

const agora = Date.parse("2026-09-24T12:00:00.000Z");

function lead(id: string, nome: string, etapa: EtapaLead): KanbanLead {
  return {
    id, codigo: null, nome, etapa, temperatura: Temperatura.QUENTE, b2b: false, pais: null, proximaAcao: null,
    valorPrevisto: null, ultimaAcaoEm: "2026-09-24T11:00:00.000Z", etapaDesde: "2026-09-24T11:30:00.000Z",
  };
}

const ana = lead("l1", "Ana Silva", EtapaLead.NOVO);
const bruno = lead("l2", "Bruno Costa", EtapaLead.QUALIFICADO);

function seletorDe(html: string, nome: string): string {
  const m = html.match(new RegExp(`<select aria-label="Mover ${nome} para outra etapa"[^>]*>(.*?)</select>`));
  expect(m, `seletor de ${nome}`).not.toBeNull();
  return m![1];
}

describe("KanbanBoard — alternativa sem arraste", () => {
  const html = renderToStaticMarkup(createElement(KanbanBoard, { leads: [ana, bruno], referenciaTemporal: agora }));

  it("cada card tem o seletor 'Mover para…' com o nome do lead, sem a própria etapa como destino", () => {
    const deAna = seletorDe(html, "Ana Silva");
    expect(deAna).toContain("Mover para…");
    expect(deAna).not.toContain(`value="${EtapaLead.NOVO}"`);
    expect(deAna).toContain(`value="${EtapaLead.QUALIFICADO}"`);
    expect(deAna).toContain(`value="${EtapaLead.PERDIDO}"`);

    const deBruno = seletorDe(html, "Bruno Costa");
    expect(deBruno).not.toContain(`value="${EtapaLead.QUALIFICADO}"`);
    expect(deBruno).toContain(`value="${EtapaLead.NOVO}"`);
  });

  it("a alça de arraste não rola a página no toque", () => {
    expect(html).toMatch(/<button[^>]*class="[^"]*touch-none[^"]*"[^>]*>⠿ arrastar<\/button>/);
  });
});

describe("KanbanBoard — leitor de tela", () => {
  const porId = new Map([[ana.id, ana], [bruno.id, bruno]]);
  const anuncios = anunciosKanban((id) => porId.get(String(id)));
  const active = (id: string) => ({ id }) as unknown as Active;
  const over = (id: EtapaLead) => ({ id }) as unknown as Over;

  it("instruções em pt-BR com as teclas que funcionam", () => {
    expect(INSTRUCOES_KANBAN.draggable).toContain("Espaço ou Enter");
    expect(INSTRUCOES_KANBAN.draggable).toContain("setas");
    expect(INSTRUCOES_KANBAN.draggable).toContain("Esc para cancelar");
  });

  it("anuncia pegar, passar, soltar e cancelar com o nome do lead e o rótulo da etapa", () => {
    expect(anuncios.onDragStart({ active: active("l1") })).toBe("Lead Ana Silva pego na etapa Novo.");
    expect(anuncios.onDragOver({ active: active("l1"), over: over(EtapaLead.QUALIFICADO) })).toBe("Lead Ana Silva sobre a etapa Qualificado.");
    expect(anuncios.onDragOver({ active: active("l1"), over: null })).toBe("Lead Ana Silva fora de uma etapa.");
    expect(anuncios.onDragCancel({ active: active("l1"), over: null })).toBe("Movimentação cancelada; Ana Silva continua em Novo.");
  });

  it("o soltar segue o mesmo fluxo da tela: perda, matrícula, transição recusada, sem mudança", () => {
    expect(anuncios.onDragEnd({ active: active("l1"), over: over(EtapaLead.PERDIDO) })).toBe("Lead Ana Silva solto em Perdido; informe o motivo da perda.");
    expect(anuncios.onDragEnd({ active: active("l1"), over: over(EtapaLead.MATRICULADO) })).toBe("Lead Ana Silva solto em Matriculado; abrindo a matrícula.");
    expect(anuncios.onDragEnd({ active: active("l1"), over: over(EtapaLead.PROPOSTA) }))
      .toBe("Lead Ana Silva não pode ir de Novo para Proposta; continua em Novo.");
    expect(anuncios.onDragEnd({ active: active("l1"), over: over(EtapaLead.NOVO) })).toBe("Lead Ana Silva solto sem mudar de etapa; continua em Novo.");
    expect(anuncios.onDragEnd({ active: active("l1"), over: null })).toBe("Lead Ana Silva solto sem mudar de etapa; continua em Novo.");
  });

  it("transição manual permitida é anunciada como movida", () => {
    const destino = anuncios.onDragEnd({ active: active("l1"), over: over(EtapaLead.EM_ATENDIMENTO) });
    expect(destino).toBe("Lead Ana Silva movido para 1º Contato.");
  });
});

describe("colunaVizinha (setas do teclado)", () => {
  const col = (left: number) => ({ left, right: left + 256, width: 256, top: 100, bottom: 400, height: 300 });
  const colunas = [col(0), col(268), col(536)];
  const card = { left: 290, right: 490, width: 200, top: 250, bottom: 330, height: 80 };

  it("seta para a direita/esquerda leva o card ao topo da coluna vizinha", () => {
    expect(colunaVizinha(colunas, card, 1)).toEqual({ x: 536 + 28, y: 100 });
    expect(colunaVizinha(colunas, card, -1)).toEqual({ x: 28, y: 100 });
  });

  it("não sai do quadro nas pontas", () => {
    expect(colunaVizinha(colunas, { ...card, left: 560, right: 760 }, 1)).toBeNull();
    expect(colunaVizinha([], card, 1)).toBeNull();
  });
});
