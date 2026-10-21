import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Interação da matriz sem DOM (src/test/tela-sem-dom.ts).
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
vi.mock("@/server/aria/versoes", () => ({ salvarRascunho: vi.fn() }));

import { Permissoes } from "./Permissoes";
import { configPadrao } from "@/server/aria/config-schema";
import { criarGanchos, elementos, type No } from "@/test/tela-sem-dom";

type Props = Parameters<typeof Permissoes>[0];

function montar(extra: Partial<Props> = {}) {
  m.ganchos = criarGanchos();
  const props: Props = { config: configPadrao(), baseVersaoId: "v1", rascunho: null, podeEditar: true, ...extra };
  const arvore = (): ReactNode => m.ganchos!.renderizar(Permissoes, props);
  const celulas = () => elementos(arvore()).filter((n) => n.props["data-etapa"] !== undefined);
  const celula = (etapa: string, acao: string): No => {
    const achadas = celulas().filter((n) => n.props["data-etapa"] === etapa && n.props["data-tipo"] === acao);
    if (achadas.length !== 1) throw new Error(`esperava 1 célula ${etapa}/${acao}, achei ${achadas.length}`);
    return achadas[0];
  };
  return {
    celula,
    valorCelula: (etapa: string, acao: string) => celula(etapa, acao).props["data-modo"],
    clicarCelula: (etapa: string, acao: string) => (celula(etapa, acao).props.onClick as () => void)(),
    clicarBotao: (rotulo: string) => {
      const b = elementos(arvore()).filter((n) => typeof n.props.onClick === "function" && n.props["data-etapa"] === undefined && n.props.children === rotulo);
      if (b.length !== 1) throw new Error(`esperava 1 botão "${rotulo}", achei ${b.length}`);
      (b[0].props.onClick as () => void)();
    },
    quantas: () => celulas().length,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("Permissoes (interação)", () => {
  it("celula_cicla_executa_sugere_nao_faz", () => {
    const t = montar();
    expect(t.valorCelula("NOVO", "TAG")).toBe("EXECUTA");
    t.clicarCelula("NOVO", "TAG");
    expect(t.valorCelula("NOVO", "TAG")).toBe("SUGERE");
    t.clicarCelula("NOVO", "TAG");
    expect(t.valorCelula("NOVO", "TAG")).toBe("NAO_FAZ");
    t.clicarCelula("NOVO", "TAG");
    expect(t.valorCelula("NOVO", "TAG")).toBe("EXECUTA");
  });

  it("uma_celula_nao_mexe_nas_outras", () => {
    const t = montar();
    const antes = t.valorCelula("PROPOSTA", "TAG");
    t.clicarCelula("NOVO", "TAG");
    expect(t.valorCelula("PROPOSTA", "TAG")).toBe(antes);
    expect(t.quantas()).toBe(8 * 10);
  });

  it("modelo_supervisao_deixa_tudo_em_sugere", () => {
    const t = montar();
    t.clicarBotao("Supervisão");
    expect(t.valorCelula("NOVO", "RESPONDER")).toBe("SUGERE");
  });

  it("sem_permissao_a_celula_nao_tem_clique", () => {
    const t = montar({ podeEditar: false });
    expect(t.celula("NOVO", "TAG").props.onClick).toBeUndefined();
  });
});
