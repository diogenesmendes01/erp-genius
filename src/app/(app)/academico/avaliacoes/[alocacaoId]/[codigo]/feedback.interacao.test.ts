import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados no lançamento e na
// conferência das notas — erro em role="alert", sucesso em role="status", falha de rede como resultado
// incerto e o formulário saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  salvar: vi.fn(), oficializar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/avaliacoes/lancamentos", () => ({ salvarLancamentoAvaliacaoLocal: m.salvar, oficializarLancamentoAvaliacao: m.oficializar }));

import type { ReactNode } from "react";
import { LancarNotas, ConferirNotas } from "./Formularios";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, formularios, submeter, texto, type No } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

/** "Registrando…" no botão e o fieldset travado: os dois sinais do ocupado destes formulários. */
const ocupadoEm = (t: ReactNode) => {
  const botao = elementos(t).find((n) => n.type === "button");
  const fieldset = elementos(t).find((n) => n.type === "fieldset");
  return texto(botao?.props.children) === "Registrando…" && fieldset?.props.disabled === true;
};

describe("LancarNotas", () => {
  const props = {
    alocacaoId: "alocacao", codigoAvaliacao: "final", versaoEsperada: 1, habilidades: ["FALA" as const],
    escala: { minimo: "0", maximo: "10" }, anterior: null, fuso: "UTC", realizadores: [], registradorId: "professor",
  };
  const tela = () => m.ganchos!.renderizar(LancarNotas, props);
  const valores = { realizadaEm: "2026-10-01T10:00", modo: "rascunho", "nota-FALA": "8,5", "comentario-FALA": "Bom" };
  const enviar = () => submeter(tela(), valores);

  contratoFeedbackSeparado({
    nome: "registrar versão", tela, action: m.salvar, acionar: enviar,
    sucesso: "Versão registrada. A submissão exige conferência de outra pessoa da gestão.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => ocupadoEm(tela()),
  });

  it("reenvia a mesma chave depois da falha; alterar o formulário limpa a mensagem e troca a chave", async () => {
    m.salvar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await enviar();
    expect(anuncios(tela()).alerta).toEqual([MSG_RESULTADO_INCERTO]);
    m.salvar.mockResolvedValueOnce({ ok: false, erro: "Recusado." });
    await enviar();
    const [primeira, segunda] = m.salvar.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(segunda).toBe(primeira);
    expect(m.salvar.mock.calls[0][0]).toMatchObject({ notas: [{ habilidade: "FALA", nota: "8.5", comentarioAluno: "Bom" }], submetida: false, realizadaLocal: "2026-10-01T10:00" });
    expect(anuncios(tela()).alerta).toEqual(["Recusado."]);

    (formularios(tela())[0].props.onChange as () => void)();
    expect(anuncios(tela())).toEqual({ alerta: [], status: [] });
    m.salvar.mockResolvedValueOnce({ ok: true });
    await enviar();
    expect((m.salvar.mock.calls[2][0] as { chaveIdempotencia: string }).chaveIdempotencia).not.toBe(primeira);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("sem data de realização não chama a action", async () => {
    await submeter(tela(), { ...valores, realizadaEm: "" });
    expect(m.salvar).not.toHaveBeenCalled();
    expect(ocupadoEm(tela())).toBe(false);
  });
});

describe("ConferirNotas", () => {
  const tela = () => m.ganchos!.renderizar(ConferirNotas, { lancamentoId: "lancamento", conteudoHash: "a".repeat(64), podeAprovar: true });
  contratoFeedbackSeparado({
    nome: "registrar decisão da conferência", tela, action: m.oficializar,
    acionar: () => submeter(tela(), { decisao: "aprovar", motivo: "Notas conferidas." }),
    sucesso: "Decisão registrada.", incerto: MSG_DECISAO_INCERTA,
    ocupado: () => ocupadoEm(tela()),
  });

  it("refresh só depois da decisão registrada", async () => {
    m.oficializar.mockResolvedValueOnce({ ok: false, erro: "Recusada." });
    await submeter(tela(), { decisao: "devolver", motivo: "Revisar notas." });
    expect(m.refresh).not.toHaveBeenCalled();
    m.oficializar.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), { decisao: "devolver", motivo: "Revisar notas." });
    expect(m.oficializar).toHaveBeenLastCalledWith({ lancamentoId: "lancamento", conteudoHash: "a".repeat(64), aprovada: false, motivo: "Revisar notas." });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

// docs/43 §6 item 3 (docs/42 L1314): o fuso de entrada é estado do formulário. Antes, "Aplicar fuso" era um
// <form method="get"> que recarregava a página e remontava o LancarNotas (key com o fuso): as notas sumiam.
describe("LancarNotas — fuso no próprio formulário (sem navegar)", () => {
  const props = {
    alocacaoId: "alocacao", codigoAvaliacao: "final", versaoEsperada: 1, habilidades: ["FALA" as const],
    escala: { minimo: "0", maximo: "10" }, fuso: "UTC", realizadores: [], registradorId: "professor",
    anterior: { realizadaEm: "2026-10-01T02:30:00.000", instante: "2026-10-01T02:30:00.000Z", notas: [] },
  };
  const tela = () => m.ganchos!.renderizar(LancarNotas, props);
  const campo = (nome: string): No => elementos(tela()).find((n) => n.type === "input" && n.props.name === nome)!;
  const digitar = (nome: string, valor: string) => (campo(nome).props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });

  it("trocar o fuso não navega nem remonta: a data da última versão acompanha o fuso e o resto do estado fica", () => {
    expect(campo("fuso").props.value).toBe("UTC");
    expect(campo("realizadaEm").props.value).toBe("2026-10-01T02:30:00.000");
    digitar("fuso", "America/Sao_Paulo");
    expect(campo("fuso").props.value).toBe("America/Sao_Paulo");
    expect(campo("realizadaEm").props.value).toBe("2026-09-30T23:30:00.000");
    expect(texto(elementos(tela()).find((n) => n.type === "label" && texto(n.props.children).startsWith("Data e horário"))?.props.children)).toContain("(America/Sao_Paulo)");
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("a data digitada sobrevive à troca de fuso (não é sobrescrita pela conversão)", () => {
    digitar("realizadaEm", "2026-10-02T10:00");
    digitar("fuso", "America/Costa_Rica");
    expect(campo("realizadaEm").props.value).toBe("2026-10-02T10:00");
    expect(campo("fuso").props.value).toBe("America/Costa_Rica");
  });

  it("envia no fuso escolhido no formulário; fuso inválido não chama a action e diz por quê", async () => {
    digitar("fuso", "America/Costa_Rica");
    m.salvar.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), { realizadaEm: "2026-10-02T10:00", modo: "rascunho", "nota-FALA": "9", "comentario-FALA": "" });
    expect(m.salvar.mock.calls[0][0]).toMatchObject({ fuso: "America/Costa_Rica", realizadaLocal: "2026-10-02T10:00" });
    digitar("fuso", "Lugar/Nenhum");
    await submeter(tela(), { realizadaEm: "2026-10-02T10:00", modo: "rascunho", "nota-FALA": "9", "comentario-FALA": "" });
    expect(m.salvar).toHaveBeenCalledTimes(1);
    expect(campo("fuso").props["aria-invalid"]).toBe(true);
    expect(anuncios(tela()).alerta).toEqual(["Informe um fuso válido, como America/Sao_Paulo ou America/Costa_Rica."]);
  });

  it("depois de salvar, a próxima versão é outra tentativa (chave nova), sem remontar", async () => {
    const valores = { realizadaEm: "2026-10-02T10:00", modo: "rascunho", "nota-FALA": "9", "comentario-FALA": "" };
    m.salvar.mockResolvedValue({ ok: true });
    await submeter(tela(), valores);
    await submeter(tela(), valores);
    const [a, b] = m.salvar.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(b).not.toBe(a);
    expect(m.refresh).toHaveBeenCalledTimes(2);
  });
});
