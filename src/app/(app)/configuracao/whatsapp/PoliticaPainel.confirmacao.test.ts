import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NumeroConfig, PoliticaConfig, TemplateConfig } from "@/server/whatsapp/consultas";

// Kill switch e ativação da régua de cobrança (docs/42 L2516/L2517): o kill switch pede confirmação nos
// dois sentidos; o Salvar que passa a régua para ATIVA só abre a confirmação (remetente, janela, teto,
// degraus armados e QUANTAS PESSOAS vão receber, estimado no servidor com a regra do cron — L2517, fatia B,
// issue #169); salvar sem ativar continua direto.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  kill: vi.fn(), salvar: vi.fn(), estimar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => m.ganchos!.useRef(i)) as unknown as typeof real.useRef,
    useId: (() => m.ganchos!.useId()) as typeof real.useId,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/whatsapp/acoes", () => ({ acionarKillSwitchRegua: m.kill, estimarAlcanceRegua: m.estimar, salvarPoliticaRegua: m.salvar }));

import { PoliticaPainel } from "./PoliticaPainel";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { clicar, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const numero: NumeroConfig = {
  id: "n1", telefoneE164: "+50688887777", rotulo: "Cobrança CR", driver: "META_CLOUD", finalidade: "COBRANCA",
  providerRef: null, sessao: "", donoId: null, donoNome: null, ativo: true, setores: ["FINANCEIRO"], triagemResponsavelId: null,
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
  m.estimar.mockResolvedValue({ ok: true, dado: { pessoas: 37, cobrancas: 41, semDestino: 2, emLote: 5 } });
});

/** O texto do alcance na confirmação aberta (o componente TextoAlcance chamado com as props que a tela deu). */
function textoDoAlcance(c: No): string {
  const filhos = (Array.isArray(c.props.children) ? c.props.children : [c.props.children]) as unknown[];
  const no = filhos.find((f: unknown) => !!f && typeof f === "object" && "props" in (f as object) && "alcance" in ((f as No).props)) as No;
  return texto((no.type as (p: unknown) => ReactNode)(no.props)).replace(/\s+/g, " ");
}

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

describe("PoliticaPainel — alcance da ativação (docs/42 L2517)", () => {
  it("abrir a confirmação pede a estimativa ao servidor com a política do formulário e mostra quantas pessoas vão receber", async () => {
    escolherEstado("ATIVA");
    await clicar(tela(), "Salvar política");
    expect(m.estimar).toHaveBeenCalledTimes(1);
    expect(m.estimar.mock.calls[0][0]).toMatchObject({ estado: "ATIVA", numeroRemetenteId: "n1", tetoPorContatoDia: 2 });
    expect(m.salvar).not.toHaveBeenCalled(); // estimar não salva nada
    const [c] = doTipo(tela(), ConfirmarAcao);
    const alcance = textoDoAlcance(c);
    expect(alcance).toContain("37 pessoas vão receber mensagem automática de cobrança");
    expect(alcance).toContain("41 cobranças com degrau automático devido hoje");
    expect(alcance).toContain("2 cobranças devidas não têm destinatário financeiro válido e não recebem.");
    expect(alcance).toContain("5 cobranças entram no degrau de lote");
    expect(alcance).toContain("É a contagem de agora");
  });

  it("singular: 1 pessoa vai receber; sem destino e sem lote, as frases somem", async () => {
    m.estimar.mockResolvedValueOnce({ ok: true, dado: { pessoas: 1, cobrancas: 1, semDestino: 0, emLote: 0 } });
    escolherEstado("ATIVA");
    await clicar(tela(), "Salvar política");
    const alcance = textoDoAlcance(doTipo(tela(), ConfirmarAcao)[0]);
    expect(alcance).toContain("1 pessoa vai receber");
    expect(alcance).toContain("1 cobrança com degrau automático devido hoje");
    expect(alcance).not.toContain("destinatário financeiro");
    expect(alcance).not.toContain("lote");
  });

  it("enquanto a estimativa não chega, a confirmação diz que está calculando", async () => {
    let liberar: (r: unknown) => void = () => {};
    m.estimar.mockImplementationOnce(() => new Promise((r: (v: unknown) => void) => { liberar = r; }));
    escolherEstado("ATIVA");
    const promessa = clicar(tela(), "Salvar política");
    expect(textoDoAlcance(doTipo(tela(), ConfirmarAcao)[0])).toBe("Calculando quantas pessoas vão receber…");
    liberar({ ok: true, dado: { pessoas: 3, cobrancas: 3, semDestino: 0, emLote: 0 } });
    await promessa;
    expect(textoDoAlcance(doTipo(tela(), ConfirmarAcao)[0])).toContain("3 pessoas vão receber");
  });

  it("erro e falha de rede da estimativa: a confirmação diz que não foi possível estimar (e por quê)", async () => {
    m.estimar.mockResolvedValueOnce({ ok: false, erro: "Escolha ao menos um dia da semana." });
    escolherEstado("ATIVA");
    await clicar(tela(), "Salvar política");
    expect(textoDoAlcance(doTipo(tela(), ConfirmarAcao)[0])).toBe("Não foi possível estimar quantas pessoas vão receber: Escolha ao menos um dia da semana.");
    (doTipo(tela(), ConfirmarAcao)[0].props.aoCancelar as () => void)();
    m.estimar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await clicar(tela(), "Salvar política");
    expect(textoDoAlcance(doTipo(tela(), ConfirmarAcao)[0])).toContain("Não foi possível estimar quantas pessoas vão receber: falha de rede");
  });

  it("só a resposta do último pedido vale (o diálogo foi fechado e reaberto)", async () => {
    let primeira: (r: unknown) => void = () => {};
    m.estimar.mockImplementationOnce(() => new Promise((r: (v: unknown) => void) => { primeira = r; }));
    escolherEstado("ATIVA");
    const antiga = clicar(tela(), "Salvar política");
    (doTipo(tela(), ConfirmarAcao)[0].props.aoCancelar as () => void)();
    m.estimar.mockResolvedValueOnce({ ok: true, dado: { pessoas: 8, cobrancas: 9, semDestino: 0, emLote: 0 } });
    await clicar(tela(), "Salvar política");
    primeira({ ok: true, dado: { pessoas: 99, cobrancas: 99, semDestino: 0, emLote: 0 } });
    await antiga;
    expect(textoDoAlcance(doTipo(tela(), ConfirmarAcao)[0])).toContain("8 pessoas vão receber");
  });

  it("com o kill switch ligado no formulário, a confirmação avisa que nada sai até destravar", async () => {
    politica = { ...politicaBase, killSwitch: true };
    escolherEstado("ATIVA");
    await clicar(tela(), "Salvar política");
    expect(texto(doTipo(tela(), ConfirmarAcao)[0].props.children)).toContain("O kill switch está ligado: nada sai até alguém destravar.");
  });

  it("salvar sem ativar não pede estimativa", async () => {
    await clicar(tela(), "Salvar política");
    expect(m.estimar).not.toHaveBeenCalled();
  });
});
