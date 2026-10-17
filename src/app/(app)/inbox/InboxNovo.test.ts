import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/whatsapp/acoes", () => ({ enviarTextoInbox: vi.fn(), enviarMidiaInbox: vi.fn() }));
vi.mock("@/server/whatsapp/acoes-conversa", () => ({ registrarNotaAtendimento: vi.fn() }));

import { InboxNovo } from "./InboxNovo";

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
