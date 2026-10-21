import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Propor a retomada com chave de idempotência (#166; #282, C3): o reenvio da mesma tentativa devolve a proposta
// original no status atual. Se outra pessoa já a decidiu, a tela não anuncia uma proposta nova: avisa que ela já
// foi decidida e mantém os dados para uma nova proposta deliberada.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  solicitar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/retomada/acoes", () => ({ solicitarRetomada: m.solicitar, decidirRetomada: vi.fn() }));

import { RetomadasPainel } from "./RetomadasPainel";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { CampoTexto } from "@/components/CampoTexto";
import { criarGanchos, elementos, formularios, type No } from "@/test/tela-sem-dom";

type Props = Parameters<typeof RetomadasPainel>[0];
const MOTIVO = "Aluno volta das férias";
const contexto = {
  alunoId: "aluno-1", alunoNome: "Ana", status: "PAUSADO", dataMinimaReprogramacao: "2026-10-21",
  pausa: { id: "pausa-1", criadoEm: "2026-09-01T12:00:00.000Z", motivo: "Viagem" },
  propostaPendenteId: null, impedimento: null, parcelas: [],
} as unknown as NonNullable<Props["contexto"]>;
const tela = (): ReactNode => m.ganchos!.renderizar(RetomadasPainel, { contexto, propostas: [], erroConsulta: null, preferenciaFusoExibicao: null });
const sucesso = (t: ReactNode) => elementos(t).filter((n: No) => n.type === FeedbackAcao).map((n: No) => n.props.sucesso).filter(Boolean);
const esvaziar = () => new Promise((r) => setTimeout(r, 0));
const motivoDigitado = () => elementos(tela()).find((n: No) => n.type === CampoTexto)?.props.value;

/** Escolhe manter os vencimentos, digita o motivo e envia. */
async function propor() {
  const manter = elementos(tela()).find((n: No) => n.type === "input" && n.props.value === "MANTER_VENCIMENTOS")!;
  (manter.props.onChange as () => void)();
  const motivo = elementos(tela()).find((n: No) => n.type === CampoTexto)!;
  (motivo.props.onChange as (e: unknown) => void)({ target: { value: MOTIVO } });
  const [form] = formularios(tela());
  await (form.props.onSubmit as (e: unknown) => Promise<unknown>)({ preventDefault() {} });
  await esvaziar();
}

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
});


describe("Retomada — propor", () => {
  it("proposta nova: anuncia o envio, limpa o formulário e recarrega", async () => {
    m.solicitar.mockResolvedValueOnce({ ok: true, dado: { propostaId: "p-1", status: "PENDENTE" } });
    await propor();
    expect(m.solicitar).toHaveBeenCalledWith("aluno-1", expect.objectContaining({ opcao: "MANTER_VENCIMENTOS", motivo: MOTIVO, novosVencimentos: [], chaveIdempotencia: expect.any(String) }));
    expect(sucesso(tela())).toEqual(["Proposta enviada. A retomada e os vencimentos aguardam aprovação de outra pessoa do Financeiro ou da Administração."]);
    expect(motivoDigitado()).toBe("");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["REJEITADA", "rejeitada"],
    ["APROVADA", "aprovada"],
  ])("reenvio de proposta já decidida (%s): avisa, não anuncia envio e mantém os dados", async (status, rotulo) => {
    m.solicitar.mockResolvedValueOnce({ ok: true, dado: { propostaId: "p-1", status } });
    await propor();
    expect(sucesso(tela())).toEqual([`Esta proposta já foi decidida: ${rotulo}. Para uma nova retomada, faça uma nova proposta.`]);
    expect(motivoDigitado()).toBe(MOTIVO);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("depois do aviso, um novo envio é outra tentativa (chave nova)", async () => {
    m.solicitar.mockResolvedValueOnce({ ok: true, dado: { propostaId: "p-1", status: "REJEITADA" } });
    await propor();
    m.solicitar.mockResolvedValueOnce({ ok: true, dado: { propostaId: "p-2", status: "PENDENTE" } });
    await propor();
    const [primeira, segunda] = m.solicitar.mock.calls.map(([, input]) => (input as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(segunda).not.toBe(primeira);
  });
});
