import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// #166 (2º lote): "Registrar nota" na ficha manda chave de idempotência. A chave é a mesma enquanto a
// tentativa não foi confirmada (resultado incerto) e muda depois do sucesso. As outras ações da ficha
// (editar dados, tags, campos, opt-out) continuam sem chave.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  nota: vi.fn(), editar: vi.fn(),
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/crm/contatos-acoes", () => ({
  editarPessoaDaFicha: m.editar, registrarNotaDaFicha: m.nota, registrarOptOutDaFicha: vi.fn(),
  atribuirTagDaFicha: vi.fn(), removerTagDaFicha: vi.fn(), definirCampoDaFicha: vi.fn(), mesclarContatosDaLista: vi.fn(),
}));
vi.mock("@/server/comercial/acoes", () => ({ criarLead: vi.fn(), moverEtapa: vi.fn() }));
vi.mock("@/server/crm/oportunidades", () => ({ buscarPossiveisDuplicados: vi.fn() }));

import { FichaContato } from "./FichaContato";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import type { DetalheContato } from "@/server/crm/contatos";
import { campos, controle, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const detalhe: DetalheContato = {
  id: "p1", codigo: "P-000001", nome: "Ana Souza", email: null, cidade: null, cargo: null, linkedin: null,
  origemCanal: "INDICACAO", empresa: null, telefones: [], optOut: false, ehAluno: false, tags: [], oportunidades: [],
  criadoEm: new Date("2026-10-01T12:00:00Z"),
};
const classesCor = { NEUTRA: "a", MARCA: "b", INFO: "c", SUCESSO: "d", ALERTA: "e", PERIGO: "f", IA: "g" };

function montar(abaInicial: "historico" | "geral") {
  m.ganchos = criarGanchos();
  // FichaContato só escolhe o corpo pelo key; o teste chama o corpo direto.
  const el = FichaContato({
    detalhe, historico: [], campos: [], tagsDisponiveis: [], classesCor, capacidades: ["contatos.ver", "contatos.editar"],
    vendedores: [], paises: [], abaInicial,
  }) as unknown as No;
  const tela = (): ReactNode => m.ganchos!.renderizar(el.type as (p: unknown) => ReactNode, el.props);
  return {
    erros: () => elementos(tela()).filter((n) => n.type === FeedbackAcao).map((n) => n.props.erro).filter(Boolean),
    escrever(valor: string) {
      const c = campos(tela()).find((n) => texto(n.props.rotulo).trim() === "Nota interna")!;
      (controle(c).props.onChange as (e: unknown) => void)({ target: { value: valor } });
    },
    async registrar() {
      const chamadas = m.nota.mock.calls.length;
      const form = elementos(tela()).find((n) => n.type === "form" && n.props["aria-label"] === "Nova nota")!;
      (form.props.onSubmit as (e: unknown) => void)({ preventDefault() {} });
      await vi.waitFor(() => expect(m.nota.mock.calls.length).toBe(chamadas + 1));
      await new Promise((r) => setTimeout(r, 0));
    },
    async salvarDados() {
      const form = elementos(tela()).find((n) => n.type === "form" && typeof n.props.onSubmit === "function" && n.props["aria-label"] !== "Nova nota")!;
      (form.props.onSubmit as (e: unknown) => void)({ preventDefault() {} });
      await vi.waitFor(() => expect(m.editar).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.nota.mockResolvedValue({ ok: true });
  m.editar.mockResolvedValue({ ok: true });
});

describe("FichaContato — nota com chave de idempotência (#166)", () => {
  it("o reenvio depois do incerto manda a mesma chave; depois do sucesso, outra", async () => {
    const t = montar("historico");
    t.escrever("Prefere contato à tarde.");
    m.nota.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await t.registrar();
    expect(t.erros()).toContain(MSG_RESULTADO_INCERTO);
    await t.registrar();
    t.escrever("Outra nota.");
    await t.registrar();
    const chaves = m.nota.mock.calls.map((c) => c[2] as string | undefined);
    expect(chaves[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(chaves[1]).toBe(chaves[0]);
    expect(chaves[2]).not.toBe(chaves[0]);
    expect(m.nota.mock.calls[0].slice(0, 2)).toEqual(["p1", "Prefere contato à tarde."]);
  });

  it("editar os dados continua sem chave: o incerto manda conferir a página", async () => {
    const t = montar("geral");
    m.editar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await t.salvarDados();
    expect(t.erros()).toContain(MSG_RESULTADO_INCERTO_SEM_CHAVE);
  });
});
