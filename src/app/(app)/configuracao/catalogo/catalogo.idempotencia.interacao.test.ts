import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// #166 (2º lote): os cadastros de criação do catálogo mandam chave de idempotência. A chave é a mesma
// enquanto a tentativa não foi confirmada (resultado incerto) e muda depois do sucesso. O incerto manda
// reenviar sem alterar; ativar/desativar continuam sem chave (cobertos em catalogo.confirmacao.test.ts).
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  criarIdioma: vi.fn(), criarNivel: vi.fn(), criarProduto: vi.fn(), criarPreco: vi.fn(), criarModalidade: vi.fn(),
  valoresModalidade: {} as Record<string, unknown>,
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/catalogo/acoes", () => ({
  criarIdioma: m.criarIdioma, definirIdiomaAtivo: vi.fn(), criarNivel: m.criarNivel, criarProduto: m.criarProduto,
  criarPreco: m.criarPreco, definirPrecoAtivo: vi.fn(), criarModalidade: m.criarModalidade, editarModalidade: vi.fn(),
}));
// O formulário da modalidade usa react-hook-form; aqui só o envio importa.
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    register: () => ({}),
    handleSubmit: (f: (v: unknown) => unknown) => () => f(m.valoresModalidade),
    formState: { errors: {} },
  }),
}));

import { IdiomasPainel } from "./IdiomasPainel";
import { NiveisPainel } from "./NiveisPainel";
import { ProdutosPainel } from "./ProdutosPainel";
import { PrecosPainel } from "./PrecosPainel";
import { ModalidadeFormulario } from "./ModalidadeFormulario";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const botao = (t: ReactNode, rotulo: string): No => {
  const achados = elementos(t).filter((n) => typeof n.props.onClick === "function" && texto(n.props.children).trim() === rotulo);
  if (achados.length !== 1) throw new Error(`esperava 1 botão "${rotulo}", achei ${achados.length}`);
  return achados[0];
};
const controle = (t: ReactNode, chave: string): No => {
  const achado = elementos(t).find((n) => n.props["aria-label"] === chave || n.props.id === chave);
  if (!achado) throw new Error(`controle "${chave}" não encontrado`);
  return achado;
};
const erros = (t: ReactNode) => elementos(t).filter((n) => n.type === FeedbackAcao).map((n) => n.props.erro).filter(Boolean);
const chaves = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => (c[0] as { chaveIdempotencia?: string }).chaveIdempotencia);

/** Incerto, reenvio (mesma chave), sucesso e nova criação (outra chave). */
async function conferirTentativas(acao: ReturnType<typeof vi.fn>, tela: () => ReactNode, enviar: () => Promise<unknown>) {
  acao.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await enviar();
  expect(erros(tela())).toContain(MSG_RESULTADO_INCERTO);
  await enviar();
  await enviar();
  const [primeira, reenvio, nova] = chaves(acao);
  expect(primeira).toMatch(/^[0-9a-f-]{36}$/);
  expect(reenvio).toBe(primeira);
  expect(nova).toMatch(/^[0-9a-f-]{36}$/);
  expect(nova).not.toBe(primeira);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  for (const f of [m.criarIdioma, m.criarNivel, m.criarProduto, m.criarPreco, m.criarModalidade]) f.mockResolvedValue({ ok: true, dado: { id: "novo" } });
});

describe("criações do catálogo com chave de idempotência (#166)", () => {
  it("idioma", async () => {
    const tela = (): ReactNode => m.ganchos!.renderizar(IdiomasPainel, { idiomas: [] });
    await conferirTentativas(m.criarIdioma, tela, async () => {
      (controle(tela(), "Nome do novo idioma").props.onChange as (e: unknown) => void)({ target: { value: "Alemão" } });
      await (botao(tela(), "Adicionar").props.onClick as () => Promise<void>)();
    });
    expect(m.criarIdioma).toHaveBeenCalledWith(expect.objectContaining({ nome: "Alemão" }));
  });

  it("nível", async () => {
    const tela = (): ReactNode => m.ganchos!.renderizar(NiveisPainel, { idiomas: [{ id: "ing", nome: "Inglês", ativo: true, niveis: [], _count: { produtos: 0 } }] });
    await conferirTentativas(m.criarNivel, tela, async () => {
      (controle(tela(), "Código do novo nível").props.onChange as (e: unknown) => void)({ target: { value: "B1" } });
      await (botao(tela(), "Adicionar nível").props.onClick as () => Promise<void>)();
    });
  });

  it("produto", async () => {
    const tela = (): ReactNode => m.ganchos!.renderizar(ProdutosPainel, { produtos: [], idiomas: [{ id: "ing", nome: "Inglês" }], modalidades: [{ id: "reg", nome: "Regular" }] });
    await conferirTentativas(m.criarProduto, tela, () => (botao(tela(), "Adicionar produto").props.onClick as () => Promise<void>)());
  });

  it("preço", async () => {
    const tela = (): ReactNode => m.ganchos!.renderizar(PrecosPainel, {
      precos: [], paises: [{ id: "br", nome: "Brasil", moedaLocal: "BRL" }], produtos: [{ id: "p1", label: "Inglês · Regular" }],
    });
    await conferirTentativas(m.criarPreco, tela, async () => {
      if (!elementos(tela()).some((n) => n.props.id === "precos-valor")) (botao(tela(), "Novo preço").props.onClick as () => void)();
      (controle(tela(), "precos-valor").props.onChange as (v: string) => void)("120");
      await (botao(tela(), "Salvar preço").props.onClick as () => Promise<void>)();
    });
  });

  it("modalidade nova", async () => {
    m.valoresModalidade = { nome: "Intensiva", frequencia: "2x/semana", duracaoPorNivel: "3 meses" };
    const tela = (): ReactNode => m.ganchos!.renderizar(ModalidadeFormulario, { onClose: () => {} });
    const enviar = () => ((elementos(tela()).find((n) => n.type === "form")!.props.onSubmit) as () => Promise<void>)();
    await conferirTentativas(m.criarModalidade, tela, enviar);
  });
});
