import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Aprovar replanejamento (docs/42 L1102; fatia B, issue #169): "Aprovar e aplicar conjunto" reescreve as datas
// dos encontros previstos. O botão só abre o ConfirmarAcao, que repete turmas, encontros e exceções
// autorizadas e exige "Conferi…"; só a confirmação chama a action. Rejeitar continua direto.
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
vi.mock("@/server/agenda/replanejamento-decisao", () => ({ decidirEAplicarReplanejamentoConjunto: m.decidir }));

import { DecidirReplanejamento } from "./DecidirReplanejamento";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { CampoTexto } from "@/components/CampoTexto";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { FormDataFalso, criarGanchos, elementos, formularioFalso, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";

const excecoes = [
  { encontroId: "enc-1", codigo: "T-01", inicio: "2026-11-02T12:00:00.000Z", fusoOrigem: "UTC", motivoProposto: "Feriado conferido" },
  { encontroId: "enc-2", codigo: "T-02", inicio: "2026-11-03T12:00:00.000Z", fusoOrigem: "UTC", motivoProposto: "Reposição combinada" },
];
const tela = (): ReactNode => m.ganchos!.renderizar(DecidirReplanejamento, {
  calendarioId: "cal", revisaoId: "rev", podeAprovar: true, podeRejeitar: true, excecoes, resumo: { turmas: 3, encontros: 14 }, preferenciaFusoExibicao: null,
});
const confirmacoes = (t: ReactNode): No[] => elementos(t).filter((n: No) => n.type === ConfirmarAcao);
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };
/** Envia o formulário pelo botão `acao` ("aprovar" ou "rejeitar"), como o React faz com `<form action>`. */
const enviar = (acao: string) => {
  const form = elementos(tela()).find((n: No) => n.type === "form")!;
  return (form.props.action as (f: FormDataFalso) => unknown)(new FormDataFalso(formularioFalso({ acao })));
};
const preencherMotivo = (motivo: string) => {
  const campo = elementos(tela()).find((n: No) => n.type === CampoTexto)!;
  (campo.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: motivo } });
};
const autorizar = (i: number) => {
  const caixas = elementos(tela()).filter((n: No) => n.type === "input" && n.props.type === "checkbox");
  (caixas[i].props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } });
};

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.decidir.mockResolvedValue({ ok: true });
});

describe("DecidirReplanejamento — aprovar passa pela confirmação", () => {
  it("aprovar não aplica; a confirmação diz turmas, encontros e exceções autorizadas e pede a conferência", async () => {
    preencherMotivo("Calendário revisto com a coordenação");
    autorizar(1);
    enviar("aprovar");
    expect(m.decidir).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Aprovar e aplicar o conjunto de novas datas?");
    expect(c.props.confirmacao).toBe("aprovação do conjunto");
    expect(c.props.conferencia).toBe("Conferi as datas, os conflitos e as exceções deste conjunto.");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("3 turmas, 14 encontros previstos mudam de data ou horário");
    expect(consequencia).toContain("1 exceção de dia não letivo autorizada");
    expect(consequencia).toContain("T-02 em 03/11/2026");
    expect(consequencia).not.toContain("T-01");
    expect(consequencia).toContain("Motivo registrado: Calendário revisto com a coordenação");
    expect(consequencia).toContain("Não há desfazer pela tela");
    expect(m.decidir).not.toHaveBeenCalled(); // renderizar a confirmação não executa
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.decidir).toHaveBeenCalledTimes(1);
    expect(m.decidir).toHaveBeenCalledWith({ calendarioId: "cal", revisaoId: "rev", aprovar: true, motivo: "Calendário revisto com a coordenação", excecoesAutorizadas: ["enc-2"] });
    (c.props.aoConcluir as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("sem exceção autorizada, a confirmação diz que não há nenhuma", () => {
    enviar("aprovar");
    expect(texto(confirmacoes(tela())[0].props.children)).toContain("Nenhuma exceção de dia não letivo autorizada.");
  });

  it("voltar não aplica", () => {
    enviar("aprovar");
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.decidir).not.toHaveBeenCalled();
  });

  it("erro e falha de rede aparecem dentro do diálogo (depois da conferência), que continua aberto", async () => {
    enviar("aprovar");
    const [c] = confirmacoes(tela());
    // A conferência é exigida pelo diálogo (coberta em ConfirmarAcao.interacao.test.ts): sem ela o clique não executa.
    expect((await confirmarNoDialogo(c, usar)).erro).toBeNull();
    expect(m.decidir).not.toHaveBeenCalled();
    const conferido = { ...c, props: { ...c.props, conferencia: undefined } } as No;
    m.decidir.mockResolvedValueOnce({ ok: false, erro: "A agenda mudou depois da conferência." });
    expect(await confirmarNoDialogo(conferido, usar)).toEqual({ erro: "A agenda mudou depois da conferência.", confirmarDisponivel: true });
    m.decidir.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(conferido, usar)).erro).toBe(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    expect(confirmacoes(tela())).toHaveLength(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("rejeitar continua direto, sem exceções e sem confirmação", async () => {
    preencherMotivo("Datas não conferem");
    autorizar(0);
    await enviar("rejeitar");
    expect(m.decidir).toHaveBeenCalledWith({ calendarioId: "cal", revisaoId: "rev", aprovar: false, motivo: "Datas não conferem", excecoesAutorizadas: [] });
    expect(confirmacoes(tela())).toHaveLength(0);
  });
});
