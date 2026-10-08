import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3; achado Alta L1671): erro e sucesso separados no
// painel da segunda chamada (proposta, decisão, disponibilização) e no registro de ocorrência — erro em
// role="alert" junto do grupo que disparou a ação, sucesso em role="status", falha de rede como resultado
// incerto, botões saindo do ocupado e o sucesso atualizando a tela com router.refresh (nunca
// window.location.reload). Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  propor: vi.fn(), decidir: vi.fn(), disponibilizar: vi.fn(), ocorrencia: vi.fn(), refresh: vi.fn(), reload: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
    useId: (() => "id-teste") as unknown as typeof real.useId,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: vi.fn() }) }));
vi.mock("@/server/avaliacoes/segunda-chamada", () => ({ proporSegundaChamada: m.propor, decidirSegundaChamada: m.decidir }));
vi.mock("@/server/avaliacoes/segunda-chamada-disponibilizacao", () => ({ disponibilizarSegundaChamada: m.disponibilizar }));
vi.mock("@/server/avaliacoes/segunda-chamada-ocorrencia-local", () => ({ registrarOcorrenciaSegundaChamadaLocal: m.ocorrencia }));

import { SegundaChamadaPainel } from "./SegundaChamadaPainel";
import { FormularioOcorrencia } from "./FormularioOcorrencia";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, botao, criarGanchos, elementos, formularios, submeter, texto } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  vi.stubGlobal("FormData", FormDataFalso);
  // Rede de segurança: se o painel voltasse a recarregar a página, o teste veria a chamada.
  vi.stubGlobal("window", { location: { reload: m.reload } });
});
afterEach(() => { vi.unstubAllGlobals(); });

const HASH = "a".repeat(64);
const itemBase = {
  id: "proposta-1", motivo: "Aluno doente no dia da prova", evidencias: "Atestado médico", criadaEm: "2026-01-01T02:30:00.000Z",
  decisao: null as { aprovada: boolean; motivo: string } | null, podeDecidir: false, propostaHash: HASH as string | null,
  disponibilizacao: null as { id: string; prazoAte: string } | null, reserva: null as { id: string; status: string; encontroId: string | null } | null, podeOperar: false,
};
type ItemPainel = typeof itemBase;
const painel = (itens: ItemPainel[], ativa = true) => () =>
  m.ganchos!.renderizar(SegundaChamadaPainel, { alocacaoId: "alocacao-1", codigoAvaliacao: "A", itens, ativa, fuso: "UTC", fusoEntrada: "UTC" });

const desabilitado = (t: ReactNode, rotulo: string) => botao(t, rotulo).props.disabled === true;
/** O que um trecho da árvore (um formulário, um item) anuncia. */
const anunciosDe = (no: unknown) => anuncios(no as ReactNode);

describe("SegundaChamadaPainel — proposta", () => {
  const tela = painel([{ ...itemBase, podeDecidir: true }]);
  const valores = { motivo: "Aluno doente no dia da prova", evidencias: "Atestado médico anexado" };
  contratoFeedbackSeparado({
    nome: "enviar proposta de segunda chamada", tela, action: m.propor,
    acionar: () => submeter(tela(), valores, 0),
    respostaOk: { ok: true, dado: { id: "proposta-2" } },
    sucesso: "Proposta de segunda chamada enviada.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => desabilitado(tela(), "Enviar proposta") && desabilitado(tela(), "Registrar decisão"),
  });

  it("sucesso chama router.refresh e nunca window.location.reload; reenvio após falha de rede reaproveita a chave", async () => {
    m.propor.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true, dado: { id: "proposta-2" } });
    await submeter(tela(), valores, 0);
    expect(m.refresh).not.toHaveBeenCalled();
    await submeter(tela(), valores, 0);
    const [primeira, segunda] = m.propor.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(primeira).toBeTruthy();
    expect(segunda).toBe(primeira);
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(m.reload).not.toHaveBeenCalled();
  });

  it("depois do sucesso, a mesma entrada vira uma proposta nova (chave nova), como após recarregar a página", async () => {
    m.propor.mockResolvedValueOnce({ ok: true, dado: { id: "proposta-2" } }).mockResolvedValueOnce({ ok: true, dado: { id: "proposta-3" } });
    await submeter(tela(), valores, 0);
    await submeter(tela(), valores, 0);
    const [primeira, segunda] = m.propor.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(segunda).not.toBe(primeira);
  });
});

describe("SegundaChamadaPainel — decisão", () => {
  const tela = painel([{ ...itemBase, podeDecidir: true }]);
  const valores = { aprovada: "sim", motivoDecisao: "Atestado conferido" };
  contratoFeedbackSeparado({
    nome: "registrar decisão da segunda chamada", tela, action: m.decidir,
    acionar: () => submeter(tela(), valores, 1),
    respostaOk: { ok: true, dado: { id: "decisao-1" } },
    sucesso: "Segunda chamada autorizada.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => desabilitado(tela(), "Registrar decisão") && desabilitado(tela(), "Enviar proposta"),
  });

  it("rejeição anuncia a rejeição; o resultado aparece no item decidido, não no formulário da proposta", async () => {
    m.decidir.mockResolvedValueOnce({ ok: false, erro: "A proposta já possui decisão." });
    await submeter(tela(), { aprovada: "nao", motivoDecisao: "Sem evidência suficiente" }, 1);
    const formProposta = formularios(tela())[0];
    const artigo = elementos(tela()).find((n) => n.type === "article");
    expect(anunciosDe(formProposta).alerta).toEqual([]);
    expect(anunciosDe(artigo).alerta).toEqual(["A proposta já possui decisão."]);
    expect(m.decidir.mock.calls[0][0]).toMatchObject({ propostaId: "proposta-1", propostaHash: HASH, aprovada: false });

    m.decidir.mockResolvedValueOnce({ ok: true, dado: { id: "decisao-1" } });
    await submeter(tela(), { aprovada: "nao", motivoDecisao: "Sem evidência suficiente" }, 1);
    expect(anunciosDe(elementos(tela()).find((n) => n.type === "article")).status).toContain("Segunda chamada rejeitada.");
    expect(anunciosDe(formularios(tela())[0])).toEqual({ alerta: [], status: [] });
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(m.reload).not.toHaveBeenCalled();
  });
});

describe("SegundaChamadaPainel — disponibilização", () => {
  const tela = painel([{ ...itemBase, decisao: { aprovada: true, motivo: "Atestado conferido" }, podeOperar: true }], false);
  const valores = { condicoes: "Sala 3, período da manhã", evidencia: "E-mail enviado ao aluno" };
  contratoFeedbackSeparado({
    nome: "disponibilizar segunda chamada", tela, action: m.disponibilizar,
    acionar: () => submeter(tela(), valores, 0),
    respostaOk: { ok: true, dado: { id: "disponibilizacao-1", prazoAte: "2026-10-10T00:00:00.000Z" } },
    sucesso: "Segunda chamada disponibilizada; prazo iniciado.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => desabilitado(tela(), "Disponibilizar e iniciar prazo"),
  });

  it("reenvio da mesma entrada depois de falha de rede preserva o instante da disponibilização", async () => {
    m.disponibilizar.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true, dado: { id: "disponibilizacao-1", prazoAte: "2026-10-10T00:00:00.000Z" } });
    await submeter(tela(), valores, 0);
    await submeter(tela(), valores, 0);
    const [primeira, segunda] = m.disponibilizar.mock.calls.map((c) => (c[0] as { disponibilizadaEm: string }).disponibilizadaEm);
    expect(primeira).toBeTruthy();
    expect(segunda).toBe(primeira);
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(m.reload).not.toHaveBeenCalled();
  });
});

describe("FormularioOcorrencia", () => {
  const tela = () => m.ganchos!.renderizar(FormularioOcorrencia, { reservaId: "reserva-1", fuso: "UTC" });
  const valores = { tipo: "FALTA", dataHoraLocal: "2026-10-01T10:00:00.000", fuso: "UTC", motivo: "Aluno não compareceu", evidencia: "Lista de presença" };
  /** "Registrando…" no botão e o fieldset travado: os dois sinais do ocupado. */
  const ocupadoEm = (t: ReactNode) => {
    const b = elementos(t).find((n) => n.type === "button");
    const fieldset = elementos(t).find((n) => n.type === "fieldset");
    return texto(b?.props.children) === "Registrando…" && fieldset?.props.disabled === true;
  };
  contratoFeedbackSeparado({
    nome: "registrar ocorrência", tela, action: m.ocorrencia,
    acionar: () => submeter(tela(), valores),
    respostaOk: { ok: true, dado: { id: "ocorrencia-1" } },
    sucesso: "Ocorrência registrada.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => ocupadoEm(tela()),
  });

  it("o sucesso atualiza a tela com router.refresh; o erro não", async () => {
    m.ocorrencia.mockResolvedValueOnce({ ok: false, erro: "Reserva já encerrada." }).mockResolvedValueOnce({ ok: true, dado: { id: "ocorrencia-1" } });
    await submeter(tela(), valores);
    expect(m.refresh).not.toHaveBeenCalled();
    await submeter(tela(), valores);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
