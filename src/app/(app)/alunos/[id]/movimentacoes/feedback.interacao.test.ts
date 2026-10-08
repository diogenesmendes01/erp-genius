import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados na decisão e na
// efetivação do acerto de encerramento e na recomposição de cobertura — erro em role="alert" (a falha
// da efetivação saía como role="status", achado L309), sucesso em role="status", falha de rede como
// resultado incerto e os controles saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  refresh: vi.fn(), atualizar: vi.fn(), atualizarContexto: vi.fn(),
  decidirAcerto: vi.fn(), efetivar: vi.fn(),
  consultarRascunho: vi.fn(), salvarRascunho: vi.fn(), prever: vi.fn(), conferirValidade: vi.fn(), decidirRecomposicao: vi.fn(), aplicar: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: vi.fn() }) }));
vi.mock("@/server/matricula/encerramento-decisao", () => ({ decidirAcertoEncerramento: m.decidirAcerto }));
vi.mock("@/server/matricula/encerramento-efetivar", () => ({ efetivarAcertoEncerramento: m.efetivar }));
vi.mock("@/server/matricula/recomposicao-previa", () => ({ preverRecomposicaoCobertura: m.prever }));
vi.mock("@/server/matricula/recomposicao-rascunho", () => ({ consultarRascunhoRecomposicao: m.consultarRascunho, salvarRascunhoRecomposicao: m.salvarRascunho }));
vi.mock("@/server/matricula/recomposicao-validade", () => ({ conferirValidadeRascunhoRecomposicao: m.conferirValidade }));
vi.mock("@/server/matricula/recomposicao-decisao", () => ({ decidirRecomposicaoCobertura: m.decidirRecomposicao }));
vi.mock("@/server/matricula/recomposicao-aplicar", () => ({ aplicarRecomposicaoCobertura: m.aplicar }));

import { DecisaoAcerto } from "./DecisaoAcerto";
import { EfetivarAcerto } from "./EfetivarAcerto";
import { RecomposicaoPainel } from "./RecomposicaoPainel";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado, novosAnuncios } from "@/test/feedback-acao";
import { FormDataFalso, botao, clicar, criarGanchos, elementos, submeter, temBotao } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const fieldsetTravado = (t: ReactNode) => elementos(t).find((n) => n.type === "fieldset")?.props.disabled === true;

describe("DecisaoAcerto", () => {
  const tela = () => m.ganchos!.renderizar(DecisaoAcerto, { alunoId: "aluno", rascunhoId: "rascunho" });
  const acionar = () => submeter(tela(), { decisao: "aprovar", motivo: "Acerto conferido com o contrato.", retro: "on" });
  contratoFeedbackSeparado({
    nome: "registrar decisão do acerto", tela, action: m.decidirAcerto, acionar,
    sucesso: "Decisão registrada. Atualize a conferência para consultar o histórico. Encerramento ainda não efetivado.",
    // A decisão conserva a própria mensagem de incerteza (reenviar a mesma decisão).
    incerto: MSG_DECISAO_INCERTA,
    ocupado: () => fieldsetTravado(tela()),
  });

  it("envia a decisão e as autorizações lidas do formulário", async () => {
    m.decidirAcerto.mockResolvedValueOnce({ ok: true });
    await acionar();
    expect(m.decidirAcerto).toHaveBeenCalledWith({ alunoId: "aluno", rascunhoId: "rascunho", aprovar: true, motivo: "Acerto conferido com o contrato.", autorizaRetroatividade: true, autorizaExcecaoMulta: false });
  });
});

describe("EfetivarAcerto", () => {
  const tela = () => m.ganchos!.renderizar(EfetivarAcerto, { alunoId: "aluno", decisaoId: "decisao", atualizar: m.atualizar });
  const acionar = () => clicar(tela(), "Efetivar encerramento aprovado");
  contratoFeedbackSeparado({
    nome: "efetivar encerramento", tela, action: m.efetivar, acionar,
    sucesso: "Encerramento efetivado.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => temBotao(tela(), "Efetivando…") && botao(tela(), "Efetivando…").props.disabled === true,
  });

  it("atualiza a ficha e a página só depois do sucesso", async () => {
    m.efetivar.mockResolvedValueOnce({ ok: false, erro: "Decisão revogada." });
    await acionar();
    m.efetivar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await acionar();
    expect(m.atualizar).not.toHaveBeenCalled();
    expect(m.refresh).not.toHaveBeenCalled();
    m.efetivar.mockResolvedValueOnce({ ok: true });
    await acionar();
    expect(m.atualizar).toHaveBeenCalledTimes(1);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("RecomposicaoPainel", () => {
  type Props = Parameters<typeof RecomposicaoPainel>[0];
  const contexto = { alunoId: "aluno", matriculaId: "matricula", cobrancas: [], compensacoes: [] } as unknown as Props["contexto"];
  const tela = () => m.ganchos!.renderizar(RecomposicaoPainel, { contexto, usuarioId: "usuario", podeAprovar: false, atualizarContexto: m.atualizarContexto });
  const rascunho = { id: "rascunho", versao: 1, preparador: { id: "outro", nome: "Ana" }, snapshot: {}, decisao: null };
  /** Consulta o rascunho (a tela só mostra as ações sobre ele depois disso). */
  const carregar = async (dado: unknown) => {
    m.consultarRascunho.mockResolvedValue({ ok: true, dado });
    m.atualizarContexto.mockResolvedValue(undefined);
    await clicar(tela(), "Consultar rascunho de recomposição");
  };

  describe("conferir atualidade", () => {
    contratoFeedbackSeparado({
      nome: "conferir atualidade do rascunho", preparar: () => carregar(rascunho), tela, action: m.conferirValidade,
      respostaOk: { ok: true, dado: { atual: true, motivos: [] } },
      acionar: () => clicar(tela(), "Conferir atualidade"),
      sucesso: "Origens atuais conferidas. Isso não aprova a proposta.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
      ocupado: () => botao(tela(), "Conferir atualidade").props.disabled === true,
    });

    it("rascunho desatualizado: os motivos são o resultado da conferência (status); sem resposta, erro em alerta", async () => {
      await carregar(rascunho);
      let antes = anuncios(tela());
      m.conferirValidade.mockResolvedValueOnce({ ok: true, dado: { atual: false, motivos: ["Existe uma versão mais recente da recomposição."] } });
      await clicar(tela(), "Conferir atualidade");
      expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: [], status: ["Existe uma versão mais recente da recomposição."] });
      antes = anuncios(tela());
      m.conferirValidade.mockResolvedValueOnce({ ok: true });
      await clicar(tela(), "Conferir atualidade");
      expect(anuncios(tela())).toEqual({ alerta: ["Conferência indisponível."], status: [] });
      expect(antes.alerta).toEqual([]);
    });
  });

  describe("aplicar programação aprovada", () => {
    const aprovado = { ...rascunho, decisao: { id: "decisao", aprovada: true, aplicacao: null, decisor: { nome: "Bia" }, motivo: "Proposta conferida." } };
    contratoFeedbackSeparado({
      nome: "aplicar programação", preparar: () => carregar(aprovado), tela, action: m.aplicar,
      acionar: () => clicar(tela(), "Aplicar programação aprovada"),
      sucesso: "Programação aplicada. Atualize as compensações para ver as datas. Cumprimento ainda não confirmado.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
      ocupado: () => botao(tela(), "Aplicar programação aprovada").props.disabled === true,
    });

    it("recarrega o rascunho e o contexto só depois de aplicar", async () => {
      await carregar(aprovado);
      m.consultarRascunho.mockClear();
      m.aplicar.mockResolvedValueOnce({ ok: false, erro: "Decisão já aplicada por outra pessoa." });
      await clicar(tela(), "Aplicar programação aprovada");
      expect(m.consultarRascunho).not.toHaveBeenCalled();
      expect(m.atualizarContexto).not.toHaveBeenCalled();
      m.aplicar.mockResolvedValueOnce({ ok: true });
      await clicar(tela(), "Aplicar programação aprovada");
      expect(m.aplicar).toHaveBeenLastCalledWith({ alunoId: "aluno", matriculaId: "matricula", decisaoId: "decisao" });
      expect(m.consultarRascunho).toHaveBeenCalledTimes(1);
      expect(m.atualizarContexto).toHaveBeenCalledTimes(1);
    });
  });

  it("consulta que falha no servidor sai em alerta junto do botão de consulta", async () => {
    const antes = anuncios(tela());
    m.consultarRascunho.mockResolvedValueOnce({ ok: false, erro: "Matrícula sem recomposição disponível." });
    await clicar(tela(), "Consultar rascunho de recomposição");
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Matrícula sem recomposição disponível."], status: [] });
  });

  it("proposta incompleta: a validação local sai em alerta e a prévia não é pedida", async () => {
    await carregar(null);
    const antes = anuncios(tela());
    await submeter(tela(), {});
    expect(m.prever).not.toHaveBeenCalled();
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({
      alerta: ["Confira as datas, selecione os direitos e preencha motivo e evidência com ao menos cinco caracteres."], status: [],
    });
  });
});
