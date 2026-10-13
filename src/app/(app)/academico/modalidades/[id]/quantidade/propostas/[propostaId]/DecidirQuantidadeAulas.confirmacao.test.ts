import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Aprovar a quantidade de aulas (docs/42 L1218; fatia B, issue #169): "Aprovar e aplicar" muda a quantidade de
// todas as turmas impactadas. O botão só abre o ConfirmarAcao, que repete a mudança e o número de turmas e exige
// "Conferi as {n} turmas impactadas"; só a confirmação chama a action.
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
vi.mock("@/server/agenda/modalidade-quantidade", () => ({ decidirAlteracaoQuantidadeAulasModalidade: m.decidir }));

import { DecidirQuantidadeAulas } from "./DecidirQuantidadeAulas";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { botao, clicar, criarGanchos, elementos, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";

const MOTIVO = "Conferi o impacto nas turmas";
const tela = (turmas = 6): ReactNode => m.ganchos!.renderizar(DecidirQuantidadeAulas, {
  propostaId: "proposta-1", resumo: { nomeModalidade: "Inglês regular", quantidadeAnterior: 40, quantidadeNova: 44, turmas },
});
const confirmacoes = (t: ReactNode): No[] => elementos(t).filter((n: No) => n.type === ConfirmarAcao);
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };
const preencherMotivo = () => {
  const campo = elementos(tela()).find((n: No) => n.type === "input")!;
  (campo.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: MOTIVO } });
};

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.decidir.mockResolvedValue({ ok: true, dado: { id: "decisao-1", aprovada: true, aplicada: true } });
});

describe("DecidirQuantidadeAulas — aprovar passa pela confirmação", () => {
  it("clicar não aplica; a confirmação repete a mudança, as turmas e exige a conferência; só confirmar aplica, uma vez", async () => {
    preencherMotivo();
    clicar(tela(), "Aprovar e aplicar");
    expect(m.decidir).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Aprovar e aplicar a nova quantidade de aulas de Inglês regular?");
    expect(c.props.confirmacao).toBe("aprovação da quantidade");
    expect(c.props.conferencia).toBe("Conferi as 6 turmas impactadas.");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("A quantidade de aulas passa de 40 para 44 em 6 turmas impactadas de uma vez");
    expect(consequencia).toContain(`Motivo registrado: ${MOTIVO}`);
    expect(consequencia).toContain("Não há desfazer pela tela");
    expect(m.decidir).not.toHaveBeenCalled(); // renderizar a confirmação não executa
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.decidir).toHaveBeenCalledTimes(1);
    expect(m.decidir).toHaveBeenCalledWith({ propostaId: "proposta-1", aprovar: true, motivo: MOTIVO });
  });

  it("uma turma só: a conferência fala no singular", () => {
    preencherMotivo();
    clicar(tela(1), "Aprovar e aplicar");
    expect(confirmacoes(tela(1))[0].props.conferencia).toBe("Conferi a turma impactada.");
  });

  it("enquanto a confirmação está aberta, os dois botões da tela ficam travados", () => {
    preencherMotivo();
    clicar(tela(), "Aprovar e aplicar");
    expect(botao(tela(), "Aprovar e aplicar").props.disabled).toBe(true);
    expect(botao(tela(), "Rejeitar").props.disabled).toBe(true);
  });

  it("voltar não aplica", () => {
    preencherMotivo();
    clicar(tela(), "Aprovar e aplicar");
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.decidir).not.toHaveBeenCalled();
  });

  it("erro e falha de rede aparecem dentro do diálogo (depois da conferência), que continua aberto", async () => {
    preencherMotivo();
    clicar(tela(), "Aprovar e aplicar");
    const [c] = confirmacoes(tela());
    expect((await confirmarNoDialogo(c, usar)).erro).toBeNull(); // sem a conferência marcada, nada executa
    expect(m.decidir).not.toHaveBeenCalled();
    const conferido = { ...c, props: { ...c.props, conferencia: undefined } } as No;
    m.decidir.mockResolvedValueOnce({ ok: false, erro: "Proposta desatualizada." });
    expect(await confirmarNoDialogo(conferido, usar)).toEqual({ erro: "Proposta desatualizada.", confirmarDisponivel: true });
    m.decidir.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(conferido, usar)).erro).toBe(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    expect(confirmacoes(tela())).toHaveLength(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });
});
