import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Salvar envia o token do rascunho aberto (id + atualizadoEm) e mostra a recusa de concorrência.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, refresh: vi.fn() }));
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
const versoes = vi.hoisted(() => ({ salvarRascunho: vi.fn() }));
vi.mock("@/server/aria/versoes", () => versoes);

import { Salvar } from "./Salvar";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { configPadrao } from "@/server/aria/config-schema";
import { criarGanchos, elementos, texto } from "@/test/tela-sem-dom";

type Props = Parameters<typeof Salvar>[0];
const ABERTO = { id: "r1", atualizadoEm: "2026-10-18T12:00:00.000Z" };
const MSG = "O rascunho foi alterado por outra pessoa desde que você abriu. Recarregue para ver a versão atual.";

function montar(extra: Partial<Props> = {}) {
  m.ganchos = criarGanchos();
  const config = configPadrao();
  const props: Props = { montar: () => config, baseVersaoId: "v1", rascunho: ABERTO, alterado: true, ...extra };
  const arvore = (): ReactNode => m.ganchos!.renderizar(Salvar, props);
  return {
    config,
    arvore,
    salvar: async () => {
      const b = elementos(arvore()).filter((n) => typeof n.props.onClick === "function" && texto(n.props.children).trim() === "Salvar rascunho");
      if (b.length !== 1) throw new Error(`esperava 1 botão, achei ${b.length}`);
      await (b[0].props.onClick as () => Promise<void>)();
    },
    feedback: () => elementos(arvore()).find((n) => n.type === FeedbackAcao)!,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("Salvar (rascunho da Aria)", () => {
  it("envia_o_rascunho_aberto", async () => {
    versoes.salvarRascunho.mockResolvedValue({ ok: true, dado: { versaoId: "r1", atualizadoEm: new Date() } });
    const t = montar();
    await t.salvar();
    expect(versoes.salvarRascunho).toHaveBeenCalledWith({ config: t.config, baseVersaoId: "v1", rascunho: ABERTO });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("sem_rascunho_aberto_envia_null", async () => {
    versoes.salvarRascunho.mockResolvedValue({ ok: true, dado: { versaoId: "r2", atualizadoEm: new Date() } });
    const t = montar({ rascunho: null });
    await t.salvar();
    expect(versoes.salvarRascunho).toHaveBeenCalledWith(expect.objectContaining({ rascunho: null }));
  });

  it("recusa_por_rascunho_alterado_mostra_a_mensagem", async () => {
    versoes.salvarRascunho.mockResolvedValue({ ok: false, erro: MSG });
    const t = montar();
    await t.salvar();
    expect(t.feedback().props.erro).toBe(MSG);
    expect(m.refresh).not.toHaveBeenCalled();
  });
});
