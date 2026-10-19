import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Decidir a compensação de permuta (docs/42 L2142; #175): a decisão nasce vazia (antes vinha em "Aprovar e
// compensar"), o botão diz a ação escolhida e aprovar só abre o ConfirmarAcao, que diz quanto sai de cada
// mensalidade; só a confirmação chama a action. Rejeitar não abate nada e continua direto.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  decidir: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  const g = () => m.ganchos!;
  return {
    ...real,
    useState: ((i: unknown) => g().useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => g().useRef(i)) as unknown as typeof real.useRef,
    useId: (() => g().useId()) as typeof real.useId,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/financeiro/permuta-servico", () => ({ decidirCompensacaoPermuta: m.decidir, prepararAcordoPermuta: vi.fn(), confirmarServicoPermuta: vi.fn(), proporCompensacaoPermuta: vi.fn() }));

import { DecidirCompensacao } from "./PermutaOperacional";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { criarGanchos, elementos, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";

const proposta = { id: "proposta-1", valor: "150.00", destinos: [{ cobrancaId: "c1", valor: "100.00" }, { cobrancaId: "c2", valor: "50.00" }], decisao: null };
const cobrancas = [{ id: "c1", codigo: "MEN-01", saldo: "100.00", valorMaximo: "100.00" }, { id: "c2", codigo: "MEN-02", saldo: "300.00", valorMaximo: "80.00" }];
const MOTIVO = "Serviço conferido no diário";
const tela = (): ReactNode => m.ganchos!.renderizar(DecidirCompensacao, { proposta, moeda: "BRL", cobrancas });
const confirmacoes = (t: ReactNode): No[] => elementos(t).filter((n: No) => n.type === ConfirmarAcao);
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };
const select = (t: ReactNode) => elementos(t).find((n: No) => n.type === "select")!;
const escolher = (valor: string) => (select(tela()).props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });
const preencherMotivo = (valor = MOTIVO) => {
  const campo = elementos(tela()).find((n: No) => n.type === "input" && n.props.name === "motivo")!;
  (campo.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });
};
const botaoDecidir = (t: ReactNode) => elementos(t).find((n: No) => n.type === "button" && n.props.type === "submit")!;
const enviar = () => (elementos(tela()).find((n: No) => n.type === "form")!.props.onSubmit as (e: { preventDefault(): void }) => unknown)({ preventDefault() {} });
const esvaziar = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.decidir.mockResolvedValue({ ok: true, dado: { id: "decisao-1", efetivada: true, repetida: false } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("PermutaOperacional — decidir a compensação", () => {
  it("a decisão nasce vazia e obrigatória; o botão só diz \"Decidir\" até escolher", () => {
    let t = tela();
    expect(select(t).props.value).toBe("");
    expect(select(t).props.required).toBe(true);
    const opcoes = elementos(select(t).props.children as ReactNode).filter((n: No) => n.type === "option");
    expect(opcoes.map((o: No) => [o.props.value, texto(o.props.children), !!o.props.disabled])).toEqual([["", "Escolha a decisão", true], ["APROVAR", "Aprovar e compensar", false], ["REJEITAR", "Rejeitar", false]]);
    expect(texto(botaoDecidir(t).props.children)).toBe("Decidir");
    expect(botaoDecidir(t).props.disabled).toBe(true);
    escolher("APROVAR");
    t = tela();
    expect(texto(botaoDecidir(t).props.children)).toBe("Aprovar e compensar");
    expect(botaoDecidir(t).props.disabled).toBe(false);
  });

  it("enviar sem escolher a decisão não aprova", async () => {
    preencherMotivo();
    enviar();
    await esvaziar();
    expect(m.decidir).not.toHaveBeenCalled();
    expect(confirmacoes(tela())).toHaveLength(0);
  });

  it("aprovar não abate; a confirmação diz o valor de cada mensalidade; só confirmar aprova, uma vez", async () => {
    escolher("APROVAR");
    preencherMotivo();
    enviar();
    expect(m.decidir).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Aprovar a compensação de R$ 150,00?");
    expect(c.props.confirmacao).toBe("compensação de R$ 150,00");
    expect(c.props.idempotente).toBe(true);
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("MEN-01: R$ 100,00");
    expect(consequencia).toContain("MEN-02: R$ 50,00");
    expect(consequencia).toContain("Não é recebimento em dinheiro");
    expect(consequencia).toContain(`Motivo registrado: ${MOTIVO}`);
    expect(consequencia).toContain("Não há desfazer pela tela");
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.decidir).toHaveBeenCalledTimes(1);
    expect(m.decidir).toHaveBeenCalledWith({ propostaId: "proposta-1", aprovar: true, motivo: MOTIVO });
    (c.props.aoConcluir as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("voltar não aprova", () => {
    escolher("APROVAR");
    preencherMotivo();
    enviar();
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.decidir).not.toHaveBeenCalled();
  });

  it("erro e falha de rede aparecem dentro do diálogo, que continua aberto", async () => {
    escolher("APROVAR");
    preencherMotivo();
    enviar();
    m.decidir.mockResolvedValueOnce({ ok: false, erro: "A cobrança mudou. Rejeite esta proposta e prepare uma nova conferência." });
    expect(await confirmarNoDialogo(confirmacoes(tela())[0], usar)).toEqual({ erro: "A cobrança mudou. Rejeite esta proposta e prepare uma nova conferência.", confirmarDisponivel: true });
    m.decidir.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(confirmacoes(tela())[0], usar)).erro).toBeTruthy();
    expect(confirmacoes(tela())).toHaveLength(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("rejeitar continua direto, sem confirmação; a falha de rede manda conferir antes de repetir", async () => {
    escolher("REJEITAR");
    preencherMotivo();
    m.decidir.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    enviar();
    await esvaziar();
    expect(m.decidir).toHaveBeenCalledWith({ propostaId: "proposta-1", aprovar: false, motivo: MOTIVO });
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(texto(elementos(tela()).find((n: No) => n.type === "p" && n.props.role === "alert")?.props.children)).toBe(MSG_DECISAO_INCERTA);
  });
});
