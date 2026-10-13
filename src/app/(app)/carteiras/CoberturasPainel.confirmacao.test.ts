import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// "Revogar" cobertura (docs/42 L2244; fatia B, issue #169): o botão da linha só abre o ConfirmarAcao, com
// substituto, titular e período; só a confirmação chama a action; erro e incerto ficam no diálogo.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  revogar: vi.fn(), conceder: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/lib/periodo-form", () => ({ useInicioDoPeriodo: () => ({ propsInicio: {}, min: undefined }) }));
vi.mock("@/server/acesso/coberturas", () => ({ concederCobertura: m.conceder, revogarCobertura: m.revogar }));

import { CoberturasPainel } from "./CoberturasPainel";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { clicar, criarGanchos, elementos, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";

const coberturas = [
  { id: "cob-1", titular: "Bruno Lima", substituto: "Ana Souza", inicio: "2026-10-01T12:00:00.000Z", fim: "2026-10-20T12:00:00.000Z", revogada: false, motivo: "Férias do titular" },
];
const tela = (): ReactNode => m.ganchos!.renderizar(CoberturasPainel, { vendedores: [], coberturas, preferenciaFusoExibicao: null });
const confirmacoes = (t: ReactNode): No[] => elementos(t).filter((n: No) => n.type === ConfirmarAcao);
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.revogar.mockResolvedValue({ ok: true });
});

describe("CoberturasPainel — revogar passa pela confirmação", () => {
  it("clicar não revoga; a confirmação nomeia as duas pessoas e o período; só confirmar revoga, uma vez", async () => {
    clicar(tela(), "Revogar");
    expect(m.revogar).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Revogar a cobertura de Ana Souza sobre a carteira de Bruno Lima?");
    expect(c.props.confirmacao).toBe("revogação da cobertura");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Ana Souza deixa de atender a carteira de Bruno Lima na hora");
    expect(consequencia).toContain("01/10/2026");
    expect(consequencia).toContain("20/10/2026");
    expect(consequencia).toContain("Não há desfazer pela tela");
    expect(m.revogar).not.toHaveBeenCalled(); // renderizar a confirmação não executa
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.revogar).toHaveBeenCalledTimes(1);
    expect(m.revogar).toHaveBeenCalledWith("cob-1");
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(confirmacoes(t)).toHaveLength(0);
    expect(elementos(t).find((n: No) => n.type === MensagemStatus)?.props.texto).toBe("Cobertura revogada: Ana Souza deixou de atender a carteira de Bruno Lima.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("voltar não revoga e fecha a confirmação", () => {
    clicar(tela(), "Revogar");
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.revogar).not.toHaveBeenCalled();
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("erro de negócio e falha de rede aparecem dentro do diálogo, que continua aberto", async () => {
    clicar(tela(), "Revogar");
    m.revogar.mockResolvedValueOnce({ ok: false, erro: "Cobertura não encontrada." });
    expect(await confirmarNoDialogo(confirmacoes(tela())[0], usar)).toEqual({ erro: "Cobertura não encontrada.", confirmarDisponivel: true });
    m.revogar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(confirmacoes(tela())[0], usar)).erro).toBe(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    expect(confirmacoes(tela())).toHaveLength(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });
});
