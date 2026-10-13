import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Decidir a presença histórica (docs/42 L2499; fatia B, issue #169): a decisão nasce vazia, o botão diz a ação
// escolhida, e aprovar só abre o ConfirmarAcao, que repete aluno, aula e participação; só a confirmação chama a
// action. Rejeitar não toca o diário e continua direto.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  decidir: vi.fn(), refresh: vi.fn(),
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
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/migracao/presenca-historica", () => ({ decidirPresencaHistoricaMigracao: m.decidir, proporPresencaHistoricaMigracao: vi.fn(), resolverDivergenciaPresencaHistoricaMigracao: vi.fn() }));

import { Decidir } from "./PresencaHistorica";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { criarGanchos, elementos, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";

type Proposta = Parameters<typeof Decidir>[0]["proposta"];
const proposta = {
  id: "proposta-1", status: "PENDENTE", participacao: "FALTA", evidencia: {}, snapshot: {}, motivoDecisao: null, preparadorId: "secretaria",
  preparadorNome: "Secretaria", decisorNome: null, aplicacaoId: null, resultado: null, registroExistenteId: null, resolucaoId: null,
  resultadoResolucao: null, resolvedorNome: null, resolvidaEm: null, ocorridaEm: "2025-02-10T13:00:00.000Z", conteudo: "Unidade 3",
  turma: "B1 noite", alunoNome: "Lia Mota", matriculaId: "mat-1",
} as Proposta;
const MOTIVO = "Planilha da origem conferida";
const tela = (): ReactNode => m.ganchos!.renderizar(Decidir, { proposta, podeDecidir: true });
const confirmacoes = (t: ReactNode): No[] => elementos(t).filter((n: No) => n.type === ConfirmarAcao);
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };
const select = (t: ReactNode) => elementos(t).find((n: No) => n.type === "select")!;
const escolher = (valor: string) => (select(tela()).props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });
const preencherMotivo = () => {
  const campo = elementos(tela()).find((n: No) => n.type === "input" && n.props.name === "motivo")!;
  (campo.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: MOTIVO } });
};
const botaoDecidir = (t: ReactNode) => elementos(t).find((n: No) => n.type === "button" && n.props.type === "submit")!;
const enviar = () => (elementos(tela()).find((n: No) => n.type === "form")!.props.onSubmit as (e: { preventDefault(): void }) => unknown)({ preventDefault() {} });
/** Deixa a action (mock) terminar e o handler sair do ocupado. */
const esvaziar = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("chave-1").mockReturnValueOnce("chave-2").mockReturnValue("chave-n") });
  m.decidir.mockResolvedValue({ ok: true, dado: { id: "proposta-1", registroId: "r", repetida: false } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("PresencaHistorica — decidir", () => {
  it("a decisão nasce vazia e o botão, desabilitado, só diz \"Decidir\"; escolher nomeia o botão pela ação", () => {
    let t = tela();
    expect(select(t).props.value).toBe("");
    const opcoes = elementos(select(t)).filter((n: No) => n.type === "option");
    expect(opcoes.map((o: No) => [o.props.value, texto(o.props.children), !!o.props.disabled])).toEqual([["", "Escolha a decisão", true], ["APROVAR", "Aprovar e aplicar", false], ["REJEITAR", "Rejeitar", false]]);
    expect(texto(botaoDecidir(t).props.children)).toBe("Decidir");
    expect(botaoDecidir(t).props.disabled).toBe(true);
    escolher("APROVAR");
    t = tela();
    expect(texto(botaoDecidir(t).props.children)).toBe("Aprovar e aplicar");
    expect(botaoDecidir(t).props.disabled).toBe(false);
    escolher("REJEITAR");
    expect(texto(botaoDecidir(tela()).props.children)).toBe("Rejeitar");
  });

  it("aprovar não aplica; a confirmação repete aluno, aula e participação; só confirmar aplica, uma vez", async () => {
    escolher("APROVAR");
    preencherMotivo();
    enviar();
    expect(m.decidir).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Aprovar e aplicar a presença histórica de Lia Mota?");
    expect(c.props.confirmacao).toBe("aplicação da presença");
    expect(c.props.idempotente).toBe(true);
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Lia Mota fica com Falta na aula de 10/02/2025");
    expect(consequencia).toContain("B1 noite · Unidade 3");
    expect(consequencia).toContain(`Motivo registrado: ${MOTIVO}`);
    expect(consequencia).toContain("Não há desfazer pela tela");
    expect(m.decidir).not.toHaveBeenCalled(); // renderizar a confirmação não executa
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.decidir).toHaveBeenCalledTimes(1);
    expect(m.decidir).toHaveBeenCalledWith({ propostaId: "proposta-1", aprovada: true, motivo: MOTIVO, chaveIdempotencia: "chave-1" });
    (c.props.aoConcluir as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("voltar não aplica", () => {
    escolher("APROVAR");
    preencherMotivo();
    enviar();
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.decidir).not.toHaveBeenCalled();
  });

  it("erro e falha de rede aparecem dentro do diálogo; a nova tentativa reaproveita a mesma chave", async () => {
    escolher("APROVAR");
    preencherMotivo();
    enviar();
    m.decidir.mockResolvedValueOnce({ ok: false, erro: "A origem, mapa, contrato, vínculo ou aula mudou; crie nova proposta." });
    expect(await confirmarNoDialogo(confirmacoes(tela())[0], usar)).toEqual({ erro: "A origem, mapa, contrato, vínculo ou aula mudou; crie nova proposta.", confirmarDisponivel: true });
    m.decidir.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(confirmacoes(tela())[0], usar)).erro).toBe(MSG_RESULTADO_INCERTO);
    expect(m.decidir.mock.calls.map((chamada: unknown[]) => (chamada[0] as { chaveIdempotencia: string }).chaveIdempotencia)).toEqual(["chave-1", "chave-1"]);
    expect(confirmacoes(tela())).toHaveLength(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("rejeitar continua direto, sem confirmação; a falha de rede manda reenviar a mesma decisão", async () => {
    escolher("REJEITAR");
    preencherMotivo();
    m.decidir.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    enviar();
    await esvaziar();
    expect(m.decidir).toHaveBeenCalledWith({ propostaId: "proposta-1", aprovada: false, motivo: MOTIVO, chaveIdempotencia: "chave-1" });
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(texto(elementos(tela()).find((n: No) => n.type === "p" && n.props.role === "alert")?.props.children)).toBe(MSG_DECISAO_INCERTA);
  });

  it("trocar a decisão ou o motivo troca a chave de idempotência", async () => {
    escolher("REJEITAR");
    preencherMotivo();
    enviar();
    await esvaziar();
    escolher("REJEITAR");
    enviar();
    await esvaziar();
    expect(m.decidir.mock.calls.map((chamada: unknown[]) => (chamada[0] as { chaveIdempotencia: string }).chaveIdempotencia)).toEqual(["chave-1", "chave-2"]);
  });
});
