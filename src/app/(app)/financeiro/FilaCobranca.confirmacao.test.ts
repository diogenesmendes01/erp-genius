import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FilaCobrancaItem } from "@/server/cobrancas/consultas";

// Cobrar por WhatsApp (docs/42 L2014; docs/43 §6 item 1): o "Cobrar"/"Lembrar" da linha e o "Enviar via
// WhatsApp (API)" do detalhe NÃO enviam — abrem o ConfirmarAcao; só a confirmação chama a action. Sem DOM
// (src/test/tela-sem-dom.ts): a tela é chamada como função; os filhos (AcaoRapida, DetalheCobranca,
// ConfirmarAcao) não rodam — as props deles são acionadas.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  enfileirar: vi.fn(), refresh: vi.fn(),
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
    useEffect: (() => {}) as typeof real.useEffect,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: m.refresh }) }));
vi.mock("@/lib/filtros-url", () => ({
  useFiltrosUrl: () => ({
    campos: { busca: "", pais: "", turma: "" }, buscando: false,
    aoClicar: () => () => {}, aplicar: () => {}, mudarTexto: () => () => {}, mudarSelect: () => () => {},
  }),
}));
vi.mock("@/server/financeiro/acoes", () => ({ registrarCobrancaWhatsApp: vi.fn() }));
vi.mock("@/server/financeiro/cobranca-manual", () => ({ prepararCobrancaManual: vi.fn() }));
vi.mock("@/server/cobrancas/acoes", () => ({ registrarPromessaPagamento: vi.fn() }));
vi.mock("@/server/whatsapp/acoes", () => ({ aprovarLoteCobranca: vi.fn(), enfileirarCobrancaWhatsApp: m.enfileirar }));
vi.mock("@/components/PagamentoModal", () => ({ PagamentoModal: () => null }));
vi.mock("./AcessoAulasPainel", () => ({ AcessoAulasPainel: () => null }));

import { AcaoRapida, DetalheCobranca, FilaCobranca } from "./FilaCobranca";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";
import { lerFiltrosFila } from "@/server/cobrancas/filtros-fila";

const item: FilaCobrancaItem = {
  conferenciaAte: null,
  id: "cobranca-1", cicloRegua: 1, codigo: "COB-1", tipo: "MENSALIDADE",
  valorNegociado: 100, valorRecebido: 0, saldo: 100, moeda: "BRL",
  vencimento: { estado: "CONFIRMADO", dataCivil: "2026-01-15", fuso: "America/Sao_Paulo", origem: "EMISSAO_ENTRADA" }, competencia: "2026-01",
  estado: "acao_devida", passo: "D+3", tipoAcao: "cobrar", template: "cobranca_vencida",
  rotuloAcao: "Cobrar", atrasadaNaAcao: false, diasAtraso: 3, prioridade: 1,
  promessaAte: null, matriculaId: "matricula-1",
  acessoBloqueado: false, precisaBloqueio: false, tentativas: 0, ultimaCobrancaEm: null,
  passosFeitos: [], aluno: { id: "aluno-1", nome: "Ana Silva", telefone: null }, pais: "Brasil", turma: null,
  destino: { telefone: "+5511999999999", nome: "Carla Souza", viaResponsavel: true },
  respondeuEm: null, envio: null, mensagemSugerida: "Olá, Carla.",
};
const props = {
  itens: [item], totalFila: 1, filtros: lerFiltrosFila({}), opcoes: { paises: [], turmas: [] },
  dashs: { aVencer: 0, emAtraso: 1, bloquear: 0, promessas: 0, recebidoHoje: [] },
  regua: [], podeOperar: true, podeBloquear: false,
};

const tela = (): ReactNode => m.ganchos!.renderizar(FilaCobranca, props);
const doTipo = (t: ReactNode, tipo: unknown): No[] => elementos(t).filter((n) => n.type === tipo);
const confirmacoes = (t: ReactNode) => doTipo(t, ConfirmarAcao);
const nota = (t: ReactNode) => doTipo(t, MensagemStatus)[0]?.props.texto;

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.enfileirar.mockResolvedValue({ ok: true, dado: { passo: "D+3", status: "DESPACHADA", motivo: null } });
});

describe("FilaCobranca \u2014 cobrar pela linha passa pela confirmação", () => {
  it("o \"Cobrar\" da linha é um botão que só chama onEnviar (AcaoRapida)", () => {
    const onEnviar = vi.fn();
    const botao = AcaoRapida({ item, podeOperar: true, onEnviar, onAcesso: vi.fn() }) as unknown as No;
    expect(botao.type).toBe("button");
    expect(texto(botao.props.children)).toBe("Cobrar");
    (botao.props.onClick as () => void)();
    expect(onEnviar).toHaveBeenCalledTimes(1);
    expect(m.enfileirar).not.toHaveBeenCalled();
  });

  it("clicar não envia; abre a confirmação com destino e degrau; só confirmar envia", async () => {
    expect(confirmacoes(tela())).toHaveLength(0);
    const [rapida] = doTipo(tela(), AcaoRapida);
    (rapida.props.onEnviar as () => void)();
    expect(m.enfileirar).not.toHaveBeenCalled();

    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Enviar a cobrança D+3 para Ana Silva pelo WhatsApp?");
    expect(c.props.confirmacao).toBe("envio para Carla");
    expect(c.props.idempotente).toBe(false);
    // A consequência (ResumoEnvioApi): para quem, por qual número, quanto, com qual degrau, e sem desfazer.
    const resumo = c.props.children as No;
    const consequencia = texto((resumo.type as (p: unknown) => ReactNode)(resumo.props)).replace(/\s+/g, " ");
    expect(consequencia).toContain("Mensagem real para Carla Souza (responsável financeiro), no número +5511999999999.");
    expect(consequencia).toContain("template do degrau D+3 (Cobrar)");
    expect(consequencia).toContain("Uma mensagem enviada não pode ser desfeita.");
    expect(m.enfileirar).not.toHaveBeenCalled();

    expect(m.enfileirar).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.enfileirar).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    expect(m.enfileirar).toHaveBeenCalledTimes(1);
    expect(m.enfileirar).toHaveBeenCalledWith("cobranca-1");
  });

  it("concluir fecha a confirmação, mostra o desfecho do despacho e atualiza a fila", () => {
    const [rapida] = doTipo(tela(), AcaoRapida);
    (rapida.props.onEnviar as () => void)();
    const [c] = confirmacoes(tela());
    (c.props.aoConcluir as (d: unknown) => void)({ passo: "D+3", status: "DESPACHADA", motivo: null });
    const t = tela();
    expect(confirmacoes(t)).toHaveLength(0);
    expect(nota(t)).toBe("Enviado via WhatsApp (D+3).");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  // R1 da #154, B5: cada desfecho do despacho sai no lugar certo — falha como erro (role="alert"), o resto
  // como nota (região polite). FALHOU numa nota verde esconderia a mensagem que não saiu.
  const desfechos: { status: string; motivo: string | null; nota: string | null; erro: string | null }[] = [
    { status: "DESPACHADA", motivo: null, nota: "Enviado via WhatsApp (D+3).", erro: null },
    { status: "SIMULADA", motivo: null, nota: "Ensaio (shadow): D+3 simulado \u2014 nada foi enviado de verdade.", erro: null },
    { status: "ADIADA", motivo: "fora_da_janela", nota: "Na fila (fora da janela de horário) \u2014 envia sozinho na próxima janela.", erro: null },
    { status: "FALHOU", motivo: "numero_invalido", nota: null, erro: "Envio falhou: numero_invalido \u2014 o item continua na fila manual." },
    { status: "CANCELADA", motivo: "conversa_viva", nota: "Não enviado: o contato respondeu \u2014 trate a conversa antes.", erro: null },
  ];
  for (const d of desfechos) {
    it(`desfecho ${d.status}: ${d.erro ? "erro (role=alert), sem nota" : "nota, sem erro"}`, () => {
      const [rapida] = doTipo(tela(), AcaoRapida);
      (rapida.props.onEnviar as () => void)();
      const [c] = confirmacoes(tela());
      (c.props.aoConcluir as (dado: { passo: string; status: string; motivo: string | null }) => void)({ passo: "D+3", status: d.status, motivo: d.motivo });
      const t = tela();
      const alerta = elementos(t).find((n: No) => n.type === "p" && n.props.role === "alert");
      expect(alerta ? texto(alerta.props.children) : null).toBe(d.erro);
      expect(nota(t) ?? null).toBe(d.nota);
      expect(confirmacoes(t)).toHaveLength(0);
    });
  }

  it("voltar fecha a confirmação sem enviar", () => {
    const [rapida] = doTipo(tela(), AcaoRapida);
    (rapida.props.onEnviar as () => void)();
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.enfileirar).not.toHaveBeenCalled();
  });
});

describe("FilaCobranca \u2014 enviar pela gaveta do detalhe passa pela confirmação", () => {
  const abrirDetalhe = () => {
    const linha = elementos(tela()).find((n) => n.type === "button" && texto(n.props.children).includes("Ana Silva"));
    (linha!.props.onClick as () => void)();
  };

  it("\"Enviar via WhatsApp (API)\" no detalhe só chama onEnviarApi", () => {
    const onEnviarApi = vi.fn();
    const g = criarGanchos();
    const anterior = m.ganchos;
    m.ganchos = g;
    const detalhe = g.renderizar(DetalheCobranca, {
      item, regua: [], podeOperar: true, preferenciaFusoExibicao: null,
      onClose: vi.fn(), onEnviarApi, onPrepararManual: async () => null, onConfirmarManual: async () => false, onPagar: vi.fn(), onPromessa: vi.fn(),
    });
    m.ganchos = anterior;
    const botao = elementos(detalhe).find((n) => n.type === "button" && texto(n.props.children).trim() === "Enviar via WhatsApp (API)");
    expect(botao?.props.onClick).toBe(onEnviarApi);
  });

  it("onEnviarApi abre a confirmação por cima do detalhe; o envio só sai ao confirmar; concluir fecha os dois", async () => {
    abrirDetalhe();
    const [detalhe] = doTipo(tela(), DetalheCobranca);
    (detalhe.props.onEnviarApi as () => void)();
    expect(m.enfileirar).not.toHaveBeenCalled();
    let t = tela();
    expect(doTipo(t, DetalheCobranca)).toHaveLength(1); // o detalhe continua aberto por baixo
    const [c] = confirmacoes(t);
    expect(m.enfileirar).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.enfileirar).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    expect(m.enfileirar).toHaveBeenCalledWith("cobranca-1");
    (c.props.aoConcluir as (d: unknown) => void)({ passo: "D+3", status: "SIMULADA", motivo: null });
    t = tela();
    expect(confirmacoes(t)).toHaveLength(0);
    expect(doTipo(t, DetalheCobranca)).toHaveLength(0);
    expect(nota(t)).toBe("Ensaio (shadow): D+3 simulado \u2014 nada foi enviado de verdade.");
  });
});
