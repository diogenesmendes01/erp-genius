import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const navegar = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: navegar, push: navegar, refresh: vi.fn() }), usePathname: () => "/inbox" }));

import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { Setor } from "@/server/whatsapp/setor";
import { ListaAtendimentos } from "./ListaAtendimentos";
import { PainelFiltros, paramsDaUrl } from "./PainelFiltros";

const passado = new Date(Date.now() - 3_600_000).toISOString();
const base: ItemListaInbox = {
  id: "a1", numeroId: "n1", numeroRotulo: "Cobrança", finalidade: "FINANCEIRO", driver: "SIMULADO",
  contatoId: "c1", contatoNome: "Maria Souza", contatoTelefone: "+5511999990000", optOut: false, vinculo: null,
  naoLidas: 0, ultimaMensagemEm: "2026-10-01T12:00:00.000Z", preview: "Oi", linhaComercial: false,
  status: "EM_ATENDIMENTO", responsavelNome: null, prazoRespostaEm: null, fixada: false, silenciada: false, grupo: false,
  responsavelId: null, numeroDonoId: null, setoresDoNumero: ["FINANCEIRO"], atendimentoOrigemId: null, capacidades: [],
};
const html = (p: Partial<ItemListaInbox> = {}, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(ListaAtendimentos, {
    itens: [{ ...base, ...p }], proximo: null, selecionado: null, aoSelecionar: vi.fn(), aoCarregarMais: vi.fn(), ...extra,
  } as never));
const htmlFiltros = (o: { setores: Setor[]; filtros?: object }) =>
  renderToStaticMarkup(createElement(PainelFiltros, { filtros: o.filtros ?? {}, setores: o.setores, numeros: [{ id: "n1", rotulo: "Cobrança" }] } as never));

describe("ListaAtendimentos", () => {
  it("item mostra setor, número, status, responsável e prazo estourado", () => {
    const h = html({ finalidade: "FINANCEIRO", numeroRotulo: "Cobrança", status: "ABERTO_SEM_RESPONSAVEL", prazoRespostaEm: passado });
    expect(h).toContain("Financeiro"); expect(h).toContain("Cobrança"); expect(h).toContain("Na fila"); expect(h).toContain("Prazo estourado");
    expect(html({ responsavelNome: "Ana Lima" })).toContain("Ana Lima");
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
  it("lista vazia mostra estado vazio", () => {
    expect(renderToStaticMarkup(createElement(ListaAtendimentos, { itens: [], proximo: null, selecionado: null, aoSelecionar: vi.fn(), aoCarregarMais: vi.fn() } as never))).toContain("Nenhuma conversa");
  });
});

describe("PainelFiltros", () => {
  it("filtro de setor só oferece os setores do usuário", () => {
    const h = htmlFiltros({ setores: ["FINANCEIRO"] });
    expect(h).toContain("Financeiro"); expect(h).not.toContain("Comercial");
  });
  it("abas rápidas e número", () => {
    const h = htmlFiltros({ setores: ["FINANCEIRO"], filtros: { responsavel: "eu" } });
    for (const t of ["Todas", "Minhas", "Fila", "Não lidas", "Prazo estourado"]) expect(h).toContain(t);
    expect(h).toContain("Cobrança");
  });
  it("paramsDaUrl escreve setor, numero, resp, status, naoLidas, prazo e busca", () => {
    const q = paramsDaUrl({ setor: "FINANCEIRO", numeroId: "n1", responsavel: "eu", status: "EM_ATENDIMENTO", naoLidas: true, prazoEstourado: true, busca: "ana" });
    expect(Object.fromEntries(q)).toEqual({ setor: "FINANCEIRO", numero: "n1", resp: "eu", status: "EM_ATENDIMENTO", naoLidas: "1", prazo: "estourado", busca: "ana" });
    expect(paramsDaUrl({}).toString()).toBe("");
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
