import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { ListaAtendimentos } from "./ListaAtendimentos";

const passado = new Date(Date.now() - 3_600_000).toISOString();
const base: ItemListaInbox = { estadoAria: null, atendidoPorVoce: false, previaAutor: null, previaRotulo: null,
  id: "a1", numeroId: "n1", numeroRotulo: "Cobrança", finalidade: "FINANCEIRO", driver: "SIMULADO",
  contatoId: "c1", contatoNome: "Maria Souza", contatoTelefone: "+5511999990000", optOut: false, vinculo: null,
  naoLidas: 0, ultimaMensagemEm: "2026-10-01T12:00:00.000Z", preview: "Oi", linhaComercial: false,
  status: "EM_ATENDIMENTO", responsavelNome: null, prazoRespostaEm: null, fixada: false, silenciada: false, grupo: false,
  responsavelId: null, numeroDonoId: null, setoresDoNumero: ["FINANCEIRO"], atendimentoOrigemId: null, capacidades: [],
};
const html = (p: Partial<ItemListaInbox> = {}, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(ListaAtendimentos, {
    itens: [{ ...base, ...p }], agoraInicial: Date.now(), proximo: null, selecionado: null, aoSelecionar: vi.fn(), aoCarregarMais: vi.fn(), ...extra,
  } as never));

describe("ListaAtendimentos", () => {
  it("item mostra setor, estado e prazo; número e telefone não aparecem", () => {
    const h = html({ finalidade: "FINANCEIRO", numeroRotulo: "Cobrança", status: "ABERTO_SEM_RESPONSAVEL", prazoRespostaEm: passado });
    expect(h).toContain("Financeiro"); expect(h).not.toContain("Cobrança"); expect(h).toContain("Na fila"); expect(h).toContain("Prazo estourado");
    expect(html({ responsavelNome: "Ana Lima", responsavelId: "u1" }, { usuarioId: "outra" })).toContain("Com Ana");
    expect(html({ responsavelId: "u1" }, { usuarioId: "u1" })).toContain("Com você");
  });
  it("prazo no futuro não é estourado; encerrado não é estourado", () => {
    const futuro = new Date(Date.now() + 3_600_000).toISOString();
    expect(html({ prazoRespostaEm: futuro })).not.toContain("Prazo estourado");
    expect(html({ status: "ENCERRADO", prazoRespostaEm: passado })).not.toContain("Prazo estourado");
  });
  it("pedagógico não mostra telefone (regra 5)", () => {
    expect(html({ finalidade: "PEDAGOGICO", contatoTelefone: "" })).not.toMatch(/\+\d{6,}/);
    expect(html({ finalidade: "PEDAGOGICO", contatoTelefone: "+5511999990000" })).not.toMatch(/\+\d{6,}/);
  });
  it("grupo aparece com ícone de grupo e sem status de atendimento", () => {
    const h = html({ grupo: true, status: "EM_ATENDIMENTO" });
    expect(h).toContain('data-testid="icone-grupo"');
    expect(h).not.toContain("Em atendimento");
  });
  it("não lidas, selecionado e Carregar mais", () => {
    expect(html({ naoLidas: 3 })).toContain(">3<");
    expect(html({}, { selecionado: "a1" })).toContain('aria-current="true"');
    expect(html({}, { proximo: "cur" })).toContain("Carregar mais");
    expect(html()).not.toContain("Carregar mais");
  });
  it("contador de não lidas usa o fundo sólido da marca", () => {
    expect(html({ naoLidas: 3 })).toMatch(/<span class="[^"]*bg-brand-solid[^"]*text-on-brand[^"]*">3<\/span>/);
  });
  it("lista vazia mostra estado vazio", () => {
    expect(renderToStaticMarkup(createElement(ListaAtendimentos, { itens: [], proximo: null, selecionado: null, aoSelecionar: vi.fn(), aoCarregarMais: vi.fn() } as never))).toContain("Nenhuma conversa");
  });
});

// Fuso pessoal nas telas (pendência da Q176): a hora da última mensagem sai no fuso de exibição recebido da página
// (o pessoal; sem ele, o da escola) — o mesmo resultado com o processo em UTC ou em America/Sao_Paulo.
describe("ListaAtendimentos: hora no fuso de exibição", () => {
  it("02:30Z é 23:30 em São Paulo e 20:30 em Costa Rica", () => {
    expect(html({ ultimaMensagemEm: "2026-10-21T02:30:00.000Z" }, { fuso: "America/Sao_Paulo" })).toContain(">23:30<");
    expect(html({ ultimaMensagemEm: "2026-10-21T02:30:00.000Z" }, { fuso: "America/Costa_Rica" })).toContain(">20:30<");
  });
});

it("preserva lista curta, entrada na virtualização acima de100 e carregar mais", () => {
  const render = (n: number) => renderToStaticMarkup(createElement(ListaAtendimentos, {
    itens: Array.from({ length: n }, (_, i) => ({ ...base, id: "item-" + i, contatoNome: "Contato " + i })),
    proximo: "proxima", selecionado: null, aoSelecionar() {}, aoCarregarMais() {},
  }));
  const curta = render(100), longa = render(101);
  expect(curta).not.toContain("data-virtual-count"); expect((curta.match(/aria-current=/g) ?? []).length).toBe(0);
  expect(curta).toContain("Contato 99");
  expect(longa).toContain('data-virtual-count="101"'); expect(longa).toContain("Carregar mais");
  expect((longa.match(/data-virtual-key=/g) ?? []).length).toBeLessThan(30);
  expect(html()).toContain("px-2 pb-3 pt-1");
});

it("snapshot SSR do relógio fica estável ao atravessar minuto antes da hidratação", () => {
  const instanteSSR = Date.UTC(2026, 9, 22, 12);
  const prazo = new Date(instanteSSR - 29 * 60_000).toISOString();
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(instanteSSR);
    const servidor = html({ prazoRespostaEm: prazo }, { agoraInicial: instanteSSR });
    vi.setSystemTime(instanteSSR + 60_000);
    const hidratacao = html({ prazoRespostaEm: prazo }, { agoraInicial: instanteSSR });
    expect(servidor).toContain("Prazo estourado · 29 min");
    expect(hidratacao).toBe(servidor);
  } finally { vi.useRealTimers(); }
});
