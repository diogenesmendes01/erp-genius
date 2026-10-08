import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados na conciliação de
// envio incerto — registrar evidência e decidir a reemissão, cada um com o resultado junto dos próprios
// botões: erro em role="alert", sucesso em role="status", falha de rede como resultado incerto e os
// controles saindo do ocupado. Sem DOM: src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  refresh: vi.fn(), registrar: vi.fn(), decidir: vi.fn(),
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
vi.mock("@/server/portal-aluno/conciliacao-envio", () => ({ registrarEvidenciaEnvioIncerto: m.registrar, decidirReemissaoEnvioIncerto: m.decidir }));

import { ConciliacaoEnvio } from "./ConciliacaoEnvio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import type { ItemFilaEnviosPortalAluno } from "@/server/portal-aluno/fila-envios";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, botao, criarGanchos, elementos, formularioFalso, submeter } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const item: ItemFilaEnviosPortalAluno = {
  id: "solicitacao", alunoNome: "Ana", finalidade: "CONVITE", situacao: "INCERTO",
  criadoEm: new Date("2026-09-16T12:00:00.000Z"), atualizadoEm: new Date("2026-09-16T12:00:00.000Z"),
  conciliacao: { id: "conciliacao", estadoHash: "a".repeat(64), evidencia: "Painel do provedor conferido.", versao: 1, secretariaNome: "Secretaria", criadaEm: new Date("2026-09-16T12:30:00.000Z"), decisao: null },
  podeRegistrarEvidencia: true, podeDecidirReemissao: true,
};
const tela = () => m.ganchos!.renderizar(ConciliacaoEnvio, { item, preferenciaFusoExibicao: null });
/** Os três botões travados juntos: uma ação por vez na conciliação. */
const ocupado = () => ["Registrar evidência", "Autorizar nova emissão", "Não autorizar"].every((r) => botao(tela(), r).props.disabled === true);

describe("ConciliacaoEnvio", () => {
  // O formulário da evidência usa `action` (recebe o FormData), não onSubmit.
  const registrarEvidencia = () => {
    const form = elementos(tela()).find((n) => n.type === "form" && typeof n.props.action === "function");
    return (form!.props.action as (f: FormData) => unknown)(new FormDataFalso(formularioFalso({ evidencia: "Provedor confirmou o aceite." })) as unknown as FormData);
  };
  contratoFeedbackSeparado({
    nome: "registrar evidência", tela, action: m.registrar, acionar: registrarEvidencia,
    sucesso: "Evidência registrada.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE, ocupado,
  });

  contratoFeedbackSeparado({
    nome: "autorizar nova emissão", tela, action: m.decidir,
    acionar: () => submeter(tela(), { motivo: "Aluno não recebeu o convite." }),
    sucesso: "Nova emissão autorizada e preparada.",
    // A decisão conserva a própria mensagem de incerteza (reenviar a mesma decisão).
    incerto: MSG_DECISAO_INCERTA, ocupado,
  });

  it("não autorizar decide com aprovar=false e o resultado sai junto da decisão, não da evidência", async () => {
    m.decidir.mockResolvedValueOnce({ ok: true });
    await (botao(tela(), "Não autorizar").props.onClick as (e: unknown) => unknown)({ currentTarget: { form: formularioFalso({ motivo: "Envio confirmado pelo provedor." }) } });
    expect(m.decidir).toHaveBeenCalledWith({ conciliacaoId: "conciliacao", estadoHash: "a".repeat(64), aprovar: false, motivo: "Envio confirmado pelo provedor." });
    const [daEvidencia, daDecisao] = elementos(tela()).filter((n) => n.type === FeedbackAcao);
    expect(daEvidencia.props.sucesso).toBeNull();
    expect(daDecisao.props.sucesso).toBe("Nova emissão não autorizada.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("erro na evidência não atualiza a página e aparece junto do formulário da evidência", async () => {
    m.registrar.mockResolvedValueOnce({ ok: false, erro: "Envio já conciliado." });
    await registrarEvidencia();
    const [daEvidencia, daDecisao] = elementos(tela()).filter((n) => n.type === FeedbackAcao);
    expect(daEvidencia.props.erro).toBe("Envio já conciliado.");
    expect(daDecisao.props.erro).toBeNull();
    expect(m.refresh).not.toHaveBeenCalled();
  });
});
