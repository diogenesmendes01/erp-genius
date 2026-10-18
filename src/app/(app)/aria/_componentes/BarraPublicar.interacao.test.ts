import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((v: unknown) => m.ganchos!.useRef(v)) as unknown as typeof real.useRef,
    useId: (() => m.ganchos!.useId()) as typeof real.useId,
    useEffect: (() => {}) as unknown as typeof real.useEffect,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/aria/versoes", () => ({ publicarRascunho: vi.fn(), descartarRascunho: vi.fn() }));

import { BarraPublicar } from "./BarraPublicar";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { criarGanchos, elementos, texto } from "@/test/tela-sem-dom";

type Props = Parameters<typeof BarraPublicar>[0];

function montar(extra: Partial<Props> = {}) {
  m.ganchos = criarGanchos();
  const props: Props = { diff: [], podePublicar: true, podeDescartar: true, ...extra };
  const arvore = (): ReactNode => m.ganchos!.renderizar(BarraPublicar, props);
  return {
    arvore,
    clicar: (rotulo: string) => {
      const b = elementos(arvore()).filter((n) => typeof n.props.onClick === "function" && texto(n.props.children).trim() === rotulo);
      if (b.length !== 1) throw new Error(`esperava 1 botão "${rotulo}", achei ${b.length}`);
      (b[0].props.onClick as () => void)();
    },
    confirmacao: () => elementos(arvore()).find((n) => n.type === ConfirmarAcao),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("BarraPublicar", () => {
  it("publicar_pede_confirmacao_com_diff", () => {
    const t = montar({ diff: ["nome", "confianca.executaAPartirDe"] });
    expect(t.confirmacao()).toBeUndefined();
    t.clicar("Publicar");
    const c = t.confirmacao()!;
    expect(c).toBeDefined();
    expect(texto(c.props.children)).toContain("confianca.executaAPartirDe");
    expect(texto(c.props.children)).toContain("nome");
  });

  it("descartar_tambem_pede_confirmacao", () => {
    const t = montar({ diff: ["nome"] });
    t.clicar("Descartar");
    expect(t.confirmacao()!.props.titulo).toBe("Descartar as alterações?");
  });

  it("sem_diferencas_nao_aparece", () => {
    expect(montar({ diff: [] }).arvore()).toBeNull();
  });

  it("gerente_sem_publicar_nao_ve_o_botao", () => {
    const t = montar({ diff: ["nome"], podePublicar: false });
    expect(() => t.clicar("Publicar")).toThrow();
  });
});
