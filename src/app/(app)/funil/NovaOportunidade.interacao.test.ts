import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Interação da NovaOportunidade sem DOM (src/test/tela-sem-dom.ts). Efeitos não rodam (useEffect vazio);
// a espera de 400 ms da busca de duplicados usa timers falsos.
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
const duplicadosMock = vi.hoisted(() => vi.fn());
const criarLeadMock = vi.hoisted(() => vi.fn());
const moverEtapaMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock, push: vi.fn() }) }));
vi.mock("@/server/crm/oportunidades", () => ({ buscarPossiveisDuplicados: duplicadosMock }));
vi.mock("@/server/comercial/acoes", () => ({ criarLead: criarLeadMock, moverEtapa: moverEtapaMock }));

import { NovaOportunidade } from "./NovaOportunidade";
import { Campo } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { criarGanchos, controle, elementos, texto, type No } from "@/test/tela-sem-dom";

type Props = Parameters<typeof NovaOportunidade>[0];
const PADRAO: Props = {
  podeAtribuir: true,
  vendedores: [{ id: "v1", nome: "Ana" }],
  paises: [{ id: "br", nome: "Brasil" }],
};

function montar(extra: Partial<Props>) {
  m.ganchos = criarGanchos();
  const props = { ...PADRAO, ...extra };
  const arvore = (): ReactNode => m.ganchos!.renderizar(NovaOportunidade, props);
  const campoPor = (rotulo: string): No => {
    const achados = elementos(arvore()).filter((n) => n.type === Campo && texto(n.props.rotulo).trim() === rotulo);
    if (achados.length !== 1) throw new Error(`esperava 1 campo "${rotulo}", achei ${achados.length}`);
    return achados[0];
  };
  return {
    texto: () => texto(arvore()),
    erro: () => elementos(arvore()).find((n) => n.type === FeedbackAcao)?.props.erro,
    tem: (rotulo: string) => elementos(arvore()).some((n) => n.type === Campo && texto(n.props.rotulo).trim() === rotulo),
    async digitar(rotulo: string, valor: string, esperaMs = 400) {
      (controle(campoPor(rotulo)).props.onChange as (e: unknown) => void)({ target: { value: valor } });
      await vi.advanceTimersByTimeAsync(esperaMs);
    },
    opcoes: (rotulo: string) =>
      (controle(campoPor(rotulo)).props.children as No[]).map((o) => texto(o.props.children)),
    async clicar(rotulo: string) {
      const b = elementos(arvore()).filter((n) => typeof n.props.onClick === "function" && texto(n.props.children).trim() === rotulo);
      if (b.length !== 1) throw new Error(`esperava 1 botão "${rotulo}", achei ${b.length}`);
      await (b[0].props.onClick as () => unknown)();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  duplicadosMock.mockReset().mockResolvedValue({ ok: true, dado: [] });
  criarLeadMock.mockReset().mockResolvedValue({ ok: true, dado: { id: "op1" } });
  moverEtapaMock.mockReset().mockResolvedValue({ ok: true, dado: undefined });
  refreshMock.mockReset();
});

describe("NovaOportunidade", () => {
  it("pessoa ou empresa; aviso de duplicado com Usar cadastro", async () => {
    duplicadosMock.mockResolvedValue({ ok: true, dado: [{ pessoaId: "p1", nome: "Ana Souza", motivo: "telefone" }] });
    const t = montar({});
    await t.digitar("WhatsApp", "+5511988887777");
    expect(t.texto()).toContain("Já existe no CRM: Ana Souza");
    await t.clicar("Usar cadastro");
    await t.clicar("Criar oportunidade");
    expect(criarLeadMock).toHaveBeenCalledWith(expect.objectContaining({ pessoaId: "p1" }));
  });
  it("resultado incerto: o reenvio manda a mesma chave de idempotência (#166)", async () => {
    criarLeadMock.mockRejectedValueOnce(new Error("rede caiu"));
    const t = montar({});
    await t.digitar("Nome", "Bia Lima");
    await t.clicar("Criar oportunidade");
    expect(t.erro()).toBe(MSG_RESULTADO_INCERTO);
    await t.clicar("Criar oportunidade");
    const [primeira, segunda] = criarLeadMock.mock.calls.map((c) => (c[0] as { chaveIdempotencia?: string }).chaveIdempotencia);
    expect(primeira).toMatch(/^[0-9a-f-]{36}$/);
    expect(segunda).toBe(primeira);
    expect(criarLeadMock).toHaveBeenCalledTimes(2);
  });
  it("etapas oferecidas são só as de entrada", () => {
    expect(montar({}).opcoes("Etapa")).toEqual(["Novo", "1º contato", "Qualificado"]);
  });
  it("vendedor não escolhe responsável", () => {
    const sem = montar({ podeAtribuir: false });
    expect(sem.texto()).not.toContain("Responsável");
    expect(sem.tem("Responsável")).toBe(false);
    expect(montar({ podeAtribuir: true }).tem("Responsável")).toBe(true);
  });
  it("busca só a partir de 3 letras ou 8 dígitos, com espera de 400 ms", async () => {
    const t = montar({});
    await t.digitar("Nome", "An");
    await t.digitar("WhatsApp", "1198");
    expect(duplicadosMock).not.toHaveBeenCalled();
    await t.digitar("Nome", "Ana");
    expect(duplicadosMock).toHaveBeenCalledTimes(1);
  });
  it("sem cadastro existente cria pelo nome e etapa escolhida; Qualificado passa por 1º contato", async () => {
    const t = montar({ etapaInicial: "QUALIFICADO" });
    await t.digitar("Nome", "Bia Lima");
    await t.clicar("Criar oportunidade");
    expect(criarLeadMock).toHaveBeenCalledWith(expect.objectContaining({ nome: "Bia Lima" }));
    expect(criarLeadMock.mock.calls[0][0].pessoaId).toBeUndefined();
    expect(moverEtapaMock.mock.calls).toEqual([["op1", "EM_ATENDIMENTO"], ["op1", "QUALIFICADO"]]);
  });
  it("modo Empresa cria a Empresa pelo nome, sem Pessoa: não busca duplicados nem manda pessoaId", async () => {
    duplicadosMock.mockResolvedValue({ ok: true, dado: [{ pessoaId: "p1", nome: "Ana Souza", motivo: "telefone" }] });
    const t = montar({ preenchido: { pessoaId: "p9", nome: "Caio" } });
    await t.clicar("Empresa");
    await t.digitar("Nome da empresa", "ACME Ltda");
    await t.digitar("WhatsApp", "+5511988887777");
    expect(duplicadosMock).not.toHaveBeenCalled();
    expect(t.texto()).not.toContain("Usando o cadastro");
    await t.clicar("Criar oportunidade");
    const enviado = criarLeadMock.mock.calls[0][0];
    expect(enviado).toEqual(expect.objectContaining({ nome: "ACME Ltda", b2b: true, criarEmpresa: true }));
    expect(enviado.pessoaId).toBeUndefined();
  });
  it("modo Pessoa não pede criação de empresa", async () => {
    const t = montar({});
    await t.digitar("Nome", "Bia Lima");
    await t.clicar("Criar oportunidade");
    expect(criarLeadMock.mock.calls[0][0].criarEmpresa).toBeUndefined();
  });
  it("pré-preenchido por pessoaId vincula o cadastro sem pôr nome ou telefone na URL", async () => {
    const t = montar({ preenchido: { pessoaId: "p9", nome: "Caio" } });
    await t.clicar("Criar oportunidade");
    expect(criarLeadMock).toHaveBeenCalledWith(expect.objectContaining({ pessoaId: "p9", nome: "Caio" }));
  });

  describe("descarte de resposta antiga da busca de duplicados", () => {
    const ANA = { pessoaId: "p1", nome: "Ana Souza", motivo: "telefone" };
    const BETO = { pessoaId: "p2", nome: "Beto Souza", motivo: "nome" };
    function adiada<T>() {
      let resolver!: (v: T) => void;
      const promessa = new Promise<T>((r) => { resolver = r; });
      return { promessa, resolver };
    }

    it("resposta de uma rodada antiga não sobrescreve a mais nova", async () => {
      const antiga = adiada<unknown>();
      const nova = adiada<unknown>();
      duplicadosMock.mockReturnValueOnce(antiga.promessa).mockReturnValueOnce(nova.promessa);
      const t = montar({});
      await t.digitar("Nome", "Ana");
      await t.digitar("Nome", "Beto");
      nova.resolver({ ok: true, dado: [BETO] });
      await vi.advanceTimersByTimeAsync(0);
      antiga.resolver({ ok: true, dado: [ANA] });
      await vi.advanceTimersByTimeAsync(0);
      expect(t.texto()).toContain("Já existe no CRM: Beto Souza");
      expect(t.texto()).not.toContain("Ana Souza");
    });

    it("resposta em voo depois de Usar cadastro é descartada", async () => {
      duplicadosMock.mockResolvedValueOnce({ ok: true, dado: [ANA] });
      const emVoo = adiada<unknown>();
      duplicadosMock.mockReturnValueOnce(emVoo.promessa);
      const t = montar({});
      await t.digitar("WhatsApp", "+5511988887777");
      await t.digitar("Nome", "Ana"); // segunda busca sai e fica em voo
      expect(duplicadosMock).toHaveBeenCalledTimes(2);
      await t.clicar("Usar cadastro");
      emVoo.resolver({ ok: true, dado: [BETO] });
      await vi.advanceTimersByTimeAsync(0);
      expect(t.texto()).not.toContain("Já existe no CRM");
      await t.clicar("Criar oportunidade");
      expect(criarLeadMock).toHaveBeenCalledWith(expect.objectContaining({ pessoaId: "p1" }));
    });

    it("timer pendente depois de Usar cadastro não dispara a busca", async () => {
      duplicadosMock.mockResolvedValueOnce({ ok: true, dado: [ANA] });
      const t = montar({});
      await t.digitar("WhatsApp", "+5511988887777");
      await t.digitar("Nome", "Ana", 100); // agenda a busca sem esperar os 400 ms
      await t.clicar("Usar cadastro");
      await vi.advanceTimersByTimeAsync(400);
      expect(duplicadosMock).toHaveBeenCalledTimes(1);
      expect(t.texto()).not.toContain("Já existe no CRM");
    });
  });
});
