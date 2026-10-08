import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42, E3): erro e sucesso separados nos formulários do
// aditivo contratual — erro em role="alert", sucesso em role="status", falha de rede como resultado
// incerto e o botão saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  refresh: vi.fn(), push: vi.fn(),
  proporAcerto: vi.fn(), conferenciaAssinatura: vi.fn(), aplicarCondicoes: vi.fn(), formalizarCondicoes: vi.fn(),
  conferenciaFinal: vi.fn(), prepararAditivo: vi.fn(), decidirAditivo: vi.fn(), impactos: vi.fn(), preservarOriginal: vi.fn(),
  conferirParticipantes: vi.fn(), consultarParticipantes: vi.fn(), processo: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
    // PrepararAditivo: id dos campos e fuso do navegador.
    useId: (() => "teste") as unknown as typeof real.useId,
    useSyncExternalStore: (() => "UTC") as unknown as typeof real.useSyncExternalStore,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: m.push }) }));
vi.mock("@/server/contratos/aditivo-acerto-taxa-acoes", () => ({ proporAcertoTaxaAditivo: m.proporAcerto }));
vi.mock("@/server/contratos/aditivo-assinatura", () => ({ registrarConferenciaAssinaturaAditivo: m.conferenciaAssinatura }));
vi.mock("@/server/contratos/aditivo-condicoes", () => ({ aplicarCondicoesFormalizadasAditivo: m.aplicarCondicoes, formalizarEAplicarCondicoesAditivo: m.formalizarCondicoes }));
vi.mock("@/server/contratos/aditivo-conferencia-final", () => ({ registrarConferenciaFinalAditivo: m.conferenciaFinal }));
vi.mock("@/server/contratos/aditivos", () => ({ prepararAditivoContratual: m.prepararAditivo, decidirAditivoContratual: m.decidirAditivo }));
vi.mock("@/server/contratos/aditivo-taxa-impactos", () => ({ prepararImpactosTaxaAditivo: m.impactos }));
vi.mock("@/server/contratos/aditivo-originais", () => ({ preservarOriginalAditivo: m.preservarOriginal }));
vi.mock("@/server/contratos/aditivo-participantes", () => ({ conferirParticipantesAditivo: m.conferirParticipantes, consultarFormularioParticipantesAditivo: m.consultarParticipantes }));
vi.mock("@/server/contratos/aditivo-envio", () => ({ prepararProcessoAssinaturaAditivo: m.processo }));

import { AcertoTaxaFormulario } from "./AcertoTaxaFormulario";
import { AssinaturaFormulario } from "./AssinaturaFormulario";
import { CondicoesFormalizadasFormulario } from "./CondicoesFormalizadasFormulario";
import { ConferenciaFinalFormulario } from "./ConferenciaFinalFormulario";
import { DecidirAditivo, PrepararAditivo } from "./Formularios";
import { ImpactosTaxaFormulario } from "./ImpactosTaxaFormulario";
import { OriginalFormulario } from "./OriginalFormulario";
import { ParticipantesFormulario } from "./ParticipantesFormulario";
import { ProcessoFormulario } from "./ProcessoFormulario";
import { ValorEstruturadoCampo } from "./ValorEstruturadoCampo";
import { CampoTexto } from "@/components/CampoTexto";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { adiada, anuncios, contratoFeedbackSeparado, novosAnuncios, type Adiada } from "@/test/feedback-acao";
import { FormDataFalso, botao, clicar, criarGanchos, elementos, formularios, submeter, texto, type No } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

/** O botão está com o rótulo de progresso e travado? */
const botaoOcupado = (t: ReactNode, rotulo: string) =>
  elementos(t).some((n) => n.type === "button" && texto(n.props.children).trim() === rotulo && n.props.disabled === true);
/** Campo controlado: dispara o onChange com o evento mínimo. */
const mudar = (no: No, value: string) => (no.props.onChange as (e: unknown) => void)({ target: { value } });

describe("AcertoTaxaFormulario", () => {
  const props = { matriculaId: "m", propostaAditivoId: "aditivo", conclusaoId: "assinatura", revisaoHash: "hash", cobrancas: [{ id: "taxa", codigo: "C1", moeda: "BRL", valorOriginal: "100", valorNegociado: "100", valorRecebido: "100", valorLiquidadoCredito: "0", saldo: "0", vencimento: "2026-09-01", valorNovo: "80", vencimentoNovo: "2026-10-01", creditoNovo: "20", saldoAposAcerto: "0", pendencia: null }] };
  const tela = () => m.ganchos!.renderizar(AcertoTaxaFormulario, props);
  contratoFeedbackSeparado({
    nome: "propor acerto da taxa", tela, action: m.proporAcerto,
    preparar: () => {
      mudar(elementos(tela()).find((n) => n.type === "select")!, "taxa");
      const [motivo, evidencia] = elementos(tela()).filter((n) => n.type === CampoTexto);
      mudar(motivo, "Motivo conferido");
      mudar(evidencia, "Protocolo do acordo");
    },
    acionar: () => clicar(tela(), "Propor acerto"),
    respostaOk: { ok: true, dado: { id: "proposta" } },
    sucesso: "Proposta registrada. Aguarda conferência de outra pessoa autorizada.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => botaoOcupado(tela(), "Registrando proposta…"),
  });
});

describe("AssinaturaFormulario", () => {
  const tela = () => m.ganchos!.renderizar(AssinaturaFormulario, { matriculaId: "m", propostaId: "p", artefatoId: "a", revisaoHash: "h" });
  contratoFeedbackSeparado({
    nome: "registrar conferência do original", tela, action: m.conferenciaAssinatura,
    acionar: () => submeter(tela(), { motivo: "PDF conferido" }),
    sucesso: "Conferência do original registrada.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => botaoOcupado(tela(), "Registrando…"),
  });
});

describe("CondicoesFormalizadasFormulario", () => {
  const props = { matriculaId: "m", propostaId: "p", conclusaoId: "c", revisaoHash: "h" };
  const tela = () => m.ganchos!.renderizar(CondicoesFormalizadasFormulario, props);
  contratoFeedbackSeparado({
    nome: "formalizar e aplicar condições", tela, action: m.formalizarCondicoes,
    acionar: () => submeter(tela()),
    sucesso: "Condições aplicadas na vigência indicada. Cobranças já emitidas foram preservadas.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => botaoOcupado(tela(), "Registrando…"),
  });
  const telaFormalizada = () => m.ganchos!.renderizar(CondicoesFormalizadasFormulario, { ...props, formalizada: true });
  contratoFeedbackSeparado({
    nome: "regularizar aplicação já formalizada", tela: telaFormalizada, action: m.aplicarCondicoes,
    acionar: () => submeter(telaFormalizada()),
    sucesso: "Condições aplicadas na vigência indicada. Cobranças já emitidas foram preservadas.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => botaoOcupado(telaFormalizada(), "Registrando…"),
  });
});

describe("ConferenciaFinalFormulario", () => {
  const tela = () => m.ganchos!.renderizar(ConferenciaFinalFormulario, { matriculaId: "m", propostaId: "p", conclusaoId: "c", revisaoHash: "h" });
  contratoFeedbackSeparado({
    nome: "registrar conferência interna", tela, action: m.conferenciaFinal,
    acionar: () => submeter(tela(), { documento: "on", evidencias: "on", motivo: "Conferência final" }),
    sucesso: "Conferência interna registrada.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => botaoOcupado(tela(), "Registrando…"),
  });
  it("sem as confirmações: aviso em role=\"alert\" e nada vai ao servidor", async () => {
    const antes = anuncios(tela());
    await submeter(tela(), { motivo: "Conferência final" });
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Confirme o documento e as evidências preservadas."], status: [] });
    expect(m.conferenciaFinal).not.toHaveBeenCalled();
  });
});

describe("PrepararAditivo", () => {
  const props = {
    matriculaId: "matricula",
    fonte: { conclusaoId: "assinatura", conclusaoHash: "a".repeat(64), campos: [{ origem: "ALUNO_NOME" as const, rotulo: "Nome do aluno", anterior: "Anterior" }] },
    modelos: [{ id: "modelo", codigo: "AD", versao: 1, modeloHash: "b".repeat(64), titulo: "Modelo" }],
  };
  const tela = () => m.ganchos!.renderizar(PrepararAditivo, props);
  const preparar = () => {
    mudar(elementos(tela()).find((n) => n.type === "select" && n.props.id === "teste-modelo")!, "modelo");
    (elementos(tela()).find((n) => n.type === ValorEstruturadoCampo)!.props.onChange as (v: unknown) => void)({ tipo: "TEXT", texto: "Nome corrigido" });
  };
  const acionar = () => submeter(tela(), { vigencia: "2026-10-01T10:00", motivo: "Ajuste contratual conferido", "alterar:ALUNO_NOME": "on" });
  const ERRO = "Modelo superado: escolha a versão vigente.";

  it("erro do servidor sai em role=\"alert\" e não navega", async () => {
    preparar();
    const antes = anuncios(tela());
    m.prepararAditivo.mockResolvedValueOnce({ ok: false, erro: ERRO });
    await acionar();
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: [ERRO], status: [] });
    expect(m.push).not.toHaveBeenCalled();
  });

  it("sucesso navega para a proposta registrada, sem alerta", async () => {
    preparar();
    const antes = anuncios(tela());
    m.prepararAditivo.mockResolvedValueOnce({ ok: true, dado: { id: "proposta" } });
    await acionar();
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: [], status: [] });
    expect(m.push).toHaveBeenCalledWith("/matriculas/matricula/contrato/aditivos/proposta");
  });

  it("falha de rede vira resultado incerto em role=\"alert\"; a repetição usa a mesma chave", async () => {
    preparar();
    const antes = anuncios(tela());
    m.prepararAditivo.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await acionar();
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: [MSG_RESULTADO_INCERTO], status: [] });
    m.prepararAditivo.mockResolvedValueOnce({ ok: true, dado: { id: "proposta" } });
    await acionar();
    expect(m.prepararAditivo.mock.calls[1][0].chaveIdempotencia).toBe(m.prepararAditivo.mock.calls[0][0].chaveIdempotencia);
  });

  it("ocupado enquanto a action roda; sai do ocupado depois de erro, falha e sucesso", async () => {
    preparar();
    expect(botaoOcupado(tela(), "Registrando…")).toBe(false);
    const desfechos: [string, (p: Adiada<unknown>) => void][] = [
      ["erro", (p) => p.resolver({ ok: false, erro: ERRO })],
      ["falha", (p) => p.rejeitar(new TypeError("Failed to fetch"))],
      ["sucesso", (p) => p.resolver({ ok: true, dado: { id: "proposta" } })],
    ];
    for (const [nome, concluir] of desfechos) {
      const pendente = adiada<unknown>();
      m.prepararAditivo.mockReturnValueOnce(pendente.promessa);
      const execucao = acionar();
      expect(botaoOcupado(tela(), "Registrando…"), `durante (${nome})`).toBe(true);
      concluir(pendente);
      await execucao;
      expect(botaoOcupado(tela(), "Registrando…"), `depois (${nome})`).toBe(false);
    }
  });

  it("validação local sai em role=\"alert\" e nada vai ao servidor", async () => {
    const antes = anuncios(tela());
    await acionar();
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Selecione o modelo, a vigência e ao menos uma condição com novo valor."], status: [] });
    expect(m.prepararAditivo).not.toHaveBeenCalled();
  });
});

describe("DecidirAditivo", () => {
  const tela = () => m.ganchos!.renderizar(DecidirAditivo, { propostaId: "p", propostaHash: "h", superada: false });
  contratoFeedbackSeparado({
    nome: "registrar decisão administrativa", tela, action: m.decidirAditivo,
    acionar: () => submeter(tela(), { decisao: "aprovar", motivo: "Proposta conferida" }),
    sucesso: "Decisão registrada.", incerto: MSG_DECISAO_INCERTA,
    ocupado: () => botaoOcupado(tela(), "Registrando…"),
  });
  it("sem decisão escolhida: aviso em role=\"alert\" e nada vai ao servidor", async () => {
    const antes = anuncios(tela());
    await submeter(tela(), { motivo: "Proposta conferida" });
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Escolha uma decisão."], status: [] });
    expect(m.decidirAditivo).not.toHaveBeenCalled();
  });
});

describe("ImpactosTaxaFormulario", () => {
  const props = { matriculaId: "m", propostaId: "p", conclusaoId: "c", revisaoHash: "h", cobrancas: [{ id: "t1", codigo: "T1", moeda: "BRL", valorNegociado: "100", vencimento: "2026-09-01" }] };
  const tela = () => m.ganchos!.renderizar(ImpactosTaxaFormulario, props);
  contratoFeedbackSeparado({
    nome: "preparar conjunto de impactos", tela, action: m.impactos,
    preparar: () => mudar(elementos(tela()).find((n) => n.type === CampoTexto)!, "Taxa afetada pelo aditivo"),
    acionar: () => clicar(tela(), "Preparar conjunto de impactos"),
    sucesso: "Conjunto preparado. O Financeiro deve vincular os acertos das taxas afetadas antes da aprovação independente.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => botaoOcupado(tela(), "Preparando…"),
  });
});

describe("OriginalFormulario", () => {
  const tela = () => m.ganchos!.renderizar(OriginalFormulario, { matriculaId: "m", propostaId: "p", conferencia: { id: "c", versao: 2, revisaoHash: "h" } });
  contratoFeedbackSeparado({
    nome: "gerar e preservar original do aditivo", tela, action: m.preservarOriginal,
    acionar: () => submeter(tela(), { motivo: "Texto conferido" }),
    sucesso: "Original do aditivo preservado. Consulte o PDF abaixo.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => botaoOcupado(tela(), "Gerando…"),
  });
});

describe("ParticipantesFormulario", () => {
  const formulario = {
    propostaHash: "p".repeat(64), versaoEsperada: 3, paginaDocumentos: 1, temProxima: false, documentos: [], plano: { pendencias: [] },
    participantesSugeridos: [{ papel: "ALUNO", etapa: "CLIENTE", automatico: true, identidade: { nome: "Ana", email: "ana@exemplo.com", documento: "123" } }],
  };
  const tela = () => m.ganchos!.renderizar(ParticipantesFormulario, { matriculaId: "m", propostaId: "p" });
  const CONSULTAR = "Consultar exigências e participantes";

  contratoFeedbackSeparado({
    nome: "registrar conferência dos signatários", tela, action: m.conferirParticipantes,
    preparar: async () => {
      m.consultarParticipantes.mockResolvedValueOnce({ ok: true, dado: formulario });
      await clicar(tela(), CONSULTAR);
    },
    acionar: () => submeter(tela(), { motivo: "Identificações conferidas" }),
    respostaOk: { ok: true, dado: { versao: 4 } },
    sucesso: "Conferência registrada · versão 4.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => botaoOcupado(tela(), "Aguarde…"),
  });

  it("consulta: erro do servidor sai em role=\"alert\"", async () => {
    const antes = anuncios(tela());
    m.consultarParticipantes.mockResolvedValueOnce({ ok: false, erro: "Proposta indisponível nesta matrícula." });
    await clicar(tela(), CONSULTAR);
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Proposta indisponível nesta matrícula."], status: [] });
  });

  it("consulta: falha de rede mantém a mensagem própria da consulta, em role=\"alert\"", async () => {
    const antes = anuncios(tela());
    m.consultarParticipantes.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await clicar(tela(), CONSULTAR);
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Não foi possível consultar os signatários. Tente novamente."], status: [] });
  });

  it("consulta sem dado: aviso em role=\"alert\" e o formulário não abre", async () => {
    const antes = anuncios(tela());
    m.consultarParticipantes.mockResolvedValueOnce({ ok: true, dado: null });
    await clicar(tela(), CONSULTAR);
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Não foi possível carregar a conferência."], status: [] });
    expect(formularios(tela())).toHaveLength(0);
  });

  it("consulta: botão travado enquanto roda; ao concluir abre o formulário sem alerta", async () => {
    const antes = anuncios(tela());
    const pendente = adiada<unknown>();
    m.consultarParticipantes.mockReturnValueOnce(pendente.promessa);
    const execucao = clicar(tela(), CONSULTAR);
    expect(botao(tela(), CONSULTAR).props.disabled).toBe(true);
    pendente.resolver({ ok: true, dado: formulario });
    await execucao;
    expect(formularios(tela())).toHaveLength(1);
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: [], status: [] });
  });
});

describe("ProcessoFormulario", () => {
  const tela = () => m.ganchos!.renderizar(ProcessoFormulario, { matriculaId: "m", propostaId: "p", artefatoId: "a", conferenciaId: "c", ambiente: "SANDBOX" as const });
  contratoFeedbackSeparado({
    nome: "preparar processo de assinatura", tela, action: m.processo,
    preparar: () => mudar(elementos(tela()).find((n) => n.type === "select")!, "ZAPSIGN"),
    acionar: () => submeter(tela()),
    sucesso: "Processo preparado internamente.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => botaoOcupado(tela(), "Preparando…"),
  });
  it("sem fornecedor: aviso em role=\"alert\" e nada vai ao servidor", async () => {
    const antes = anuncios(tela());
    await submeter(tela());
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Selecione o fornecedor."], status: [] });
    expect(m.processo).not.toHaveBeenCalled();
  });
});
