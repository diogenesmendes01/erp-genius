import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/whatsapp/acoes", () => ({ enviarTextoInbox: vi.fn(), enviarMidiaInbox: vi.fn() }));
vi.mock("@/server/whatsapp/acoes-conversa", () => ({ registrarNotaAtendimento: vi.fn() }));

import { InboxNovo, mesclarPrimeiraPagina, paramsDosFiltros } from "./InboxNovo";
import { lerFiltrosInbox, type FiltrosInbox } from "@/server/inbox/filtros";

const item = (id: string, nome: string) => ({
  id, numeroId: "n1", numeroRotulo: "Escola", finalidade: "COMERCIAL", driver: "META_CLOUD", contatoId: `c-${id}`, contatoNome: nome,
  contatoTelefone: "+506", optOut: false, vinculo: null, naoLidas: 2, ultimaMensagemEm: "2026-10-01T02:30:00.000Z", preview: "Oi",
  linhaComercial: false, status: "EM_ATENDIMENTO", responsavelNome: null, prazoRespostaEm: null, fixada: false, silenciada: false, grupo: false,
});

function html(p: { selecionado?: string | null } = {}) {
  return renderToStaticMarkup(createElement(InboxNovo, {
    inicial: { itens: [item("a1", "Ana"), item("a2", "Beto")], proximo: null }, filtros: {},
    selecionado: p.selecionado ?? null, usuario: { id: "u1", papeis: ["VENDEDOR"] }, fuso: null,
  } as never));
}

describe("InboxNovo", () => {
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
