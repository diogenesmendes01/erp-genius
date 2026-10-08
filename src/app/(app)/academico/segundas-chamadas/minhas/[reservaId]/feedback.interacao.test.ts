import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados no registro da
// realização e na submissão da nota original da segunda chamada — erro em role="alert", sucesso em
// role="status", falha de rede como resultado incerto e o formulário saindo do ocupado. Sem DOM: ganchos
// de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  realizar: vi.fn(), nota: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/avaliacoes/segunda-chamada-docente-local", () => ({ realizarSegundaChamadaLocal: m.realizar }));
vi.mock("@/server/avaliacoes/segunda-chamada-realizacao", () => ({ salvarNotaOriginalSegundaChamada: m.nota }));

import { FormularioNota, FormularioRealizacao } from "./Formulario";
import { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

/** Rótulo de progresso no botão e o fieldset travado: os dois sinais do ocupado. */
const ocupadoEm = (t: ReactNode, rotulo: string) => {
  const botao = elementos(t).find((n) => n.type === "button");
  const fieldset = elementos(t).find((n) => n.type === "fieldset");
  return texto(botao?.props.children) === rotulo && fieldset?.props.disabled === true;
};

describe("FormularioRealizacao", () => {
  const tela = () => m.ganchos!.renderizar(FormularioRealizacao, { reservaId: "reserva-1", fusoInstitucional: "America/Sao_Paulo" });
  const valores = { dataHora: "2026-10-01T10:00:00.000", fuso: "America/Sao_Paulo", evidencia: "Lista de presença assinada" };
  contratoFeedbackSeparado({
    nome: "registrar realização", tela, action: m.realizar,
    acionar: () => submeter(tela(), valores),
    respostaOk: { ok: true, dado: { id: "realizacao-1" } },
    sucesso: "Realização registrada.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => ocupadoEm(tela(), "Registrando…"),
  });

  it("o sucesso atualiza a tela com router.refresh; o erro não", async () => {
    m.realizar.mockResolvedValueOnce({ ok: false, erro: "Data fora do encontro." }).mockResolvedValueOnce({ ok: true, dado: { id: "realizacao-1" } });
    await submeter(tela(), valores);
    expect(m.refresh).not.toHaveBeenCalled();
    await submeter(tela(), valores);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("FormularioNota", () => {
  const props = { realizacaoId: "realizacao-1", alocacaoId: "alocacao-1", codigoAvaliacao: "A", realizadaEm: "2026-01-01T02:30:00.000Z", escala: { minimo: "0", maximo: "10" }, habilidades: ["FALA"], versaoEsperada: 1, regularizacao: false };
  const tela = () => m.ganchos!.renderizar(FormularioNota, props);
  const valores = { "nota-FALA": "8,5", "comentario-FALA": "Boa fluência" };
  contratoFeedbackSeparado({
    nome: "submeter nota original", tela, action: m.nota,
    acionar: () => submeter(tela(), valores),
    respostaOk: { ok: true, dado: { id: "lancamento-1" } },
    sucesso: "Nota submetida para conferência.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => ocupadoEm(tela(), "Submetendo…"),
  });

  it("reenvio depois de falha de rede usa a mesma chave; o sucesso chama router.refresh", async () => {
    m.nota.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true, dado: { id: "lancamento-1" } });
    await submeter(tela(), valores);
    await submeter(tela(), valores);
    const chamadas = m.nota.mock.calls.map((c) => (c[0] as { lancamento: { chaveIdempotencia: string; notas: { nota: string | null }[] } }).lancamento);
    expect(chamadas[0].notas[0].nota).toBe("8.5");
    expect(chamadas[0].chaveIdempotencia).toBeTruthy();
    expect(chamadas[1].chaveIdempotencia).toBe(chamadas[0].chaveIdempotencia);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
