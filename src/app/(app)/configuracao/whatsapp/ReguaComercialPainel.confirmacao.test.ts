import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReguaComercialConfig } from "@/server/comercial/consultas";

// Réguas comerciais (docs/42 L2517; B1 do doc 32): ativar a régua ou desligar o modo piloto (go-live
// geral) só abre o ConfirmarAcao no Salvar, com alcance, remetente, janela e degraus; o window.confirm que
// existia no clique da caixa do piloto saiu (trava em src/app/confirmacoes.test.ts).
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  salvar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useEffect: (() => {}) as typeof real.useEffect,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/comercial/acoes", () => ({ salvarReguaComercial: m.salvar }));
vi.mock("@/server/whatsapp/acoes", () => ({ buscarVinculosInbox: vi.fn() }));

import { ReguaComercialPainel } from "./ReguaComercialPainel";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { clicar, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const reguaBase: ReguaComercialConfig = {
  id: "r1", chave: "lead-novo", nome: "Lead novo sem resposta", estado: "SHADOW", numeroRemetenteId: "v1",
  janelaInicio: 8, janelaFim: 20, tetoPorContatoDia: 1, modoPiloto: true,
  pilotoLeads: [{ id: "l1", codigo: "L-1", nome: "Bia" }, { id: "l2", codigo: null, nome: "Caio" }],
  degraus: [
    { passo: "F1", offsetMinutos: 60, rotulo: "1º follow-up", ativo: true, templateId: "t1" },
    { passo: "F2", offsetMinutos: 1440, rotulo: "2º follow-up", ativo: false, templateId: null },
  ],
};
let regua: ReguaComercialConfig;
const tela = (): ReactNode => m.ganchos!.renderizar(ReguaComercialPainel, {
  regua, numeros: [{ id: "v1", rotulo: "Vendas SP", finalidade: "VENDAS" }], templates: [{ id: "t1", nome: "followup_1" }],
});
const doTipo = (t: ReactNode, tipo: unknown): No[] => elementos(t).filter((n) => n.type === tipo);
const SALVAR = `Salvar "Lead novo sem resposta"`;
const escolherEstado = (valor: string) => {
  const select = elementos(tela()).find((n) => n.type === "select" && ["DESLIGADA", "SHADOW", "ATIVA"].includes(String(n.props.value)))!;
  (select.props.onChange as (e: unknown) => void)({ target: { value: valor } });
};
const caixaDoPiloto = (t: ReactNode) => elementos(t).find((n) => n.type === "input" && n.props.type === "checkbox" && !n.props["aria-label"])!;

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  regua = { ...reguaBase };
  m.salvar.mockResolvedValue({ ok: true });
});

describe("ReguaComercialPainel — ativar e go-live passam pela confirmação", () => {
  it("de ensaio para ativa (com piloto): Salvar não salva; a confirmação diz o alcance do piloto e os degraus ativos", async () => {
    escolherEstado("ATIVA");
    await clicar(tela(), SALVAR);
    expect(m.salvar).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe(`Ativar a régua "Lead novo sem resposta" e enviar mensagens reais?`);
    expect(c.props.confirmacao).toBe("ativação da régua");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Alcance: só os 2 lead(s) do piloto");
    expect(consequencia).toContain("Remetente: Vendas SP");
    expect(consequencia).toContain("1º follow-up (após 60 min, followup_1)");
    expect(consequencia).not.toContain("2º follow-up");
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.salvar).toHaveBeenCalledTimes(1);
    expect(m.salvar.mock.calls[0][0]).toMatchObject({ chave: "lead-novo", estado: "ATIVA", modoPiloto: true, pilotoLeadIds: ["l1", "l2"] });
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(doTipo(t, FeedbackAcao)[0].props.sucesso).toBe(`Régua "Lead novo sem resposta" salva.`);
  });

  it("desligar o piloto não pede window.confirm no clique; o Salvar abre a confirmação do go-live geral", async () => {
    (caixaDoPiloto(tela()).props.onChange as (e: unknown) => void)({ target: { checked: false } });
    expect(caixaDoPiloto(tela()).props.checked).toBe(false);
    await clicar(tela(), SALVAR);
    expect(m.salvar).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe(`Levar a régua "Lead novo sem resposta" a todos os leads (go-live geral)?`);
    expect(c.props.confirmacao).toBe("go-live geral");
    expect(texto(c.props.children).replace(/\s+/g, " ")).toContain("GO-LIVE GERAL — todos os leads elegíveis do número");
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.salvar.mock.calls[0][0]).toMatchObject({ modoPiloto: false });
  });

  it("salvar sem ativar e sem desligar o piloto grava direto", async () => {
    await clicar(tela(), SALVAR);
    expect(m.salvar).toHaveBeenCalledTimes(1);
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
  });

  it("voltar não salva", async () => {
    escolherEstado("ATIVA");
    await clicar(tela(), SALVAR);
    (doTipo(tela(), ConfirmarAcao)[0].props.aoCancelar as () => void)();
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
    expect(m.salvar).not.toHaveBeenCalled();
  });
});
