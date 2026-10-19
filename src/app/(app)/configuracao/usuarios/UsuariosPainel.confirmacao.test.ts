import type { ReactNode } from "react";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Desativar usuário (docs/42 L2413; fatia B, issue #169): o botão só abre o ConfirmarAcao, que nomeia a pessoa;
// só a confirmação chama a action; erro e incerto ficam no diálogo. Ativar continua direto.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  alternar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/acesso/acoes", () => ({ definirUsuarioAtivo: m.alternar }));
vi.mock("./UsuarioFormulario", () => ({ UsuarioFormulario: () => null }));

import { UsuariosPainel, type UsuarioRow } from "./UsuariosPainel";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { PAPEL_LABEL } from "@/lib/labels";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { criarGanchos, elementos, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";

const usuario = (over: Partial<UsuarioRow>): UsuarioRow => ({
  id: "u", nome: "Ana Paula", email: "ana@example.test", papeis: [Papel.SECRETARIA_ACADEMICA], ativo: true, limiteDescontoPct: null,
  limiteDescontoTaxaPct: null, limiteDescontoMensalidadePct: null, permissoes: [], gerenteComercialId: null, ultimoAcesso: null, ...over,
});
const usuarios = [usuario({ id: "u-ana" }), usuario({ id: "u-bia", nome: "Bia Reis", email: "bia@example.test", ativo: false })];
const tela = (): ReactNode => m.ganchos!.renderizar(UsuariosPainel, { usuarios, preferenciaFusoExibicao: null });
const confirmacoes = (t: ReactNode): No[] => elementos(t).filter((n: No) => n.type === ConfirmarAcao);
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };
const botaoDe = (t: ReactNode, rotulo: string): No => elementos(t).find((n: No) => n.type === "button" && texto(n.props.children).trim() === rotulo)!;

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.alternar.mockResolvedValue({ ok: true });
});

describe("UsuariosPainel — desativar passa pela confirmação", () => {
  it("clicar não desativa; a confirmação nomeia a pessoa e os papéis; só confirmar desativa, uma vez", async () => {
    (botaoDe(tela(), "Desativar").props.onClick as () => void)();
    expect(m.alternar).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Desativar o acesso de Ana Paula?");
    expect(c.props.confirmacao).toBe("desativação do acesso");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Ana Paula (ana@example.test) perde o acesso ao sistema na hora.");
    expect(consequencia).toContain(PAPEL_LABEL[Papel.SECRETARIA_ACADEMICA]);
    expect(m.alternar).not.toHaveBeenCalled(); // renderizar a confirmação não executa
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.alternar).toHaveBeenCalledTimes(1);
    expect(m.alternar).toHaveBeenCalledWith("u-ana", false);
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(confirmacoes(t)).toHaveLength(0);
    expect(elementos(t).filter((n: No) => n.type === FeedbackAcao).map((n: No) => n.props.sucesso)).toContain("Usuário desativado.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("voltar não desativa", () => {
    (botaoDe(tela(), "Desativar").props.onClick as () => void)();
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.alternar).not.toHaveBeenCalled();
  });

  it("erro e falha de rede aparecem dentro do diálogo, que continua aberto", async () => {
    (botaoDe(tela(), "Desativar").props.onClick as () => void)();
    m.alternar.mockResolvedValueOnce({ ok: false, erro: "Você não pode desativar a si mesmo." });
    expect(await confirmarNoDialogo(confirmacoes(tela())[0], usar)).toEqual({ erro: "Você não pode desativar a si mesmo.", confirmarDisponivel: true });
    m.alternar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(confirmacoes(tela())[0], usar)).erro).toBe(MSG_RESULTADO_INCERTO);
    expect(confirmacoes(tela())).toHaveLength(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("ativar continua direto", async () => {
    await (botaoDe(tela(), "Ativar").props.onClick as () => Promise<void>)();
    expect(m.alternar).toHaveBeenCalledWith("u-bia", true);
    expect(confirmacoes(tela())).toHaveLength(0);
  });

  it("falha de rede ao ativar manda reenviar: com o estado-alvo, repetir não desfaz (B4, #175 C2)", async () => {
    m.alternar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await (botaoDe(tela(), "Ativar").props.onClick as () => Promise<void>)();
    const erros = elementos(tela()).filter((n: No) => n.type === FeedbackAcao).map((n: No) => n.props.erro);
    expect(erros).toContain(MSG_RESULTADO_INCERTO);
  });
});
