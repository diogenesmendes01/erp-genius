import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Importar alunos por planilha (docs/42 L224; docs/43 §6 item 9): depois do resultado, o mesmo arquivo não volta a
// ser enviado por um segundo clique — o botão vira "Importar outra planilha", que limpa o arquivo e o resultado, e
// "Importar" só habilita com um arquivo escolhido. As linhas que o servidor ignorou por duplicidade aparecem com o
// motivo. Sem DOM (src/test/tela-sem-dom.ts): a tela é chamada como função; o fetch é trocado.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, refresh: vi.fn(), fetch: vi.fn() }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  const g = () => m.ganchos!;
  return {
    ...real,
    useState: ((i: unknown) => g().useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => g().useRef(i)) as unknown as typeof real.useRef,
    useId: (() => g().useId()) as typeof real.useId,
    useEffect: (() => {}) as typeof real.useEffect,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));

import { ImportarAlunosModal } from "./ImportarAlunosModal";
import { botao, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const tela = (): ReactNode => m.ganchos!.renderizar(ImportarAlunosModal, {});
const campoArquivo = (t: ReactNode) => elementos(t).find((n: No) => n.type === "input" && n.props.type === "file")!;
/** O ref do campo de arquivo (React 18: no elemento; React 19: nas props). */
const refDoArquivo = (t: ReactNode) => {
  const n = campoArquivo(t) as No & { ref?: { current: unknown } };
  return (n.props.ref as { current: unknown } | undefined) ?? n.ref!;
};
const temBotao = (t: ReactNode, rotulo: string) => elementos(t).some((n: No) => n.type === "button" && texto(n.props.children).trim() === rotulo);

/** Abre o modal e escolhe um arquivo (o input avisa a escolha; o ref guarda o arquivo, como o DOM). */
function abrirEEscolher() {
  (botao(tela(), "Cadastrar por lote").props.onClick as () => void)();
  const t = tela();
  const arquivo = { name: "alunos.xlsx" };
  refDoArquivo(t).current = { files: [arquivo], value: "C:\\fakepath\\alunos.xlsx" };
  (campoArquivo(t).props.onChange as (e: unknown) => void)({ target: { files: [arquivo] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  vi.stubGlobal("fetch", m.fetch);
  vi.stubGlobal("FormData", class { append() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("ImportarAlunosModal — não reimportar a mesma planilha (docs/42 L224)", () => {
  it("sem arquivo escolhido, Importar fica desabilitado; com arquivo, habilita", () => {
    (botao(tela(), "Cadastrar por lote").props.onClick as () => void)();
    expect(botao(tela(), "Importar").props.disabled).toBe(true);
    const t = tela();
    refDoArquivo(t).current = { files: [{ name: "a.xlsx" }], value: "a.xlsx" };
    (campoArquivo(t).props.onChange as (e: unknown) => void)({ target: { files: [{ name: "a.xlsx" }] } });
    expect(botao(tela(), "Importar").props.disabled).toBe(false);
  });

  it("depois do resultado: o arquivo sai do campo, Importar some e aparece Importar outra planilha; as ignoradas vêm com o motivo", async () => {
    abrirEEscolher();
    m.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({
      total: 3, criados: 1, erros: [{ linha: 4, motivo: "Nome (obrigatório) está vazio." }],
      ignorados: [{ linha: 2, motivo: "Já cadastrado como Ana Rojas (A-000010): mesmo documento no mesmo país. A linha não foi importada." }],
    }) });
    const ref = refDoArquivo(tela());
    await (botao(tela(), "Importar").props.onClick as () => Promise<void>)();
    expect(m.fetch).toHaveBeenCalledTimes(1);
    const t = tela();
    expect((ref.current as { value: string }).value).toBe("");
    expect(temBotao(t, "Importar")).toBe(false);
    expect(temBotao(t, "Importar outra planilha")).toBe(true);
    expect(campoArquivo(t).props.disabled).toBe(true);
    const lido = elementos(t).map((n: No) => (n.type === "li" || n.type === "p" ? texto(n.props.children) : "")).filter(Boolean);
    expect(lido).toContain("1 de 3 aluno(s) cadastrado(s).");
    expect(lido).toContain("1 linha(s) ignorada(s) por já existir o aluno:");
    expect(lido).toContain("Linha 2: Já cadastrado como Ana Rojas (A-000010): mesmo documento no mesmo país. A linha não foi importada.");
    expect(lido).toContain("Linha 4: Nome (obrigatório) está vazio.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("Importar outra planilha limpa o resultado e volta a exigir um arquivo novo; nada é reenviado", async () => {
    abrirEEscolher();
    m.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ total: 1, criados: 1, erros: [], ignorados: [] }) });
    await (botao(tela(), "Importar").props.onClick as () => Promise<void>)();
    (botao(tela(), "Importar outra planilha").props.onClick as () => void)();
    const t = tela();
    expect(temBotao(t, "Importar outra planilha")).toBe(false);
    expect(botao(t, "Importar").props.disabled).toBe(true);
    expect(campoArquivo(t).props.disabled).toBe(false);
    expect(elementos(t).some((n: No) => n.type === "p" && texto(n.props.children).includes("aluno(s) cadastrado(s)"))).toBe(false);
    expect(m.fetch).toHaveBeenCalledTimes(1);
  });

  it("sem linha ignorada, a lista de ignoradas não aparece (e a resposta antiga, sem o campo, também funciona)", async () => {
    abrirEEscolher();
    m.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ total: 1, criados: 1, erros: [] }) });
    await (botao(tela(), "Importar").props.onClick as () => Promise<void>)();
    expect(elementos(tela()).some((n: No) => texto(n.props.children).includes("ignorada(s)"))).toBe(false);
  });
});
