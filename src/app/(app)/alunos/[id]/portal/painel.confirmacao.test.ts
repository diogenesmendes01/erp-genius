import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Decidir a troca de e-mail do portal (docs/42 L325; #175): "Aprovar e aplicar" troca o e-mail, apaga a senha e
// revoga as sessões e os links do aluno. Agora só abre o ConfirmarAcao, que diz isso com o novo endereço; só a
// confirmação chama a action. Rejeitar não mexe na conta e continua direto.
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
vi.mock("@/server/portal-aluno/actions", () => ({ decidirTrocaEmailPortalAluno: m.decidir, prepararConvitePortalAluno: vi.fn(), prepararTrocaEmailPortalAluno: vi.fn() }));

import { PainelAcessoPortalAluno } from "./painel";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { FormDataFalso, criarGanchos, elementos, formularioFalso, submeter, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";

const MOTIVO = "Identidade conferida por vídeo";
const troca = { id: "troca-1", novoEmail: "novo@example.test", situacao: "PENDENTE_DECISAO", preparadorId: "secretaria", criadaEm: "2026-01-01T02:30:00.000Z", novoEmailVerificadoEm: "2026-01-01T03:30:00.000Z", decisao: null };
const tela = (): ReactNode => m.ganchos!.renderizar(PainelAcessoPortalAluno, {
  alunoId: "aluno-1", emailCadastro: "antigo@example.test", conta: { emailVerificado: "antigo@example.test", temSenha: true, ativa: true },
  trocas: [troca], podeDecidir: true, preferenciaFusoExibicao: null,
});
const confirmacoes = (t: ReactNode): No[] => elementos(t).filter((n: No) => n.type === ConfirmarAcao);
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };
/** Formulário da decisão: o segundo da tela (o primeiro prepara a troca). */
const aprovar = () => submeter(tela(), { motivo: MOTIVO }, 1);
const esvaziar = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  vi.stubGlobal("FormData", FormDataFalso);
  m.decidir.mockResolvedValue({ ok: true, dado: { decisaoId: "d-1", aprovada: true, solicitacaoEnvioId: "e-1" } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("Painel do portal — decidir a troca de e-mail", () => {
  it("aprovar e aplicar não aplica; a confirmação diz o novo e-mail e a revogação; só confirmar aplica, uma vez", async () => {
    aprovar();
    await esvaziar();
    expect(m.decidir).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Aplicar a troca do e-mail do portal para novo@example.test?");
    expect(c.props.confirmacao).toBe("troca de e-mail");
    expect(c.props.idempotente).toBe(false);
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("antigo@example.test para novo@example.test");
    expect(consequencia).toContain("As sessões abertas e os links de acesso já enviados ao aluno são revogados na hora");
    expect(consequencia).toContain("a senha atual deixa de valer");
    expect(consequencia).toContain(`Motivo registrado: ${MOTIVO}`);
    expect(consequencia).toContain("Não há desfazer pela tela");
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.decidir).toHaveBeenCalledTimes(1);
    expect(m.decidir).toHaveBeenCalledWith({ solicitacaoId: "troca-1", aprovar: true, motivo: MOTIVO });
    (c.props.aoConcluir as () => void)();
    const depois = tela();
    expect(confirmacoes(depois)).toHaveLength(0);
    expect(m.refresh).toHaveBeenCalledTimes(1);
    const feedback = elementos(depois).filter((n: No) => n.type === FeedbackAcao).map((n: No) => n.props.sucesso).filter(Boolean);
    expect(feedback).toEqual(["Troca aplicada; sessões e links anteriores foram revogados. A recuperação foi preparada para o novo endereço."]);
  });

  it("voltar não aplica", async () => {
    aprovar();
    await esvaziar();
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.decidir).not.toHaveBeenCalled();
  });

  it("erro aparece dentro do diálogo, que continua aberto", async () => {
    aprovar();
    await esvaziar();
    m.decidir.mockResolvedValueOnce({ ok: false, erro: "A conta mudou desde a conferência; prepare uma nova solicitação." });
    expect(await confirmarNoDialogo(confirmacoes(tela())[0], usar)).toEqual({ erro: "A conta mudou desde a conferência; prepare uma nova solicitação.", confirmarDisponivel: true });
    expect(confirmacoes(tela())).toHaveLength(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("rejeitar continua direto, sem confirmação", async () => {
    m.decidir.mockResolvedValueOnce({ ok: true, dado: { decisaoId: "d-1", aprovada: false } });
    const rejeitar = elementos(tela()).find((n: No) => n.type === "button" && texto(n.props.children) === "Rejeitar")!;
    (rejeitar.props.onClick as (e: unknown) => unknown)({ currentTarget: { form: formularioFalso({ motivo: MOTIVO }) } });
    await esvaziar();
    expect(m.decidir).toHaveBeenCalledWith({ solicitacaoId: "troca-1", aprovar: false, motivo: MOTIVO });
    expect(confirmacoes(tela())).toHaveLength(0);
  });
});
