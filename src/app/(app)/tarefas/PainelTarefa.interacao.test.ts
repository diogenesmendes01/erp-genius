import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// #166 (2º lote): "Nova tarefa" manda chave de idempotência a `criarTarefa`. A chave é a mesma enquanto a
// tentativa não foi confirmada e muda depois do sucesso. A edição continua sem chave (usa a `versao`).
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  criarTarefa: vi.fn(), editarTarefa: vi.fn(),
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/server/crm/tarefas-acoes", () => ({
  criarTarefa: m.criarTarefa, editarTarefa: m.editarTarefa, assumirTarefa: vi.fn(), cancelarTarefa: vi.fn(),
  concluirTarefa: vi.fn(), reabrirTarefa: vi.fn(),
}));

import { PainelTarefa } from "./PainelTarefa";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import type { TarefaLista } from "@/server/crm/mensagens-agendadas";
import { controle, campos, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

type Props = Parameters<typeof PainelTarefa>[0];
const PADRAO: Props = { tarefa: null, responsaveis: [], fusoEscola: "America/Sao_Paulo", fusoExibicao: "America/Sao_Paulo", dataInicial: "2026-10-20", params: {} };

function montar(extra: Partial<Props> = {}) {
  m.ganchos = criarGanchos();
  // PainelTarefa só escolhe o formulário pelo key; o teste chama o formulário direto.
  const el = PainelTarefa({ ...PADRAO, ...extra }) as unknown as No;
  const tela = (): ReactNode => m.ganchos!.renderizar(el.type as (p: unknown) => ReactNode, el.props);
  return {
    erro: () => elementos(tela()).find((n) => n.type === FeedbackAcao)?.props.erro,
    digitar(rotulo: string, valor: string) {
      const c = campos(tela()).find((n) => texto(n.props.rotulo).trim() === rotulo)!;
      (controle(c).props.onChange as (e: unknown) => void)({ target: { value: valor } });
    },
    async salvar() {
      const b = elementos(tela()).find((n) => typeof n.props.onClick === "function" && texto(n.props.children).trim() === "Salvar")!;
      await (b.props.onClick as () => Promise<void>)();
    },
  };
}
const chaves = () => m.criarTarefa.mock.calls.map((c) => (c[0] as { chaveIdempotencia?: string }).chaveIdempotencia);

beforeEach(() => {
  vi.clearAllMocks();
  m.criarTarefa.mockResolvedValue({ ok: true, dado: { id: "t1" } });
  m.editarTarefa.mockResolvedValue({ ok: true });
});

describe("PainelTarefa — chave de idempotência (#166)", () => {
  it("nova tarefa: o reenvio depois do incerto manda a mesma chave; depois do sucesso, outra", async () => {
    const t = montar();
    t.digitar("Título", "Ligar para a Ana");
    m.criarTarefa.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await t.salvar();
    expect(t.erro()).toBe(MSG_RESULTADO_INCERTO);
    await t.salvar();
    await t.salvar();
    const [primeira, reenvio, nova] = chaves();
    expect(primeira).toMatch(/^[0-9a-f-]{36}$/);
    expect(reenvio).toBe(primeira);
    expect(nova).not.toBe(primeira);
    expect(m.criarTarefa).toHaveBeenCalledWith(expect.objectContaining({ titulo: "Ligar para a Ana" }));
  });

  it("edição: sem chave, e o incerto manda conferir a página", async () => {
    const tarefa = {
      id: "t9", titulo: "Antiga", tipo: "OUTRO", descricao: null, status: "ABERTA", prioridade: "NORMAL", dataCivil: null, inicioEm: null,
      duracaoMin: 30, lembreteAntecedenciaMin: null, fusoOrigem: "America/Sao_Paulo", responsavelId: "u1", versao: 3, responsavel: { id: "u1", nome: "Eu" },
    } as unknown as TarefaLista;
    const t = montar({ tarefa });
    t.digitar("Título", "Nova");
    m.editarTarefa.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await t.salvar();
    expect(t.erro()).toBe(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    expect(m.editarTarefa).toHaveBeenCalledWith("t9", 3, { titulo: "Nova" });
  });
});
