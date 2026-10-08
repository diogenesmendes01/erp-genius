import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Interação do ConfirmarAcao, sem DOM (src/test/tela-sem-dom.ts): o componente é chamado como função,
// com useState/useCallback simulados (o executor do useAcaoCliente vive neles) e useRef/useId fixos.
// O Modal, o Botao e o FeedbackAcao não são chamados — as props deles são lidas e acionadas.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((v: unknown) => ({ current: v })) as unknown as typeof real.useRef,
    useId: (() => "descricao-confirmacao") as typeof real.useId,
  };
});

import { ConfirmarAcao, type PropsConfirmarAcao } from "./ConfirmarAcao";
import { Botao } from "./Botao";
import { Modal } from "./Modal";
import { FeedbackAcao } from "./FeedbackAcao";
import { criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";
import { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import type { Resultado } from "@/server/_shared/resultado";

type Dado = { baixadas: number };
let props: PropsConfirmarAcao<Dado>;
let acao: Mock<() => Promise<Resultado<Dado>>>;

const tela = (): ReactNode => m.ganchos!.renderizar(ConfirmarAcao<Dado>, props);
const esvaziar = () => new Promise((r) => setTimeout(r, 0));
const unico = (t: ReactNode, tipo: unknown): No => {
  const achados = elementos(t).filter((n) => n.type === tipo);
  if (achados.length !== 1) throw new Error(`esperava 1 elemento, achei ${achados.length}`);
  return achados[0];
};
const botoes = (t: ReactNode) => elementos(t).filter((n) => n.type === Botao);
const botaoPorTexto = (t: ReactNode, rotulo: string): No => {
  const achados = botoes(t).filter((b) => texto(b.props.children).trim() === rotulo);
  if (achados.length !== 1) throw new Error(`esperava 1 botão "${rotulo}", achei ${achados.length}`);
  return achados[0];
};
const clicar = (t: ReactNode, rotulo: string) => (botaoPorTexto(t, rotulo).props.onClick as () => unknown)();
const CONFIRMAR = "Confirmar pagamento da fatura";
/** O ref de um elemento (React 18: fora das props, em `element.ref`). */
const refDe = (n: No): unknown => (n as unknown as { ref?: unknown }).ref ?? n.props.ref;

beforeEach(() => {
  m.ganchos = criarGanchos();
  acao = vi.fn<() => Promise<Resultado<Dado>>>(async () => ({ ok: true, dado: { baixadas: 14 } }));
  props = {
    titulo: "Registrar o pagamento da fatura FAT-0031?",
    confirmacao: "pagamento da fatura",
    acao,
    idempotente: false,
    aoConcluir: vi.fn(),
    aoFalhar: vi.fn(),
    aoCancelar: vi.fn(),
    children: "As 14 cobranças da fatura serão baixadas.",
  };
});

describe("ConfirmarAcao \u2014 interação", () => {
  it("abrir não executa nada; Voltar cancela sem executar", () => {
    const t = tela();
    expect(acao).not.toHaveBeenCalled();
    clicar(t, "Voltar");
    expect(props.aoCancelar).toHaveBeenCalledTimes(1);
    expect(acao).not.toHaveBeenCalled();
    expect(props.aoConcluir).not.toHaveBeenCalled();
  });

  it("casco: alertdialog descrito pela consequência, foco inicial no botão seguro, Escape/fundo cancelam", () => {
    const t = tela();
    const modal = unico(t, Modal);
    expect(modal.props.papel).toBe("alertdialog");
    expect(modal.props.titulo).toBe("Registrar o pagamento da fatura FAT-0031?");
    expect(modal.props.descricaoId).toBe("descricao-confirmacao");
    const descricao = elementos(t).find((n) => n.props.id === "descricao-confirmacao");
    expect(texto(descricao)).toBe("As 14 cobranças da fatura serão baixadas.");
    // O foco inicial é o MESMO ref entregue ao botão "Voltar" — não o destrutivo.
    expect(modal.props.focoInicial).toBeDefined();
    expect(modal.props.focoInicial).toBe(refDe(botaoPorTexto(t, "Voltar")));
    expect(refDe(botaoPorTexto(t, CONFIRMAR))).toBeUndefined();
    expect(modal.props.bloquearFechamento).toBe(false);
    (modal.props.aoFechar as () => void)(); // Escape ou clique no fundo
    expect(props.aoCancelar).toHaveBeenCalledTimes(1);
    expect(acao).not.toHaveBeenCalled();
  });

  it("os botões: Voltar secundário primeiro, a confirmação em perigo nomeando a ação", () => {
    const [voltar, confirmar, ...resto] = botoes(tela());
    expect(resto).toEqual([]);
    expect(texto(voltar.props.children).trim()).toBe("Voltar");
    expect(voltar.props.variante).toBe("secundario");
    expect(texto(confirmar.props.children).trim()).toBe(CONFIRMAR);
    expect(confirmar.props.variante).toBe("perigo");
  });

  it("confirmar executa uma vez e, no sucesso, entrega o dado a quem abriu", async () => {
    const promessa = clicar(tela(), CONFIRMAR);
    expect(acao).toHaveBeenCalledTimes(1);
    await promessa;
    expect(props.aoConcluir).toHaveBeenCalledWith({ baixadas: 14 });
    expect(props.aoFalhar).not.toHaveBeenCalled();
    expect(props.aoCancelar).not.toHaveBeenCalled();
  });

  it("ocupado: botões travados, Escape/fundo bloqueados e o segundo clique não executa de novo", async () => {
    let liberar: (r: Resultado<Dado>) => void = () => {};
    acao.mockImplementationOnce(() => new Promise((r) => { liberar = r; }));
    const promessa = clicar(tela(), CONFIRMAR);
    const t = tela();
    const modal = unico(t, Modal);
    expect(modal.props.bloquearFechamento).toBe(true);
    const [voltar, confirmar] = botoes(t);
    expect(voltar.props.disabled).toBe(true);
    expect(confirmar.props.disabled).toBe(true);
    expect(texto(confirmar.props.children).trim()).toBe("Confirmando\u2026");
    (modal.props.aoFechar as () => void)();
    (voltar.props.onClick as () => void)();
    expect(props.aoCancelar).not.toHaveBeenCalled();
    await (confirmar.props.onClick as () => Promise<void>)();
    expect(acao).toHaveBeenCalledTimes(1);
    liberar({ ok: true, dado: { baixadas: 14 } });
    await promessa;
    expect(props.aoConcluir).toHaveBeenCalledTimes(1);
  });

  it("ocupado com conferência (R1 da #154, B4): a caixa trava e a confirmação anuncia aria-busy; fora do ocupado, não", async () => {
    props = { ...props, conferencia: "Confirmo os valores acima." };
    const caixaDe = (t: ReactNode): No => elementos(t).find((n: No) => n.type === "input")!;
    (caixaDe(tela()).props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } });
    let t = tela();
    expect(caixaDe(t).props.disabled).toBe(false);
    expect(botaoPorTexto(t, CONFIRMAR).props["aria-busy"]).toBeUndefined();

    let liberar: (r: Resultado<Dado>) => void = () => {};
    acao.mockImplementationOnce(() => new Promise((r: (v: Resultado<Dado>) => void) => { liberar = r; }));
    const promessa = clicar(t, CONFIRMAR);
    t = tela();
    expect(caixaDe(t).props.disabled).toBe(true);
    expect(caixaDe(t).props.checked).toBe(true);
    const [, confirmar] = botoes(t);
    expect(confirmar.props["aria-busy"]).toBe(true);
    liberar({ ok: false, erro: "Fatura já paga." });
    await promessa;
    t = tela();
    expect(caixaDe(t).props.disabled).toBe(false);
    expect(botaoPorTexto(t, CONFIRMAR).props["aria-busy"]).toBeUndefined();
  });

  it("erro de negócio: a mensagem fica DENTRO do diálogo, que continua aberto; nada é concluído", async () => {
    acao.mockResolvedValueOnce({ ok: false, erro: "Fatura já paga." });
    await clicar(tela(), CONFIRMAR);
    const t = tela();
    expect(unico(t, FeedbackAcao).props.erro).toBe("Fatura já paga.");
    expect(props.aoConcluir).not.toHaveBeenCalled();
    expect(props.aoFalhar).toHaveBeenCalledWith({ tipo: "erro", mensagem: "Fatura já paga." });
    expect(botaoPorTexto(t, CONFIRMAR).props.disabled).toBe(false);
  });

  it("falha de transporte: resultado incerto pela regra da action (sem chave manda conferir; com chave manda reenviar)", async () => {
    acao.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await clicar(tela(), CONFIRMAR);
    expect(unico(tela(), FeedbackAcao).props.erro).toBe(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    expect(props.aoFalhar).toHaveBeenCalledWith({ tipo: "incerto", mensagem: MSG_RESULTADO_INCERTO_SEM_CHAVE });

    m.ganchos!.reiniciar();
    props = { ...props, idempotente: true, aoFalhar: vi.fn() };
    acao.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await clicar(tela(), CONFIRMAR);
    expect(unico(tela(), FeedbackAcao).props.erro).toBe(MSG_RESULTADO_INCERTO);
    expect(props.aoFalhar).toHaveBeenCalledWith({ tipo: "incerto", mensagem: MSG_RESULTADO_INCERTO });
    expect(props.aoConcluir).not.toHaveBeenCalled();
  });

  it("conferência: sem marcar, a confirmação fica desabilitada e o clique não executa; marcada, executa", async () => {
    props = { ...props, conferencia: "Confirmo os valores acima." };
    let t = tela();
    expect(botaoPorTexto(t, CONFIRMAR).props.disabled).toBe(true);
    await clicar(t, CONFIRMAR);
    expect(acao).not.toHaveBeenCalled();
    const caixa = elementos(t).find((n) => n.type === "input");
    expect(caixa?.props.type).toBe("checkbox");
    expect(caixa?.props.checked).toBe(false);
    (caixa!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } });
    t = tela();
    expect(botaoPorTexto(t, CONFIRMAR).props.disabled).toBe(false);
    await clicar(t, CONFIRMAR);
    await esvaziar();
    expect(acao).toHaveBeenCalledTimes(1);
    expect(props.aoConcluir).toHaveBeenCalledTimes(1);
  });

  it("conferência desmarcada depois de marcada (R2 da #154, B9): a confirmação volta a desabilitar e o clique não executa", async () => {
    props = { ...props, conferencia: "Confirmo os valores acima." };
    const caixaDe = (t: ReactNode): No => elementos(t).find((n: No) => n.type === "input")!;
    const marcar = (valor: boolean) => (caixaDe(tela()).props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: valor } });
    marcar(true);
    expect(caixaDe(tela()).props.checked).toBe(true);
    expect(botaoPorTexto(tela(), CONFIRMAR).props.disabled).toBe(false);
    marcar(false);
    const t = tela();
    expect(caixaDe(t).props.checked).toBe(false);
    expect(botaoPorTexto(t, CONFIRMAR).props.disabled).toBe(true);
    await clicar(t, CONFIRMAR);
    await esvaziar();
    expect(acao).not.toHaveBeenCalled();
    expect(props.aoConcluir).not.toHaveBeenCalled();
  });
});
