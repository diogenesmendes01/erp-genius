import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NumeroConfig, PoliticaConfig, TemplateConfig } from "@/server/whatsapp/consultas";

// Kill switch e ativação da régua de cobrança (docs/42 L2516/L2517): o kill switch pede confirmação nos
// dois sentidos; o Salvar que passa a régua para ATIVA só abre a confirmação (remetente, janela, teto,
// degraus armados); salvar sem ativar continua direto.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  kill: vi.fn(), salvar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/whatsapp/acoes", () => ({ acionarKillSwitchRegua: m.kill, salvarPoliticaRegua: m.salvar }));

import { PoliticaPainel } from "./PoliticaPainel";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { clicar, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const numero: NumeroConfig = {
  id: "n1", telefoneE164: "+50688887777", rotulo: "Cobrança CR", driver: "META_CLOUD", finalidade: "COBRANCA",
  providerRef: null, sessao: "", donoId: null, donoNome: null, ativo: true,
};
const template: TemplateConfig = {
  id: "t1", nome: "cobranca_vencida", corpo: "Olá {nome}", idioma: "es", categoria: "utility", statusMeta: "APROVADO", metaTemplateId: null, atualizadoEm: "2026-01-01T00:00:00.000Z",
};
const politicaBase: PoliticaConfig = {
  id: "p1", nome: "Cobrança", estado: "SHADOW", janelaInicio: 9, janelaFim: 20, diasSemana: [1, 2, 3, 4, 5],
  tetoPorContatoDia: 2, silencioPosInboundHoras: 72, killSwitch: false, numeroRemetenteId: "n1",
  degraus: [
    { passo: "D-3", offsetDias: -3, tipo: "lembrar", rotulo: "Lembrete", modo: "AUTOMATICO", ativo: true, templateId: "t1" },
    { passo: "D+3", offsetDias: 3, tipo: "cobrar", rotulo: "Cobrança", modo: "LOTE", ativo: true, templateId: null },
    { passo: "D0", offsetDias: 0, tipo: "cobrar", rotulo: "Vencimento", modo: "LOTE", ativo: false, templateId: "t1" },
    { passo: "D+7", offsetDias: 7, tipo: "cobrar", rotulo: "Cobrança", modo: "MANUAL", ativo: true, templateId: null },
    { passo: "D+15", offsetDias: 15, tipo: "bloquear", rotulo: "Bloqueio", modo: "MANUAL", ativo: true, templateId: null },
  ],
};
let politica: PoliticaConfig;
const tela = (): ReactNode => m.ganchos!.renderizar(PoliticaPainel, { politica, numeros: [numero], templates: [template] });
const doTipo = (t: ReactNode, tipo: unknown): No[] => elementos(t).filter((n) => n.type === tipo);
const estado = (t: ReactNode) => elementos(t).find((n) => n.type === "select" && n.props.value !== undefined && ["DESLIGADA", "SHADOW", "ATIVA"].includes(String(n.props.value)))!;
const escolherEstado = (valor: string) => (estado(tela()).props.onChange as (e: unknown) => void)({ target: { value: valor } });

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  politica = { ...politicaBase };
  m.kill.mockResolvedValue({ ok: true });
  m.salvar.mockResolvedValue({ ok: true });
});

describe("PoliticaPainel \u2014 kill switch", () => {
  it("ligar: o botão não congela; a confirmação diz o que para; só confirmar chama a action", async () => {
    clicar(tela(), "Kill switch");
    expect(m.kill).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe("Congelar toda a automação de cobrança?");
    expect(texto(c.props.children)).toContain("Nenhuma mensagem automática de cobrança sai");
    expect(m.kill).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.kill).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    expect(m.kill).toHaveBeenCalledWith(true);
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(doTipo(t, FeedbackAcao)[0].props.sucesso).toBe("Kill switch LIGADO \u2014 automação congelada (nada se perde).");
  });

  it("destravar também confirma, dizendo que mensagens reais voltam a sair quando a régua está ativa", async () => {
    politica = { ...politicaBase, killSwitch: true, estado: "ATIVA" };
    clicar(tela(), "Kill switch LIGADO \u2014 destravar");
    expect(m.kill).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe("Destravar a automação de cobrança?");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Mensagens reais voltam a sair para os clientes");
    expect(consequencia).toContain("9h às 20h, seg, ter, qua, qui, sex");
    expect(m.kill).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.kill).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    expect(m.kill).toHaveBeenCalledWith(false);
  });

  it("voltar não mexe no kill switch", () => {
    clicar(tela(), "Kill switch");
    (doTipo(tela(), ConfirmarAcao)[0].props.aoCancelar as () => void)();
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
    expect(m.kill).not.toHaveBeenCalled();
  });
});

describe("PoliticaPainel \u2014 ativar a régua", () => {
  it("de ensaio para ATIVA: Salvar não salva; a confirmação mostra remetente, janela, teto e degraus armados", async () => {
    escolherEstado("ATIVA");
    await clicar(tela(), "Salvar política");
    expect(m.salvar).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe("Ativar a régua de cobrança e enviar mensagens reais?");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Remetente: Cobrança CR (oficial)");
    expect(consequencia).toContain("Janela: 9h às 20h, seg, ter, qua, qui, sex");
    expect(consequencia).toContain("Teto: 2 mensagens automáticas por contato/dia");
    expect(consequencia).toContain("Automáticos (saem sozinhos): D-3 (cobranca_vencida)");
    // Lote armado entra com o nome (R1 da #154, B7); o inativo (D0) e o manual (D+7) não.
    expect(consequencia).toContain("Em lote (saem quando alguém aprova o lote): D+3 (texto de fábrica)");
    expect(consequencia).not.toContain("D0");
    expect(consequencia).not.toContain("D+7"); // manual não dispara sozinho
    expect(consequencia).not.toContain("D+15");
    expect(m.salvar).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.salvar).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    expect(m.salvar).toHaveBeenCalledTimes(1);
    expect(m.salvar.mock.calls[0][0]).toMatchObject({ estado: "ATIVA", numeroRemetenteId: "n1" });
  });

  it("salvar sem ativar (continua em ensaio) grava direto, sem confirmação", async () => {
    await clicar(tela(), "Salvar política");
    expect(m.salvar).toHaveBeenCalledTimes(1);
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
  });

  it("régua que já está ATIVA: salvar não pede de novo", async () => {
    politica = { ...politicaBase, estado: "ATIVA" };
    await clicar(tela(), "Salvar política");
    expect(m.salvar).toHaveBeenCalledTimes(1);
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
  });
});
