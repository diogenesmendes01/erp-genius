import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfiguracaoAvisosAgendaConfig, NumeroConfig, PoliticaConfig } from "@/server/whatsapp/consultas";

// C32 da #170 (docs/42 L2519): números, setores, política da régua e avisos de agenda passam a marcar
// "Alterações não salvas" e a avisar ao sair enquanto houver mudança. O gancho é observado pelo valor de
// `sujo` a cada render (o beforeunload em si está em src/lib/aviso-ao-sair.test.ts). Sem DOM.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  aviso: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => m.ganchos!.useRef(i)) as unknown as typeof real.useRef,
    useId: (() => m.ganchos!.useId()) as typeof real.useId,
    useEffect: (() => undefined) as typeof real.useEffect,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/whatsapp/acoes", () => ({
  salvarConfiguracaoAvisosAgenda: vi.fn(), salvarNumeroWhatsApp: vi.fn(), conectarNumeroQr: vi.fn(), parearNumeroPorCodigo: vi.fn(),
  consultarSessaoNumero: vi.fn(), desconectarNumero: vi.fn(), acionarKillSwitchRegua: vi.fn(), estimarAlcanceRegua: vi.fn(), salvarPoliticaRegua: vi.fn(),
}));
vi.mock("@/server/whatsapp/acoes-numero", () => ({ salvarSetoresNumero: vi.fn() }));
vi.mock("@/lib/aviso-ao-sair", () => ({ useAvisoAoSair: m.aviso }));

import { AvisosAgendaPainel } from "./AvisosAgendaPainel";
import { NumerosPainel, SetoresNumeroEditor } from "./NumerosPainel";
import { PoliticaPainel } from "./PoliticaPainel";
import { AlteracaoPendente } from "@/components/AlteracaoPendente";
import { criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const sujo = () => m.aviso.mock.calls.at(-1)?.[0];
const marca = (t: ReactNode) => elementos(t).filter((n: No) => n.type === AlteracaoPendente).map((n: No) => n.props.sujo);
const mudar = (n: No, valor: unknown) => (n.props.onChange as (e: unknown) => void)({ target: { value: valor, checked: valor } });

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); });

describe("AvisosAgendaPainel", () => {
  const config: ConfiguracaoAvisosAgendaConfig = {
    numeroAvisosAgendaId: null, templateAvisosAgendaId: null,
    numeros: [{ id: "n1", rotulo: "Agenda", driver: "MOTOR", finalidade: "AGENDA", providerRef: "n1", ativo: true }],
    templates: [],
  };
  const tela = (c = config) => m.ganchos!.renderizar(AvisosAgendaPainel, { config: c });

  it("intocado não avisa; escolher o número liga o aviso e a marca; o valor salvo voltando nas props desliga", () => {
    tela();
    expect(sujo()).toBe(false);
    expect(marca(tela())).toEqual([false]);
    mudar(elementos(tela()).filter((n: No) => n.type === "select")[0], "n1");
    const t = tela();
    expect(sujo()).toBe(true);
    expect(marca(t)).toEqual([true]);
    tela({ ...config, numeroAvisosAgendaId: "n1" }); // depois do salvar + router.refresh
    expect(sujo()).toBe(false);
  });
});

describe("NumerosPainel e SetoresNumeroEditor", () => {
  const numero = (o: Partial<NumeroConfig> = {}): NumeroConfig => ({
    id: "n1", telefoneE164: "+5511999990001", rotulo: "Secretaria", driver: "MOTOR", finalidade: "COBRANCA",
    providerRef: "n1", sessao: "CONECTADO", donoId: null, donoNome: null, ativo: true, setores: [], triagemResponsavelId: null, ...o,
  });
  const botaoTexto = (t: ReactNode, rotulo: string) => elementos(t).find((n: No) => n.type === "button" && texto(n.props.children).includes(rotulo))!;

  it("abrir o formulário sem mexer não avisa; digitar o rótulo liga; fechar desliga", () => {
    const tela = () => m.ganchos!.renderizar(NumerosPainel, { numeros: [numero()], vendedores: [] });
    (botaoTexto(tela(), "Editar").props.onClick as () => void)();
    tela();
    expect(sujo()).toBe(false);
    const rotulo = elementos(tela()).find((n: No) => n.type === "input" && n.props.value === "Secretaria")!;
    mudar(rotulo, "Secretaria CR");
    expect(marca(tela())).toContain(true);
    expect(sujo()).toBe(true);
    (elementos(tela()).find((n: No) => n.props["aria-label"] === "Fechar")!.props.onClick as () => void)();
    tela();
    expect(sujo()).toBe(false);
  });

  it("setores: marcar um setor liga o aviso do editor", () => {
    const tela = () => m.ganchos!.renderizar(SetoresNumeroEditor, { numero: numero(), responsaveis: [] });
    tela();
    expect(sujo()).toBe(false);
    const caixa = elementos(tela()).find((n: No) => n.type === "input" && n.props.type === "checkbox")!;
    (caixa.props.onChange as () => void)();
    expect(marca(tela())).toEqual([true]);
    expect(sujo()).toBe(true);
  });
});

describe("PoliticaPainel", () => {
  const politica: PoliticaConfig = {
    id: "p1", nome: "Cobrança", estado: "SHADOW", janelaInicio: 9, janelaFim: 20, diasSemana: [1, 2, 3, 4, 5],
    tetoPorContatoDia: 2, silencioPosInboundHoras: 72, killSwitch: false, numeroRemetenteId: null, degraus: [],
  };
  const tela = (p = politica) => m.ganchos!.renderizar(PoliticaPainel, { politica: p, numeros: [], templates: [] });

  it("intocada não avisa; mudar a janela liga o aviso e a marca; a política salva voltando desliga", () => {
    tela();
    expect(sujo()).toBe(false);
    const fim = elementos(tela()).find((n: No) => n.type === "input" && n.props.value === 20)!;
    mudar(fim, "21");
    expect(marca(tela())).toEqual([true]);
    expect(sujo()).toBe(true);
    tela({ ...politica, janelaFim: 21 });
    expect(sujo()).toBe(false);
  });
});
