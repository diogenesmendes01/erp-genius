import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Aplicar acerto e reconferência delta (docs/42 L799): "as duas ações mais irreversíveis da área" agora
// revelam o resumo (cobranças ajustadas, crédito criado) num ConfirmarAcao que exige "Confirmo os valores
// acima"; só a confirmação chama a action, com a chave de idempotência estável do formulário.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  aplicarAcerto: vi.fn(), aplicarDelta: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/matricula/desistencia-acerto-contratual", () => ({ prepararAcertoDesistenciaContratual: vi.fn(), decidirAcertoDesistenciaContratual: vi.fn() }));
vi.mock("@/server/matricula/desistencia-acerto-aplicacao", () => ({ aplicarAcertoDesistenciaContratual: m.aplicarAcerto }));
vi.mock("@/server/matricula/desistencia-reconferencia-delta", () => ({
  prepararReconferenciaDeltaDesistencia: vi.fn(), decidirReconferenciaDeltaDesistencia: vi.fn(),
  decidirAdministrativamenteReconferenciaDeltaDesistencia: vi.fn(), aplicarReconferenciaDeltaDesistencia: m.aplicarDelta,
}));

import { AplicarAcertoContratualFormulario, resumoAplicacaoAcerto } from "./AcertoContratualFormularios";
import { AplicarReconferenciaDeltaFormulario, resumoAplicacaoDelta } from "./ReconferenciaDeltaFormularios";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { botao, clicar, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const doTipo = (t: ReactNode, tipo: unknown): No[] => elementos(t).filter((n) => n.type === tipo);
/** Componente filho (ReconciliarTentativaDelta) chamado como função, para achar o botão dele. */
const expandir = (n: No): ReactNode => (n.type as (p: unknown) => ReactNode)(n.props);

const itensAcerto = [
  { cobrancaId: "c1", moeda: "CRC", devido: "50000", saldoDevido: "0", creditoApurado: "12500" },
  { cobrancaId: "c2", moeda: "CRC", devido: "50000", saldoDevido: "50000", creditoApurado: "0" },
];
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
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.aplicarAcerto).toHaveBeenCalledTimes(1);
    expect(m.aplicarAcerto.mock.calls[0][0]).toMatchObject({ decisaoId: "decisao-1" });
  });

  it("a chave é a mesma entre tentativas (incerto) e só troca depois do sucesso", async () => {
    clicar(tela(), "Aplicar acerto aprovado");
    let c = doTipo(tela(), ConfirmarAcao)[0];
    await (c.props.acao as () => Promise<unknown>)();
    (c.props.aoFalhar as (f: unknown) => void)({ tipo: "incerto", mensagem: MSG_RESULTADO_INCERTO });
    c = doTipo(tela(), ConfirmarAcao)[0];
    await (c.props.acao as () => Promise<unknown>)();
    const [primeira, segunda] = m.aplicarAcerto.mock.calls.map((x) => x[0].chaveIdempotencia);
    expect(segunda).toBe(primeira);
    expect(doTipo(tela(), MensagemStatus)[0].props.texto).toBe(MSG_RESULTADO_INCERTO);
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(doTipo(t, MensagemStatus)[0].props.texto).toBe("Acerto aplicado. A Secretaria pode efetivar a desistência.");
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
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.aplicarDelta).toHaveBeenCalledTimes(1);
    expect(m.aplicarDelta.mock.calls[0][0]).toMatchObject({ decisaoFinanceiraId: "df-1" });
  });

  it("resultado incerto: fecha a confirmação, trava o botão e a reconciliação REABRE a confirmação com a mesma chave", async () => {
    clicar(tela(), "Aplicar reconferência");
    let c = doTipo(tela(), ConfirmarAcao)[0];
    await (c.props.acao as () => Promise<unknown>)();
    (c.props.aoFalhar as (f: unknown) => void)({ tipo: "incerto", mensagem: MSG_RESULTADO_INCERTO });
    (c.props.aoCancelar as () => void)();
    let t = tela();
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
    await (c.props.acao as () => Promise<unknown>)();
    (c.props.aoFalhar as (f: unknown) => void)({ tipo: "erro", mensagem: "Decisão revogada." });
    c = doTipo(tela(), ConfirmarAcao)[0];
    await (c.props.acao as () => Promise<unknown>)();
    const [primeira, segunda] = m.aplicarDelta.mock.calls.map((x) => x[0].chaveIdempotencia);
    expect(segunda).not.toBe(primeira);
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(doTipo(t, MensagemStatus)[0].props.texto).toBe("Reconferência aplicada. A Secretaria ainda precisa efetivar a desistência.");
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
});
