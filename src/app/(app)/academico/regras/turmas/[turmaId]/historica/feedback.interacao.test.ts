import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados na conferência da
// regra histórica — Propor, Revisar e Decidir. A decisão tinha `try/finally` sem `catch` (achado do
// doc 43): a falha de transporte deixava a tela sem resposta. Agora todos os fluxos mostram resultado
// incerto em role="alert" e saem do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  revisar: vi.fn(), propor: vi.fn(), decidir: vi.fn(), validar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/avaliacoes/conferencia-regra-historica", () => ({
  revisarConferenciaRegraHistorica: m.revisar, proporConferenciaRegraHistorica: m.propor, decidirConferenciaRegraHistorica: m.decidir,
}));
// O conteúdo da regra é validado pelo schema real na tela; aqui o teste decide o resultado da validação.
vi.mock("@/server/avaliacoes/regra-schema", () => ({ ConteudoRegraAvaliacaoSchema: { safeParse: m.validar } }));
vi.mock("../../../[nivelId]/ResumoRegra", () => ({ ResumoRegra: () => null }));

import type { ReactNode } from "react";
import { DecidirConferenciaRegraHistorica, PrepararConferenciaRegraHistorica, ProporConferenciaRegraHistorica } from "./ConferenciaRegraHistorica";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { adiada, anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, formularios, submeter, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const fieldsetTravado = (t: ReactNode) => elementos(t).find((n) => n.type === "fieldset")?.props.disabled === true;
const rotuloDoBotao = (t: ReactNode) => texto(elementos(t).find((n) => n.type === "button")?.props.children);

const revisao = {
  destinoId: "regra-2", estadoHash: "a".repeat(64), versaoEsperada: 0,
  destino: { versao: 2, conteudo: {} as never }, encontros: 3, diarios: 2, alocacoes: 1,
};

describe("ProporConferenciaRegraHistorica", () => {
  const tela = () => m.ganchos!.renderizar(ProporConferenciaRegraHistorica, { turmaId: "turma", revisao });
  const enviar = () => submeter(tela(), { motivo: "Ata conferida.", evidencia: "Ata de 2025." });

  contratoFeedbackSeparado({
    nome: "propor conferência", tela, action: m.propor, acionar: enviar,
    sucesso: "Conferência registrada para decisão independente.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => rotuloDoBotao(tela()) === "Registrando…" && fieldsetTravado(tela()),
  });

  it("reenvia a mesma chave depois da falha; alterar o formulário limpa a mensagem e troca a chave", async () => {
    m.propor.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await enviar();
    m.propor.mockResolvedValueOnce({ ok: false, erro: "Recusada." });
    await enviar();
    const chaves = () => m.propor.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(chaves()[1]).toBe(chaves()[0]);
    expect(m.propor.mock.calls[0][0]).toMatchObject({ turmaId: "turma", destinoId: "regra-2", versaoEsperada: 0, motivo: "Ata conferida.", evidencia: "Ata de 2025." });
    expect(anuncios(tela()).alerta).toEqual(["Recusada."]);

    (formularios(tela())[0].props.onChange as () => void)();
    expect(anuncios(tela())).toEqual({ alerta: [], status: [] });
    m.propor.mockResolvedValueOnce({ ok: true });
    await enviar();
    expect(chaves()[2]).not.toBe(chaves()[0]);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("DecidirConferenciaRegraHistorica", () => {
  const tela = () => m.ganchos!.renderizar(DecidirConferenciaRegraHistorica, { propostaId: "proposta", estadoHash: "b".repeat(64), podeAprovar: true });
  const decidir = () => submeter(tela(), { decisao: "aprovar", motivo: "Conferida." });

  contratoFeedbackSeparado({
    nome: "registrar decisão da conferência", tela, action: m.decidir, acionar: decidir,
    sucesso: "Decisão registrada.", incerto: MSG_DECISAO_INCERTA,
    ocupado: () => fieldsetTravado(tela()),
  });

  it("falha de transporte (antes sem catch): a promessa do envio resolve, o alerta aparece e a tela sai do ocupado", async () => {
    const pendente = adiada<unknown>();
    m.decidir.mockReturnValueOnce(pendente.promessa);
    const envio = decidir() as Promise<unknown>;
    expect(fieldsetTravado(tela())).toBe(true);
    pendente.rejeitar(new TypeError("Failed to fetch"));
    await expect(envio).resolves.toBeUndefined();
    expect(fieldsetTravado(tela())).toBe(false);
    expect(anuncios(tela())).toEqual({ alerta: [MSG_DECISAO_INCERTA], status: [] });
    expect(m.decidir).toHaveBeenCalledWith({ propostaId: "proposta", estadoHash: "b".repeat(64), aprovada: true, motivo: "Conferida." });
    expect(m.refresh).not.toHaveBeenCalled();
  });
});

describe("PrepararConferenciaRegraHistorica", () => {
  const tela = () => m.ganchos!.renderizar(PrepararConferenciaRegraHistorica, { turmaId: "turma", destinos: [{ id: "regra-1", versao: 1 }, { id: "regra-2", versao: 2 }] });
  const escolher = (valor: string) =>
    (elementos(tela()).find((n) => n.type === "select")!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });
  const revisar = () => submeter(tela());
  const dadoRevisado = { estadoHash: "a".repeat(64), versaoEsperada: 0, turma: {}, destino: { versao: 2, conteudo: { bruto: true } }, encontros: 3, diarios: 2, alocacoes: 1 };
  const temProposta = () => elementos(tela()).some((n) => n.type === ProporConferenciaRegraHistorica);

  it("sem versão escolhida: alerta local, sem chamar a action", async () => {
    await revisar();
    expect(m.revisar).not.toHaveBeenCalled();
    expect(anuncios(tela())).toEqual({ alerta: ["Selecione uma versão publicada."], status: [] });
  });

  it("revisão válida apresenta a proposta, sem alerta; trocar a versão a recolhe e limpa a mensagem", async () => {
    escolher("regra-2");
    m.revisar.mockResolvedValueOnce({ ok: true, dado: dadoRevisado });
    m.validar.mockReturnValueOnce({ success: true, data: { validado: true } });
    await revisar();
    expect(m.revisar).toHaveBeenCalledWith({ turmaId: "turma", destinoId: "regra-2" });
    expect(m.validar).toHaveBeenCalledWith({ bruto: true });
    expect(anuncios(tela())).toEqual({ alerta: [], status: [] });
    const proposta = elementos(tela()).find((n) => n.type === ProporConferenciaRegraHistorica)!;
    expect(proposta.props.revisao).toEqual({ ...revisao, destino: { versao: 2, conteudo: { validado: true } } });
    escolher("regra-1");
    expect(temProposta()).toBe(false);
  });

  it("erro do servidor sai em role=\"alert\" e não apresenta proposta", async () => {
    escolher("regra-2");
    m.revisar.mockResolvedValueOnce({ ok: false, erro: "A turma já possui regra vinculada." });
    await revisar();
    expect(anuncios(tela())).toEqual({ alerta: ["A turma já possui regra vinculada."], status: [] });
    expect(temProposta()).toBe(false);
  });

  it("conteúdo inválido sai em role=\"alert\"", async () => {
    escolher("regra-2");
    m.revisar.mockResolvedValueOnce({ ok: true, dado: dadoRevisado });
    m.validar.mockReturnValueOnce({ success: false });
    await revisar();
    expect(anuncios(tela())).toEqual({ alerta: ["A revisão retornou conteúdo inválido."], status: [] });
    expect(temProposta()).toBe(false);
  });

  it("falha de rede: alerta próprio da revisão e o botão sai do ocupado", async () => {
    escolher("regra-2");
    const pendente = adiada<unknown>();
    m.revisar.mockReturnValueOnce(pendente.promessa);
    const envio = revisar();
    expect(rotuloDoBotao(tela())).toBe("Revisando…");
    expect(fieldsetTravado(tela())).toBe(true);
    pendente.rejeitar(new TypeError("Failed to fetch"));
    await envio;
    expect(rotuloDoBotao(tela())).toBe("Revisar");
    expect(fieldsetTravado(tela())).toBe(false);
    expect(anuncios(tela())).toEqual({ alerta: ["A revisão não foi confirmada."], status: [] });
    expect(temProposta()).toBe(false);
  });
});
