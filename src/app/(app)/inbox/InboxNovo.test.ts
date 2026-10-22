import { DriverWhatsApp } from "@prisma/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/whatsapp/acoes", () => ({ enviarTextoInbox: vi.fn(), enviarMidiaInbox: vi.fn(), registrarOptOutContato: vi.fn(), removerOptOutContato: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/inbox" }));
vi.mock("@/server/whatsapp/acoes-conversa", () => ({ registrarNotaAtendimento: vi.fn() }));

import { InboxNovo, mesclarPrimeiraPagina, paramsDosFiltros } from "./InboxNovo";
import { lerFiltrosInbox, type FiltrosInbox } from "@/server/inbox/filtros";

const item = (id: string, nome: string) => ({
  id, numeroId: "n1", numeroRotulo: "Escola", finalidade: "COMERCIAL", driver: DriverWhatsApp.META_CLOUD, contatoId: `c-${id}`, contatoNome: nome,
  contatoTelefone: "+506", optOut: false, vinculo: null, naoLidas: 2, ultimaMensagemEm: "2026-10-01T02:30:00.000Z", preview: "Oi",
  linhaComercial: false, status: "EM_ATENDIMENTO", responsavelNome: null, prazoRespostaEm: null, fixada: false, silenciada: false, grupo: false,
});

function html(p: { selecionado?: string | null; extra?: Record<string, unknown> } = {}) {
  return renderToStaticMarkup(createElement(InboxNovo, {
    inicial: { itens: [item("a1", "Ana"), item("a2", "Beto")], proximo: null }, filtros: {},
    selecionado: p.selecionado ?? null, usuario: { id: "u1", papeis: ["VENDEDOR"] }, fuso: null, ...p.extra,
  } as never));
}

describe("InboxNovo", () => {
  it("a caixa cresce no pai, pode encolher e não fixa altura pela viewport", () => {
    const h = html();
    const raiz = h.match(/<div data-vista="lista" data-conectado="[01]" class="([^"]*)"/)?.[1].split(" ") ?? [];
    expect(raiz).toEqual(expect.arrayContaining(["flex", "min-h-0", "flex-1"]));
    expect(raiz.some((c) => c.includes("100dvh") || c === "min-h-[420px]")).toBe(false);
  });
  it("sem conversa selecionada mostra estado vazio, não a primeira", () => {
    const h = html({ selecionado: null });
    expect(h).toContain("Escolha uma conversa");
    expect(h).toContain('data-vista="lista"');
  });
  it("celular: data-vista começa em lista; com ?c= começa em conversa", () => {
    expect(html({ selecionado: "a1" })).toContain('data-vista="conversa"');
    expect(html({ selecionado: "a1" })).not.toContain("Escolha uma conversa");
  });
  it("lista as conversas da página inicial", () => {
    const h = html();
    expect(h).toContain("Ana");
    expect(h).toContain("Beto");
  });
  it("a lista é a ListaAtendimentos: setor, número e status em cada linha", () => {
    const h = html();
    expect(h).toContain("Comercial"); expect(h).toContain("Escola"); expect(h).toContain("Em atendimento");
  });
  it("com as opções do servidor mostra o PainelFiltros (busca, abas e setores do usuário)", () => {
    const h = html({ extra: { opcoesFiltro: { setores: ["COMERCIAL"], numeros: [{ id: "n1", rotulo: "Escola" }] } } });
    expect(h).toContain('aria-label="Buscar conversas"');
    for (const t of ["Todas", "Minhas", "Fila", "Não lidas", "Prazo estourado", "Todos os setores"]) expect(h).toContain(t);
    expect(html()).not.toContain('aria-label="Buscar conversas"');
  });
  it("conversa aberta: o painel por setor carrega da rota e o opt-out do contato está no painel", () => {
    const h = html({ selecionado: "a1" });
    expect(h).toContain("Carregando detalhes");
    expect(h).toContain("Registrar opt-out");
  });
  it("triagem e revisão vazias não renderizam painel", () => {
    expect(html({ extra: { triagem: [], revisoes: [] } })).not.toContain("Triagem administrativa");
    expect(html({ selecionado: "a1", extra: { triagem: [], revisoes: [] } })).not.toContain("Envios que exigem revisão");
  });
});

describe("paramsDosFiltros", () => {
  it("é o inverso de lerFiltrosInbox", () => {
    const f: FiltrosInbox = { setor: "FINANCEIRO", numeroId: "n1", responsavel: "eu", status: "EM_ATENDIMENTO", naoLidas: true, prazoEstourado: true, busca: "ana" };
    const q = paramsDosFiltros(f);
    expect(q).toContain("prazo=estourado");
    expect(q).toContain("naoLidas=1");
    expect(lerFiltrosInbox(Object.fromEntries(new URLSearchParams(q)))).toEqual(f);
  });
  it("vazio não gera parâmetros; cursor entra por último", () => {
    expect(paramsDosFiltros({})).toBe("");
    expect(paramsDosFiltros({ setor: "FINANCEIRO" }, "cur")).toBe("setor=FINANCEIRO&cursor=cur");
  });
});

describe("mesclarPrimeiraPagina", () => {
  const it_ = (id: string, em: string | null, nome = id) => ({ ...item(id, nome), ultimaMensagemEm: em }) as never as ReturnType<typeof item>;
  const ids = (l: { id: string }[]) => l.map((i) => i.id);
  it("sem próxima página a primeira é a lista inteira: remove as que saíram do filtro", () => {
    const r = mesclarPrimeiraPagina([it_("a", "2026-10-03"), it_("b", "2026-10-02")] as never, [it_("a", "2026-10-03", "Novo")] as never, null);
    expect(ids(r)).toEqual(["a"]);
    expect((r[0] as { contatoNome: string }).contatoNome).toBe("Novo");
  });
  it("com próxima página: atualiza, insere novas no topo, remove as saídas mais recentes que o limite e mantém as antigas", () => {
    const atual = [it_("a", "2026-10-05"), it_("saiu", "2026-10-04"), it_("b", "2026-10-03"), it_("velha", "2026-10-01"), it_("semData", null)];
    const nova = [it_("nova", "2026-10-06"), it_("a", "2026-10-05", "Atual"), it_("b", "2026-10-03")];
    const r = mesclarPrimeiraPagina(atual as never, nova as never, "cur");
    expect(ids(r)).toEqual(["nova", "a", "b", "velha", "semData"]);
    expect((r[1] as { contatoNome: string }).contatoNome).toBe("Atual");
  });
  it("a conversa aberta fora do filtro nunca some da lista", () => {
    expect(ids(mesclarPrimeiraPagina([it_("a", "2026-10-03"), it_("aberta", "2026-10-04")] as never, [it_("a", "2026-10-03")] as never, null, "aberta"))).toEqual(["aberta", "a"]);
    expect(ids(mesclarPrimeiraPagina([it_("a", "2026-10-03"), it_("aberta", "2026-10-04")] as never, [it_("a", "2026-10-03")] as never, "cur", "aberta"))).toContain("aberta");
  });
});

it("contagens são opt-in só na primeira página dos parâmetros", () => {
  expect(paramsDosFiltros({ busca: "Ana" }, null, { contagens: true })).toBe("busca=Ana&contagens=1");
  expect(paramsDosFiltros({}, "cursor", { contagens: true })).toBe("cursor=cursor");
  expect(paramsDosFiltros({})).toBe("");
});

it("casca nova elimina moldura e mantém exatamente um painel do contato", () => {
  const h = html({ selecionado: "a1" });
  expect(h).not.toContain("rounded-item border");
  expect(h.match(/<aside[^>]*aria-label="Painel do contato"/g)).toHaveLength(1);
  expect(h).not.toContain('aria-label="Detalhes da conversa"');
  for (const c of ["min-[960px]:w-[300px]", "min-[1100px]:w-[372px]", "min-[960px]:w-[348px]"]) expect(h).toContain(c);
});
it("sem seleção não monta painel, com prop false não abre automaticamente", () => {
  expect(html()).not.toContain('<aside');
  expect(html({ selecionado: "a1", extra: { abrirPainelPadrao: false } })).not.toContain("min-[1400px]:flex");
});
