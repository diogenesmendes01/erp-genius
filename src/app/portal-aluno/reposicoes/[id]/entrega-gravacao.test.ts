import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// #172 (pendência declarada): o envio da entrega usava um <button> montado à mão. Passa a ser o <Botao> do
// design system, com `type="submit"` declarado e o estado ocupado (aria-busy) enquanto envia.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real, useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { EntregaGravacaoPortalAluno } from "./entrega-gravacao";
import { Botao } from "@/components/Botao";
import { criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const tela = (): ReactNode =>
  m.ganchos!.renderizar(EntregaGravacaoPortalAluno, { reposicaoId: "r1", podeEntregar: true, motivoBloqueio: null });

beforeEach(() => { m.ganchos = criarGanchos(); });

describe("EntregaGravacaoPortalAluno — botão de envio", () => {
  it("usa o <Botao> com type submit, sem <button> feito à mão", () => {
    const t = tela();
    expect(elementos(t).filter((n: No) => n.type === "button")).toHaveLength(0);
    const [b] = elementos(t).filter((n: No) => n.type === Botao);
    expect(b.props.type).toBe("submit");
    expect(texto(b.props.children)).toBe("Enviar para avaliação");
    expect(b.props.ocupado).toBe(false);
  });
});
