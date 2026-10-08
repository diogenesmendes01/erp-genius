import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Aplicar acerto e reconferência delta (docs/42 L799): "as duas ações mais irreversíveis da área" agora
// revelam o resumo (cobranças ajustadas, crédito criado) num ConfirmarAcao que exige "Confirmo os valores
// acima"; só a confirmação chama a action, com a chave de idempotência estável do formulário.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  aplicarAcerto: vi.fn(), aplicarDelta: vi.fn(), prepararDelta: vi.fn(), decidirDelta: vi.fn(), refresh: vi.fn(),
  prepararAcerto: vi.fn(), decidirAcerto: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  const g = () => m.ganchos!;
  return {
    ...real,
    useState: ((i: unknown) => g().useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => g().useRef(i)) as unknown as typeof real.useRef,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/matricula/desistencia-acerto-contratual", () => ({ prepararAcertoDesistenciaContratual: m.prepararAcerto, decidirAcertoDesistenciaContratual: m.decidirAcerto }));
vi.mock("@/server/matricula/desistencia-acerto-aplicacao", () => ({ aplicarAcertoDesistenciaContratual: m.aplicarAcerto }));
vi.mock("@/server/matricula/desistencia-reconferencia-delta", () => ({
  prepararReconferenciaDeltaDesistencia: m.prepararDelta, decidirReconferenciaDeltaDesistencia: m.decidirDelta,
  decidirAdministrativamenteReconferenciaDeltaDesistencia: vi.fn(), aplicarReconferenciaDeltaDesistencia: m.aplicarDelta,
}));

import { AplicarAcertoContratualFormulario, DecidirAcertoContratualFormulario, PrepararAcertoContratualFormulario, resumoAplicacaoAcerto } from "./AcertoContratualFormularios";
import { AplicarReconferenciaDeltaFormulario, DecidirReconferenciaDeltaFormulario, PrepararReconferenciaDeltaFormulario, resumoAplicacaoDelta } from "./ReconferenciaDeltaFormularios";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { botao, clicar, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const doTipo = (t: ReactNode, tipo: unknown): No[] => elementos(t).filter((n) => n.type === tipo);
/** Componente filho (ReconciliarTentativaDelta) chamado como função, para achar o botão dele. */
const expandir = (n: No): ReactNode => (n.type as (p: unknown) => ReactNode)(n.props);

const itensAcerto = [
  { cobrancaId: "c1", moeda: "CRC", devido: "50000", saldoDevido: "0", creditoApurado: "12500" },
  { cobrancaId: "c2", moeda: "CRC", devido: "50000", saldoDevido: "50000", creditoApurado: "0" },
];
/** Ajuste só no saldo (o devido não muda): ainda é uma cobrança ajustada. */
const soSaldo = { cobrancaId: "c4", moeda: "CRC", ajusteDevido: "0", ajusteSaldo: "-500", creditoDelta: "0", reducaoCredito: "0" };
const itensDelta = [
  { cobrancaId: "c1", moeda: "CRC", ajusteDevido: "-5000", ajusteSaldo: "0", creditoDelta: "5000", reducaoCredito: "0" },
  { cobrancaId: "c2", moeda: "CRC", ajusteDevido: "0", ajusteSaldo: "0", creditoDelta: "0", reducaoCredito: "0" },
];

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.aplicarAcerto.mockResolvedValue({ ok: true, dado: { id: "ap-1" } });
  m.aplicarDelta.mockResolvedValue({ ok: true, dado: { id: "ap-2" } });
});

describe("resumos da aplicação", () => {
  it("acerto: cobranças ajustadas e crédito por moeda (só o positivo)", () => {
    expect(resumoAplicacaoAcerto(itensAcerto)).toEqual({ cobrancas: 2, credito: [{ moeda: "CRC", valor: 12500 }] });
    expect(resumoAplicacaoAcerto([itensAcerto[1]])).toEqual({ cobrancas: 1, credito: [] });
  });
  it("delta: só cobranças com ajuste; crédito novo e redução bloqueada; sem diferença quando tudo zera", () => {
    expect(resumoAplicacaoDelta(itensDelta)).toEqual({ comAjuste: 1, credito: [{ moeda: "CRC", valor: 5000 }], reducao: [], semDiferenca: false });
    expect(resumoAplicacaoDelta([itensDelta[1]]).semDiferenca).toBe(true);
  });
  it("delta: ajuste só de saldo também conta como cobrança ajustada (R2 da #154, B10)", () => {
    expect(resumoAplicacaoDelta([soSaldo])).toEqual({ comAjuste: 1, credito: [], reducao: [], semDiferenca: false });
  });
});

describe("AplicarAcertoContratualFormulario \u2014 passa pela confirmação", () => {
  const tela = (): ReactNode => m.ganchos!.renderizar(AplicarAcertoContratualFormulario, { decisaoId: "decisao-1", itens: itensAcerto });

  it("clicar não aplica; a confirmação exige conferência e repete cobranças e crédito", async () => {
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
    clicar(tela(), "Aplicar acerto aprovado");
    expect(m.aplicarAcerto).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.conferencia).toBe("Confirmo os valores acima.");
    expect(c.props.idempotente).toBe(true);
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Serão ajustadas 2 cobranças desta matrícula");
    expect(consequencia).toContain("Será criado crédito de \u20a1");
    expect(m.aplicarAcerto).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.aplicarAcerto).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    expect(m.aplicarAcerto).toHaveBeenCalledTimes(1);
    expect(m.aplicarAcerto.mock.calls[0][0]).toMatchObject({ decisaoId: "decisao-1" });
  });

  it("a chave é a mesma entre tentativas (incerto) e só troca depois do sucesso", async () => {
    clicar(tela(), "Aplicar acerto aprovado");
    let c = doTipo(tela(), ConfirmarAcao)[0];
    expect(m.aplicarAcerto).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.aplicarAcerto).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    (c.props.aoFalhar as (f: unknown) => void)({ tipo: "incerto", mensagem: MSG_RESULTADO_INCERTO });
    c = doTipo(tela(), ConfirmarAcao)[0];
    await (c.props.acao as () => Promise<unknown>)();
    const [primeira, segunda] = m.aplicarAcerto.mock.calls.map((x) => x[0].chaveIdempotencia);
    expect(segunda).toBe(primeira);
    // O incerto também fica fora do diálogo, como ERRO (role="alert"), não como status (#153).
    expect(anuncios(tela())).toEqual({ alerta: [MSG_RESULTADO_INCERTO], status: [] });
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(anuncios(t)).toEqual({ alerta: [], status: ["Acerto aplicado. A Secretaria pode efetivar a desistência."] });
    expect(m.refresh).toHaveBeenCalledTimes(1);
    clicar(t, "Aplicar acerto aprovado");
    await (doTipo(tela(), ConfirmarAcao)[0].props.acao as () => Promise<unknown>)();
    expect(m.aplicarAcerto.mock.calls[2][0].chaveIdempotencia).not.toBe(primeira);
  });

  it("voltar não aplica", () => {
    clicar(tela(), "Aplicar acerto aprovado");
    (doTipo(tela(), ConfirmarAcao)[0].props.aoCancelar as () => void)();
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
    expect(m.aplicarAcerto).not.toHaveBeenCalled();
  });
});

describe("AplicarReconferenciaDeltaFormulario \u2014 passa pela confirmação", () => {
  const tela = (): ReactNode => m.ganchos!.renderizar(AplicarReconferenciaDeltaFormulario, { decisaoFinanceiraId: "df-1", itens: itensDelta });

  it("clicar não aplica; a confirmação exige conferência e repete ajuste e crédito novo", async () => {
    clicar(tela(), "Aplicar reconferência");
    expect(m.aplicarDelta).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.conferencia).toBe("Confirmo os valores acima.");
    expect(c.props.idempotente).toBe(true);
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Será ajustada 1 cobrança desta matrícula");
    expect(consequencia).toContain("Será criado crédito novo de \u20a1");
    expect(m.aplicarDelta).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.aplicarDelta).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    expect(m.aplicarDelta).toHaveBeenCalledTimes(1);
    expect(m.aplicarDelta.mock.calls[0][0]).toMatchObject({ decisaoFinanceiraId: "df-1" });
  });

  it("resultado incerto: fecha a confirmação, trava o botão e a reconciliação REABRE a confirmação com a mesma chave", async () => {
    clicar(tela(), "Aplicar reconferência");
    let c = doTipo(tela(), ConfirmarAcao)[0];
    expect(m.aplicarDelta).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.aplicarDelta).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    (c.props.aoFalhar as (f: unknown) => void)({ tipo: "incerto", mensagem: MSG_RESULTADO_INCERTO });
    (c.props.aoCancelar as () => void)();
    let t = tela();
    // Fechada a confirmação, o incerto continua anunciado como ERRO (role="alert"), nunca como status (#153).
    expect(anuncios(t)).toEqual({ alerta: [MSG_RESULTADO_INCERTO], status: [] });
    expect(botao(t, "Aplicar reconferência").props.disabled).toBe(true);
    const [reconciliar] = elementos(t).filter((n) => typeof n.type === "function" && "aoReconciliar" in n.props);
    clicar(expandir(reconciliar), "Reconciliar mesma tentativa");
    expect(m.aplicarDelta).toHaveBeenCalledTimes(1); // reconciliar não envia sozinho
    t = tela();
    c = doTipo(t, ConfirmarAcao)[0];
    await (c.props.acao as () => Promise<unknown>)();
    const [primeira, segunda] = m.aplicarDelta.mock.calls.map((x) => x[0].chaveIdempotencia);
    expect(segunda).toBe(primeira);
  });

  it("erro de negócio troca a chave (outra tentativa); sucesso troca e anuncia", async () => {
    clicar(tela(), "Aplicar reconferência");
    let c = doTipo(tela(), ConfirmarAcao)[0];
    expect(m.aplicarDelta).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.aplicarDelta).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    (c.props.aoFalhar as (f: unknown) => void)({ tipo: "erro", mensagem: "Decisão revogada." });
    // O erro de negócio fica DENTRO do diálogo (que continua aberto); fora dele, nada é anunciado.
    expect(anuncios(tela())).toEqual({ alerta: [], status: [] });
    c = doTipo(tela(), ConfirmarAcao)[0];
    await (c.props.acao as () => Promise<unknown>)();
    const [primeira, segunda] = m.aplicarDelta.mock.calls.map((x) => x[0].chaveIdempotencia);
    expect(segunda).not.toBe(primeira);
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(anuncios(t)).toEqual({ alerta: [], status: ["Reconferência aplicada. A Secretaria ainda precisa efetivar a desistência."] });
    expect(m.refresh).toHaveBeenCalledTimes(1);
    // R1 da #154, B6: depois do sucesso, a próxima aplicação é OUTRA tentativa (chave nova).
    clicar(t, "Aplicar reconferência");
    await (doTipo(tela(), ConfirmarAcao)[0].props.acao as () => Promise<unknown>)();
    const terceira = m.aplicarDelta.mock.calls[2][0].chaveIdempotencia;
    expect(terceira).not.toBe(segunda);
    expect(terceira).not.toBe(primeira);
  });

  it("a consequência repete a redução de crédito bloqueada quando há (R1 da #154, B7)", () => {
    m.ganchos!.reiniciar();
    const comReducao = [{ cobrancaId: "c3", moeda: "CRC", ajusteDevido: "-2000", ajusteSaldo: "0", creditoDelta: "0", reducaoCredito: "3000" }];
    const t = (): ReactNode => m.ganchos!.renderizar(AplicarReconferenciaDeltaFormulario, { decisaoFinanceiraId: "df-2", itens: comReducao });
    clicar(t(), "Aplicar reconferência");
    const consequencia = texto(doTipo(t(), ConfirmarAcao)[0].props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Será ajustada 1 cobrança desta matrícula");
    expect(consequencia).toContain("Nenhum crédito novo será criado.");
    expect(consequencia).toContain("Redução de crédito bloqueada: \u20a1");
  });

  it("sem diferença: a consequência diz que nada é ajustado nem creditado", () => {
    m.ganchos!.reiniciar();
    const t = (): ReactNode => m.ganchos!.renderizar(AplicarReconferenciaDeltaFormulario, { decisaoFinanceiraId: "df-3", itens: [itensDelta[1]] });
    clicar(t(), "Aplicar reconferência");
    const consequencia = texto(doTipo(t(), ConfirmarAcao)[0].props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Sem diferença a aplicar");
    expect(consequencia).not.toContain("Será ajustada");
  });

  it("ajuste só de saldo: a consequência diz que a cobrança é ajustada, não \"sem diferença\" (R2 da #154, B10)", () => {
    m.ganchos!.reiniciar();
    const t = (): ReactNode => m.ganchos!.renderizar(AplicarReconferenciaDeltaFormulario, { decisaoFinanceiraId: "df-4", itens: [soSaldo] });
    clicar(t(), "Aplicar reconferência");
    const consequencia = texto(doTipo(t(), ConfirmarAcao)[0].props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Será ajustada 1 cobrança desta matrícula");
    expect(consequencia).not.toContain("Sem diferença a aplicar");
  });
});

describe("Reconciliar mesma tentativa no preparo e na decisão (R2 da #154, B11)", () => {
  // Campos do formulário enviado (FormData simulado: o teste roda sem DOM).
  const CAMPOS = new Map<string, string>([["motivo", "Fato posterior conferido."], ["decisao", "aprovar"]]);
  class DadosFormulario {
    get(nome: string): string | null { return CAMPOS.get(nome) ?? null; }
  }
  const esvaziar = () => new Promise((r: (v: unknown) => void) => setTimeout(r, 0));
  const enviar = async (t: ReactNode) => {
    const formulario = elementos(t).find((n: No) => n.type === "form")!;
    (formulario.props.onSubmit as (e: { preventDefault: () => void; currentTarget: object }) => void)({ preventDefault: () => {}, currentTarget: {} });
    await esvaziar();
  };
  /** O botão "Reconciliar mesma tentativa" (filho ReconciliarTentativaDelta, chamado como função). */
  const reconciliar = (t: ReactNode): ReactNode => expandir(elementos(t).find((n: No) => typeof n.type === "function" && "op" in n.props && !("aoReconciliar" in n.props))!);

  beforeEach(() => { vi.stubGlobal("FormData", DadosFormulario); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("preparo incerto: reconciliar reenvia a MESMA tentativa (mesmos dados e mesma chave)", async () => {
    m.prepararDelta.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true });
    const tela = (): ReactNode => m.ganchos!.renderizar(PrepararReconferenciaDeltaFormulario, { aplicacaoBaseId: "base-1" });
    await enviar(tela());
    expect(m.prepararDelta).toHaveBeenCalledTimes(1);
    await clicar(reconciliar(tela()), "Reconciliar mesma tentativa");
    expect(m.prepararDelta).toHaveBeenCalledTimes(2);
    expect(m.prepararDelta.mock.calls[1][0]).toEqual(m.prepararDelta.mock.calls[0][0]);
    expect(m.prepararDelta.mock.calls[0][0]).toMatchObject({ aplicacaoBaseId: "base-1", motivo: "Fato posterior conferido." });
  });

  it("decisão incerta: reconciliar reenvia a MESMA decisão (mesma chave)", async () => {
    m.decidirDelta.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true });
    const tela = (): ReactNode => m.ganchos!.renderizar(DecidirReconferenciaDeltaFormulario, { propostaId: "p-1", fotografiaHash: "h-1", administrativo: false });
    await enviar(tela());
    expect(m.decidirDelta).toHaveBeenCalledTimes(1);
    await clicar(reconciliar(tela()), "Reconciliar mesma tentativa");
    expect(m.decidirDelta).toHaveBeenCalledTimes(2);
    expect(m.decidirDelta.mock.calls[1][0]).toEqual(m.decidirDelta.mock.calls[0][0]);
    expect(m.decidirDelta.mock.calls[0][0]).toMatchObject({ propostaId: "p-1", aprovada: true });
  });
});

describe("feedback separado nos formulários do acerto e da reconferência (#153: erro em role=\"alert\", sucesso em role=\"status\")", () => {
  const CAMPOS = new Map<string, string>([["motivo", "Fato posterior conferido."], ["decisao", "aprovar"]]);
  class DadosFormulario {
    get(nome: string): string | null { return CAMPOS.get(nome) ?? null; }
  }
  beforeEach(() => { vi.stubGlobal("FormData", DadosFormulario); });
  afterEach(() => { vi.unstubAllGlobals(); });

  /** Envia o formulário da tela atual e devolve a promessa do handler. */
  const enviarDe = (tela: () => ReactNode) => () => {
    const formulario = elementos(tela()).find((n: No) => n.type === "form")!;
    return (formulario.props.onSubmit as (e: { preventDefault: () => void; currentTarget: object }) => Promise<void>)({ preventDefault: () => {}, currentTarget: {} });
  };
  /** O botão de envio mostra o rótulo de ocupado? */
  const rotuloOcupado = (tela: () => ReactNode, rotulo: string) => () =>
    elementos(tela()).some((n: No) => n.type === "button" && texto(n.props.children).trim() === rotulo);

  const acertoPreparar = (): ReactNode => m.ganchos!.renderizar(PrepararAcertoContratualFormulario, { pedidoId: "ped-1", condicoesId: "cond-1", reapresentacao: null });
  contratoFeedbackSeparado({
    nome: "acerto \u00b7 preparar memória",
    preparar: () => { m.ganchos = criarGanchos(); },
    tela: acertoPreparar,
    acionar: enviarDe(acertoPreparar),
    action: m.prepararAcerto,
    sucesso: "Memória contratual preparada. Outra pessoa autorizada deve decidir.",
    incerto: MSG_RESULTADO_INCERTO,
    ocupado: rotuloOcupado(acertoPreparar, "Preparando\u2026"),
  });

  const acertoDecidir = (): ReactNode => m.ganchos!.renderizar(DecidirAcertoContratualFormulario, { propostaId: "prop-1", fotografiaHash: "h-1" });
  contratoFeedbackSeparado({
    nome: "acerto \u00b7 decisão independente",
    preparar: () => { m.ganchos = criarGanchos(); },
    tela: acertoDecidir,
    acionar: enviarDe(acertoDecidir),
    action: m.decidirAcerto,
    sucesso: "Decisão independente registrada.",
    incerto: MSG_RESULTADO_INCERTO,
    ocupado: rotuloOcupado(acertoDecidir, "Registrando\u2026"),
  });

  const deltaPreparar = (): ReactNode => m.ganchos!.renderizar(PrepararReconferenciaDeltaFormulario, { aplicacaoBaseId: "base-1" });
  contratoFeedbackSeparado({
    nome: "reconferência \u00b7 preparar",
    preparar: () => { m.ganchos = criarGanchos(); },
    tela: deltaPreparar,
    acionar: enviarDe(deltaPreparar),
    action: m.prepararDelta,
    sucesso: "Reconferência preparada. As decisões financeira e administrativa são independentes.",
    incerto: MSG_RESULTADO_INCERTO,
    ocupado: rotuloOcupado(deltaPreparar, "Preparando\u2026"),
  });

  const deltaDecidir = (): ReactNode => m.ganchos!.renderizar(DecidirReconferenciaDeltaFormulario, { propostaId: "p-1", fotografiaHash: "h-1", administrativo: false });
  contratoFeedbackSeparado({
    nome: "reconferência \u00b7 decisão financeira",
    preparar: () => { m.ganchos = criarGanchos(); },
    tela: deltaDecidir,
    acionar: enviarDe(deltaDecidir),
    action: m.decidirDelta,
    sucesso: "Decisão independente registrada.",
    incerto: MSG_RESULTADO_INCERTO,
    ocupado: rotuloOcupado(deltaDecidir, "Registrando\u2026"),
  });

  it("acerto: a chave não troca depois de erro nem de incerto; troca depois do sucesso", async () => {
    m.ganchos = criarGanchos();
    m.prepararAcerto.mockResolvedValueOnce({ ok: false, erro: "Recusado." }).mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true });
    const enviar = enviarDe(acertoPreparar);
    for (let i = 0; i < 4; i++) await enviar();
    const chaves = m.prepararAcerto.mock.calls.map((x: unknown[]) => (x[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(chaves[1]).toBe(chaves[0]);
    expect(chaves[2]).toBe(chaves[0]);
    expect(chaves[3]).not.toBe(chaves[2]);
    expect(m.refresh).toHaveBeenCalledTimes(2); // só os dois sucessos releem a página
  });
});

