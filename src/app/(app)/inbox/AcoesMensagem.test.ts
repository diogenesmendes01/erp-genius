import type { ReactNode } from "react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

// C4 da R1 do #219: reagir, editar e apagar do menu da mensagem chamam as actions do motor (Fase 4D).
const m = vi.hoisted(() => ({ g: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => (m.g ? m.g.useState(i) : real.useState(i as never))) as unknown as typeof real.useState,
    useRef: ((i: unknown) => (m.g ? m.g.useRef(i) : real.useRef(i as never))) as unknown as typeof real.useRef,
    useId: (() => (m.g ? m.g.useId() : real.useId())) as typeof real.useId,
    useCallback: ((f: unknown, d?: unknown[]) => (m.g ? m.g.useCallback(f) : real.useCallback(f as never, d as never))) as unknown as typeof real.useCallback,
    useEffect: ((f: () => void, d?: unknown[]) => (m.g ? undefined : real.useEffect(f, d))) as unknown as typeof real.useEffect,
  };
});
const acoes = vi.hoisted(() => ({
  editarMensagemWhatsApp: vi.fn(async () => ({ ok: true as const })),
  apagarMensagemWhatsApp: vi.fn(async () => ({ ok: true as const })),
  reagirMensagemWhatsApp: vi.fn(async () => ({ ok: true as const })),
  encaminharMensagemWhatsApp: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/server/whatsapp/motor/acoes-mensagem", () => acoes);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Botao } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { criarGanchos, clicarBotao, elementos } from "@/test/tela-sem-dom";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Modal } from "@/components/Modal";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { AcoesMensagem, ERRO_LISTA_DESTINOS, EditarMensagem, EncaminharMensagem, REACOES_RAPIDAS, ReagirMensagem, buscarDestinosEncaminhar, type PropsAcoesMensagem } from "./AcoesMensagem";

const esvaziar = () => new Promise((r) => setTimeout(r, 0));
const props = (p: Partial<PropsAcoesMensagem> & Pick<PropsAcoesMensagem, "acao">): PropsAcoesMensagem =>
  ({ mensagem: { id: "m1", corpo: "Olá" }, origem: { atendimentoId: "a1", numeroId: "n1" }, aoFechar: vi.fn(), aoMudar: vi.fn(), ...p });

describe("AcoesMensagem", () => {
  it("apagar: a action só roda dentro do ConfirmarAcao e, ao concluir, fecha e recarrega", async () => {
    m.g = null;
    const p = props({ acao: "apagar" });
    const raiz = AcoesMensagem(p) as ReactNode;
    const confirmar = elementos(raiz).find((n) => n.type === ConfirmarAcao)!;
    expect(confirmar.props.titulo).toBe("Apagar esta mensagem para todos?");
    expect(acoes.apagarMensagemWhatsApp).not.toHaveBeenCalled();
    await (confirmar.props.acao as () => Promise<unknown>)();
    expect(acoes.apagarMensagemWhatsApp).toHaveBeenCalledWith({ mensagemId: "m1" });
    (confirmar.props.aoConcluir as () => void)();
    expect(p.aoFechar).toHaveBeenCalled();
    expect(p.aoMudar).toHaveBeenCalled();
  });

  it("editar: o texto novo sai por editarMensagemWhatsApp e a conversa recarrega", async () => {
    m.g = criarGanchos();
    const p = props({ acao: "editar" });
    const tela = () => m.g!.renderizar(EditarMensagem, p);
    const area = elementos(tela()).find((n) => n.type === CampoTexto)!;
    expect(area.props.value).toBe("Olá");
    (area.props.onChange as (e: unknown) => void)({ target: { value: "Olá, tudo bem?" } });
    clicarBotao(tela(), "Salvar edição");
    await esvaziar();
    expect(acoes.editarMensagemWhatsApp).toHaveBeenCalledWith({ mensagemId: "m1", texto: "Olá, tudo bem?" });
    expect(p.aoMudar).toHaveBeenCalled();
    expect(p.aoFechar).toHaveBeenCalled();
  });

  it("editar: sem mudança no texto o salvar fica desabilitado", () => {
    m.g = criarGanchos();
    const tela = m.g.renderizar(EditarMensagem, props({ acao: "editar" }));
    const salvar = elementos(tela).find((n) => n.type === Botao && n.props.children === "Salvar edição")!;
    expect(salvar.props.disabled).toBe(true);
  });

  it("editar: a recusa do servidor (janela de 15 min) aparece e o diálogo fica aberto", async () => {
    acoes.editarMensagemWhatsApp.mockResolvedValueOnce({ ok: false, erro: "Só é possível editar até 15 minutos após o envio." } as never);
    m.g = criarGanchos();
    const p = props({ acao: "editar" });
    const tela = () => m.g!.renderizar(EditarMensagem, p);
    (elementos(tela()).find((n) => n.type === CampoTexto)!.props.onChange as (e: unknown) => void)({ target: { value: "Outro" } });
    clicarBotao(tela(), "Salvar edição");
    await esvaziar();
    expect(p.aoFechar).not.toHaveBeenCalled();
    const { renderToStaticMarkup } = await import("react-dom/server");
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain("Só é possível editar até 15 minutos após o envio.");
  });

  it("reagir: cada reação rápida chama reagirMensagemWhatsApp; remover manda emoji vazio", async () => {
    m.g = criarGanchos();
    const p = props({ acao: "reagir" });
    const tela = () => m.g!.renderizar(ReagirMensagem, p);
    for (const e of REACOES_RAPIDAS) expect(elementos(tela()).some((n) => n.type === Botao && n.props["aria-label"] === `Reagir com ${e}`)).toBe(true);
    clicarBotao(tela(), "👍");
    await esvaziar();
    expect(acoes.reagirMensagemWhatsApp).toHaveBeenCalledWith({ mensagemId: "m1", emoji: "👍" });
    clicarBotao(tela(), "Remover minha reação");
    await esvaziar();
    expect(acoes.reagirMensagemWhatsApp).toHaveBeenLastCalledWith({ mensagemId: "m1", emoji: "" });
  });
});

it("AcoesMensagem escolhe o diálogo pelo comando", () => {
  m.g = null;
  expect((AcoesMensagem(props({ acao: "encaminhar" })) as { type: unknown }).type).toBe(EncaminharMensagem);
  expect((AcoesMensagem(props({ acao: "editar" })) as { type: unknown }).type).toBe(EditarMensagem);
  expect((AcoesMensagem(props({ acao: "reagir" })) as { type: unknown }).type).toBe(ReagirMensagem);
});

describe("EncaminharMensagem (destino entre as conversas do mesmo número com envio)", () => {
  const destino = (o: Partial<ItemListaInbox>) => ({ id: "x", contatoNome: "X", grupo: false, optOut: false, finalidade: "COMERCIAL", numeroRotulo: "Comercial", ...o }) as ItemListaInbox;
  const lista = [
    destino({ id: "a1", contatoNome: "Origem" }),
    destino({ id: "a2", contatoNome: "Bia" }),
    destino({ id: "a3", contatoNome: "Grupo da turma", grupo: true }),
    destino({ id: "a4", contatoNome: "Saiu", optOut: true }),
    destino({ id: "a5", contatoNome: "Caio", finalidade: "FINANCEIRO" }),
  ];
  const resposta = (itens: ItemListaInbox[], ok = true) => vi.fn(async (...args: [string, unknown?]) => { void args; return { ok, json: async () => ({ itens, proximo: null }) }; });

  it("busca na lista do Inbox novo só o mesmo número e com envio (envio=1), sem a origem, grupos e opt-out", async () => {
    const f = resposta(lista);
    vi.stubGlobal("fetch", f);
    const r = await buscarDestinosEncaminhar({ atendimentoId: "a1", numeroId: "n1" }, " Bia ");
    expect(f).toHaveBeenCalledWith("/api/inbox/atendimentos?numeroId=n1&envio=1&busca=Bia", { cache: "no-store", credentials: "same-origin" });
    expect(r!.itens.map((i) => i.id)).toEqual(["a2", "a5"]);
    expect(r!.proximo).toBeNull();
    await buscarDestinosEncaminhar({ atendimentoId: "a1", numeroId: "n1" }, "");
    expect(f).toHaveBeenLastCalledWith("/api/inbox/atendimentos?numeroId=n1&envio=1", { cache: "no-store", credentials: "same-origin" });
    vi.stubGlobal("fetch", resposta([], false));
    expect(await buscarDestinosEncaminhar({ atendimentoId: "a1", numeroId: "n1" }, "")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("C2 da revisão do #223: segue o cursor `proximo` da lista, mantendo a busca", async () => {
    const f = vi.fn(async (...args: [string, unknown?]) => { void args; return { ok: true, json: async () => ({ itens: [lista[1]!], proximo: "cur2" }) }; });
    vi.stubGlobal("fetch", f);
    const r = await buscarDestinosEncaminhar({ atendimentoId: "a1", numeroId: "n1" }, "Bia", "cur1");
    expect(f).toHaveBeenCalledWith("/api/inbox/atendimentos?numeroId=n1&envio=1&busca=Bia&cursor=cur1", { cache: "no-store", credentials: "same-origin" });
    expect(r).toEqual({ itens: [lista[1]], proximo: "cur2" });
    vi.unstubAllGlobals();
  });

  it("C2 da revisão do #223: \"Carregar mais\" busca a próxima página da mesma busca e acrescenta os destinos", async () => {
    const paginas: Record<string, { itens: ItemListaInbox[]; proximo: string | null }> = {
      // Primeira página só com o que o cliente descarta (origem, grupo, opt-out): sem estado vazio enquanto há mais.
      "": { itens: [lista[0]!, lista[2]!, lista[3]!], proximo: "p2" },
      p2: { itens: [lista[1]!, lista[1]!], proximo: "p3" },
      p3: { itens: [lista[4]!, lista[1]!], proximo: null },
    };
    const f = vi.fn(async (url: string) => {
      const q = new URL(url, "http://x").searchParams;
      return { ok: true, json: async () => paginas[q.get("cursor") ?? ""]! };
    });
    vi.stubGlobal("fetch", f);
    m.g = criarGanchos();
    const tela = () => m.g!.renderizar(EncaminharMensagem, props({ acao: "encaminhar" }));
    (elementos(tela()).find((n) => n.type === "input")!.props.onChange as (e: unknown) => void)({ target: { value: "a" } });
    (elementos(tela()).find((n) => n.type === "form")!.props.onSubmit as (e: unknown) => void)({ preventDefault() {} });
    await esvaziar();
    const rotulos = () => elementos(tela()).filter((n) => n.type === Botao).map((n) => [n.props.children].flat().join(""));
    expect(elementos(tela()).some((n) => n.type === EstadoVazio)).toBe(false);
    expect(rotulos()).toContain("Carregar mais");
    // A busca digitada depois não muda a página seguinte: o cursor é da busca aplicada.
    (elementos(tela()).find((n) => n.type === "input")!.props.onChange as (e: unknown) => void)({ target: { value: "outra" } });
    clicarBotao(tela(), "Carregar mais");
    await esvaziar();
    expect(f).toHaveBeenLastCalledWith("/api/inbox/atendimentos?numeroId=n1&envio=1&busca=a&cursor=p2", { cache: "no-store", credentials: "same-origin" });
    expect(rotulos().filter((r) => r.startsWith("Encaminhar para"))).toEqual(["Encaminhar para Bia"]);
    clicarBotao(tela(), "Carregar mais");
    await esvaziar();
    expect(rotulos().filter((r) => r.startsWith("Encaminhar para"))).toEqual(["Encaminhar para Bia", "Encaminhar para Caio"]);
    expect(rotulos()).not.toContain("Carregar mais");
    vi.unstubAllGlobals();
  });

  it("C2 da revisão do #223: falha ao carregar mais mostra o erro e mantém a lista e o botão", async () => {
    let falhar = false;
    vi.stubGlobal("fetch", vi.fn(async () => (falhar ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => ({ itens: [lista[1]!], proximo: "p2" }) })));
    m.g = criarGanchos();
    const tela = () => m.g!.renderizar(EncaminharMensagem, props({ acao: "encaminhar" }));
    (elementos(tela()).find((n) => n.type === "form")!.props.onSubmit as (e: unknown) => void)({ preventDefault() {} });
    await esvaziar();
    falhar = true;
    clicarBotao(tela(), "Carregar mais");
    await esvaziar();
    const rotulos = elementos(tela()).filter((n) => n.type === Botao).map((n) => [n.props.children].flat().join(""));
    expect(rotulos).toContain("Encaminhar para Bia");
    expect(rotulos).toContain("Carregar mais");
    const { renderToStaticMarkup } = await import("react-dom/server");
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain(ERRO_LISTA_DESTINOS);
    vi.unstubAllGlobals();
  });

  it("escolher o destino abre o ConfirmarAcao; a action só roda nele e, ao concluir, fecha e recarrega", async () => {
    vi.stubGlobal("fetch", resposta(lista));
    m.g = criarGanchos();
    const p = props({ acao: "encaminhar" });
    const tela = () => m.g!.renderizar(EncaminharMensagem, p);
    expect(elementos(tela()).some((n) => n.type === Modal && n.props.titulo === "Encaminhar mensagem")).toBe(true);
    const busca = elementos(tela()).find((n) => n.type === "input")!;
    (busca.props.onChange as (e: unknown) => void)({ target: { value: "a" } });
    const form = elementos(tela()).find((n) => n.type === "form")!;
    (form.props.onSubmit as (e: unknown) => void)({ preventDefault() {} });
    await esvaziar();
    const rotulos = elementos(tela()).filter((n) => n.type === Botao).map((n) => [n.props.children].flat().join(""));
    expect(rotulos).toContain("Encaminhar para Bia");
    expect(rotulos).toContain("Encaminhar para Caio");
    expect(rotulos.some((r) => /Origem|Grupo da turma|Saiu/.test(r))).toBe(false);
    clicarBotao(tela(), "Encaminhar para Bia");
    const confirmar = elementos(tela()).find((n) => n.type === ConfirmarAcao)!;
    expect(confirmar.props.titulo).toBe("Encaminhar esta mensagem para Bia?");
    expect(acoes.encaminharMensagemWhatsApp).not.toHaveBeenCalled();
    await (confirmar.props.acao as () => Promise<unknown>)();
    expect(acoes.encaminharMensagemWhatsApp).toHaveBeenCalledWith({ mensagemId: "m1", atendimentoDestinoId: "a2" });
    (confirmar.props.aoConcluir as () => void)();
    expect(p.aoFechar).toHaveBeenCalled();
    expect(p.aoMudar).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("cancelar a confirmação volta para a lista, sem encaminhar", async () => {
    acoes.encaminharMensagemWhatsApp.mockClear();
    vi.stubGlobal("fetch", resposta(lista));
    m.g = criarGanchos();
    const p = props({ acao: "encaminhar" });
    const tela = () => m.g!.renderizar(EncaminharMensagem, p);
    (elementos(tela()).find((n) => n.type === "form")!.props.onSubmit as (e: unknown) => void)({ preventDefault() {} });
    await esvaziar();
    clicarBotao(tela(), "Encaminhar para Caio");
    (elementos(tela()).find((n) => n.type === ConfirmarAcao)!.props.aoCancelar as () => void)();
    expect(elementos(tela()).some((n) => n.type === ConfirmarAcao)).toBe(false);
    expect(elementos(tela()).some((n) => n.type === Botao && [n.props.children].flat().join("") === "Encaminhar para Caio")).toBe(true);
    expect(acoes.encaminharMensagemWhatsApp).not.toHaveBeenCalled();
    expect(p.aoFechar).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("sem destino: estado vazio; falha da lista: erro na tela", async () => {
    vi.stubGlobal("fetch", resposta([lista[0]!]));
    m.g = criarGanchos();
    const p = props({ acao: "encaminhar" });
    const tela = () => m.g!.renderizar(EncaminharMensagem, p);
    (elementos(tela()).find((n) => n.type === "form")!.props.onSubmit as (e: unknown) => void)({ preventDefault() {} });
    await esvaziar();
    expect(elementos(tela()).some((n) => n.type === EstadoVazio)).toBe(true);
    vi.stubGlobal("fetch", resposta([], false));
    (elementos(tela()).find((n) => n.type === "form")!.props.onSubmit as (e: unknown) => void)({ preventDefault() {} });
    await esvaziar();
    const { renderToStaticMarkup } = await import("react-dom/server");
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain("Não foi possível carregar as conversas. Tente de novo.");
    vi.unstubAllGlobals();
  });
});
