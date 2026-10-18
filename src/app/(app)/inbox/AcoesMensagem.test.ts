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
}));
vi.mock("@/server/whatsapp/motor/acoes-mensagem", () => acoes);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Botao } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { criarGanchos, clicarBotao, elementos } from "@/test/tela-sem-dom";
import { AcoesMensagem, EditarMensagem, REACOES_RAPIDAS, ReagirMensagem, type PropsAcoesMensagem } from "./AcoesMensagem";

const esvaziar = () => new Promise((r) => setTimeout(r, 0));
const props = (p: Partial<PropsAcoesMensagem> & Pick<PropsAcoesMensagem, "acao">): PropsAcoesMensagem =>
  ({ mensagem: { id: "m1", corpo: "Olá" }, aoFechar: vi.fn(), aoMudar: vi.fn(), ...p });

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
  expect((AcoesMensagem(props({ acao: "editar" })) as { type: unknown }).type).toBe(EditarMensagem);
  expect((AcoesMensagem(props({ acao: "reagir" })) as { type: unknown }).type).toBe(ReagirMensagem);
});
