import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Encerrar país (docs/42 L2428; fatia B, issue #169): "Encerrar" é terminal — o botão só abre o
// ConfirmarAcao, que repete produtos, preços e alunos e pede o nome do país digitado; só a confirmação
// chama a action. Pausar/ativar/reativar têm volta na própria linha e continuam diretos.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  status: vi.fn(), produto: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/paises/acoes", () => ({ alterarStatusPais: m.status, alternarProdutoPais: m.produto }));
vi.mock("./PaisFormulario", () => ({ PaisFormulario: () => null }));

import { PaisesPainel, type PaisRow } from "./PaisesPainel";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { clicar, criarGanchos, elementos, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";

const pais = (over: Partial<PaisRow> = {}): PaisRow => ({
  id: "cr", nome: "Costa Rica", codigoISO: "CR", moedaLocal: "CRC", ddi: "+506", fuso: "America/Costa_Rica", idioma: "es",
  status: "ATIVO", tiposDocumento: [{ id: "d1", nome: "Cédula", validador: "CEDULA_CR" }], produtosOferecidos: ["p1", "p2", "p3"],
  _count: { produtosPais: 4, precos: 12, alunos: 37 }, ...over,
});
let paises: PaisRow[];
const tela = (): ReactNode => m.ganchos!.renderizar(PaisesPainel, { paises, produtos: [] });
const confirmacoes = (t: ReactNode): No[] => elementos(t).filter((n: No) => n.type === ConfirmarAcao);
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };
const celulas = (t: ReactNode) => elementos(t).filter((n: No) => n.type === "td").map((n: No) => texto(n.props.children).trim());

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  paises = [pais()];
  m.status.mockResolvedValue({ ok: true });
});

describe("PaisesPainel — encerrar passa pela confirmação com o nome digitado", () => {
  it("a tabela mostra produtos habilitados, preços e alunos do país", () => {
    const t = tela();
    const cabecalho = elementos(t).filter((n: No) => n.type === "th").map((n: No) => texto(n.props.children).trim());
    expect(cabecalho).toEqual(["País", "Moeda", "DDI", "Documentos", "Produtos", "Preços", "Alunos", "Status", "Ações"]);
    expect(celulas(t).slice(4, 7)).toEqual(["3", "12", "37"]);
  });

  it("clicar em Encerrar não encerra; a confirmação repete os números, diz que não há volta e pede o nome", async () => {
    clicar(tela(), "Encerrar");
    expect(m.status).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Encerrar o país Costa Rica?");
    expect(c.props.confirmacao).toBe("encerramento do país");
    expect(c.props.digitacao).toEqual({ rotulo: "Digite Costa Rica para confirmar", esperado: "Costa Rica" });
    const resumo = c.props.children as No;
    const consequencia = texto((resumo.type as (p: unknown) => ReactNode)(resumo.props)).replace(/\s+/g, " ");
    expect(consequencia).toContain("3 produtos habilitados");
    expect(consequencia).toContain("12 preços cadastrados");
    expect(consequencia).toContain("37 alunos cadastrados");
    expect(consequencia).toContain("Encerrar não tem volta pela tela");
    expect(m.status).not.toHaveBeenCalled(); // renderizar a confirmação não executa
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.status).toHaveBeenCalledTimes(1);
    expect(m.status).toHaveBeenCalledWith("cr", "ENCERRADO");
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(confirmacoes(t)).toHaveLength(0);
    expect(elementos(t).filter((n: No) => n.type === FeedbackAcao)[0].props.sucesso).toBe("País encerrado.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("voltar não encerra", () => {
    clicar(tela(), "Encerrar");
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.status).not.toHaveBeenCalled();
  });

  it("erro e falha de rede aparecem dentro do diálogo (com o nome já digitado), que continua aberto", async () => {
    clicar(tela(), "Encerrar");
    const [c] = confirmacoes(tela());
    // O diálogo de verdade exige o nome: sem digitar, o clique não executa.
    const semNome = await confirmarNoDialogo(c, usar);
    expect(semNome.erro).toBeNull();
    expect(m.status).not.toHaveBeenCalled();
    const comNome = { ...c, props: { ...c.props, digitacao: undefined } } as No; // a digitação é coberta em ConfirmarAcao.interacao.test.ts
    m.status.mockResolvedValueOnce({ ok: false, erro: "País não encontrado." });
    expect(await confirmarNoDialogo(comNome, usar)).toEqual({ erro: "País não encontrado.", confirmarDisponivel: true });
    m.status.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(comNome, usar)).erro).toBe(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    expect(confirmacoes(tela())).toHaveLength(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("pausar continua direto (tem volta na própria linha)", async () => {
    await clicar(tela(), "Pausar");
    expect(m.status).toHaveBeenCalledWith("cr", "PAUSADO");
    expect(confirmacoes(tela())).toHaveLength(0);
  });
});
