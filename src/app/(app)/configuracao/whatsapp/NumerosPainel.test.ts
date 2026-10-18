import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { criarGanchos, botao, elementos, texto } from "@/test/tela-sem-dom";
import type { NumeroConfig } from "@/server/whatsapp/consultas";

const ganchos = vi.hoisted(() => ({ atual: null as null | ReturnType<typeof import("@/test/tela-sem-dom").criarGanchos> }));
vi.mock("react", async (orig) => {
  const real = await orig<typeof import("react")>();
  return {
    ...real,
    useState: (i: unknown) => (ganchos.atual ? ganchos.atual.useState(i) : real.useState(i as never)),
    useCallback: (f: unknown) => f,
    useRef: (i: unknown) => (ganchos.atual ? ganchos.atual.useRef(i) : real.useRef(i as never)),
    useId: () => (ganchos.atual ? ganchos.atual.useId() : real.useId()),
    useEffect: (f: () => void) => (ganchos.atual ? undefined : real.useEffect(f)),
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const acoes = vi.hoisted(() => ({
  salvarNumeroWhatsApp: vi.fn(),
  conectarNumeroQr: vi.fn(),
  parearNumeroPorCodigo: vi.fn(),
  consultarSessaoNumero: vi.fn(),
  desconectarNumero: vi.fn(),
}));
vi.mock("@/server/whatsapp/acoes", () => acoes);
vi.mock("@/server/whatsapp/acoes-numero", () => ({ salvarSetoresNumero: vi.fn() }));

import { NumerosPainel } from "./NumerosPainel";

const numero = (o: Partial<NumeroConfig> = {}): NumeroConfig => ({
  id: "n1", telefoneE164: "+5511999990001", rotulo: "Secretaria", driver: "MOTOR", finalidade: "COBRANCA",
  providerRef: "n1", sessao: "CONECTADO", donoId: null, donoNome: null, ativo: true, setores: [], triagemResponsavelId: null, ...o,
});

describe("NumerosPainel — motor", () => {
  beforeEach(() => { ganchos.atual = null; });

  it("não oferece Meta nem Evolution", () => {
    const html = renderToStaticMarkup(createElement(NumerosPainel, { numeros: [numero()], vendedores: [] }));
    expect(html).not.toMatch(/Meta|Evolution|phone_number_id|ref:/);
    expect(html).toContain("Conectar");
  });

  it("o formulário não tem seletor de driver nem campo de referência", () => {
    ganchos.atual = criarGanchos();
    const arvore = ganchos.atual.renderizar(NumerosPainel, { numeros: [], vendedores: [] });
    (botao(arvore, "Novo número").props.onClick as () => void)();
    const f = ganchos.atual.renderizar(NumerosPainel, { numeros: [], vendedores: [] });
    const txt = texto(f);
    expect(txt).not.toMatch(/Driver|Referência|providerRef/i);
    expect(elementos(f).some((n) => n.type === "select" && texto(n.props.children).includes("Evolution"))).toBe(false);
  });

  it("mostra selo de sessão para todo número MOTOR", () => {
    for (const [sessao, rotulo] of [["CONECTADO", "conectado"], ["AGUARDANDO_QR", "aguardando QR"], ["CAIU", "sessão caiu"], ["DESCONECTADO", "desconectado"]] as const) {
      const html = renderToStaticMarkup(createElement(NumerosPainel, { numeros: [numero({ sessao })], vendedores: [] }));
      expect(html).toContain(rotulo);
    }
  });

  it("oferece Desconectar só para MOTOR conectado e ativo, e a ação passa pela confirmação", () => {
    const conectado = renderToStaticMarkup(createElement(NumerosPainel, { numeros: [numero()], vendedores: [] }));
    expect(conectado).toContain("Desconectar");
    const caido = renderToStaticMarkup(createElement(NumerosPainel, { numeros: [numero({ sessao: "DESCONECTADO" })], vendedores: [] }));
    expect(caido).not.toContain(">Desconectar<");
    ganchos.atual = criarGanchos();
    const arvore = ganchos.atual.renderizar(NumerosPainel, { numeros: [numero()], vendedores: [] });
    (botao(arvore, "Desconectar").props.onClick as () => void)();
    const depois = ganchos.atual.renderizar(NumerosPainel, { numeros: [numero()], vendedores: [] });
    const conf = elementos(depois).find((n) => typeof n.props.titulo === "string" && String(n.props.titulo).includes("Desconectar"));
    expect(conf).toBeTruthy();
    expect(acoes.desconectarNumero).not.toHaveBeenCalled();
  });
});
