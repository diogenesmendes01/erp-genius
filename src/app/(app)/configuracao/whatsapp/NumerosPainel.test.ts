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
  desativarNumeroWhatsApp: vi.fn(),
  reativarNumeroWhatsApp: vi.fn(async () => ({ ok: true })),
  excluirNumeroWhatsApp: vi.fn(),
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

  it("oferece Desconectar para MOTOR com sessão (ativo ou não), e a ação passa pela confirmação", () => {
    const conectado = renderToStaticMarkup(createElement(NumerosPainel, { numeros: [numero()], vendedores: [] }));
    expect(conectado).toContain("Desconectar");
    const caido = renderToStaticMarkup(createElement(NumerosPainel, { numeros: [numero({ sessao: "DESCONECTADO" })], vendedores: [] }));
    expect(caido).not.toContain(">Desconectar<");
    // Desativado antes de desativar desligar a sessão: ainda dá para desconectar pela tela.
    const inativoVivo = renderToStaticMarkup(createElement(NumerosPainel, { numeros: [numero({ ativo: false })], vendedores: [] }));
    expect(inativoVivo).toContain(">Desconectar<");
    ganchos.atual = criarGanchos();
    const arvore = ganchos.atual.renderizar(NumerosPainel, { numeros: [numero()], vendedores: [] });
    (botao(arvore, "Desconectar").props.onClick as () => void)();
    const depois = ganchos.atual.renderizar(NumerosPainel, { numeros: [numero()], vendedores: [] });
    const conf = elementos(depois).find((n) => typeof n.props.titulo === "string" && String(n.props.titulo).includes("Desconectar"));
    expect(conf).toBeTruthy();
    expect(acoes.desconectarNumero).not.toHaveBeenCalled();
  });

  it("o formulário não tem mais a caixa \"Número ativo\": ativar e desativar são botões da lista", () => {
    ganchos.atual = criarGanchos();
    const arvore = ganchos.atual.renderizar(NumerosPainel, { numeros: [numero()], vendedores: [] });
    (botao(arvore, "Editar").props.onClick as () => void)();
    const f = ganchos.atual.renderizar(NumerosPainel, { numeros: [numero()], vendedores: [] });
    expect(texto(f)).not.toContain("Número ativo");
    expect(acoes.salvarNumeroWhatsApp).not.toHaveBeenCalled();
  });

  it("Desativar e Excluir só abrem a confirmação, que nomeia o número", () => {
    for (const [rotulo, titulo, acao] of [
      ["Desativar", "Desativar o número Secretaria?", acoes.desativarNumeroWhatsApp],
      ["Excluir", "Excluir o número Secretaria?", acoes.excluirNumeroWhatsApp],
    ] as const) {
      ganchos.atual = criarGanchos();
      const arvore = ganchos.atual.renderizar(NumerosPainel, { numeros: [numero()], vendedores: [] });
      (botao(arvore, rotulo).props.onClick as () => void)();
      const depois = ganchos.atual.renderizar(NumerosPainel, { numeros: [numero()], vendedores: [] });
      const conf = elementos(depois).find((n) => n.props.titulo === titulo);
      expect(conf, rotulo).toBeTruthy();
      expect(acao).not.toHaveBeenCalled();
    }
  });

  it("a exclusão avisa que o histórico fica e como trazer o telefone de volta", () => {
    ganchos.atual = criarGanchos();
    const arvore = ganchos.atual.renderizar(NumerosPainel, { numeros: [numero()], vendedores: [] });
    (botao(arvore, "Excluir").props.onClick as () => void)();
    const depois = ganchos.atual.renderizar(NumerosPainel, { numeros: [numero()], vendedores: [] });
    const conf = elementos(depois).find((n) => n.props.titulo === "Excluir o número Secretaria?")!;
    const txt = texto(conf.props.children);
    expect(txt).toContain("Conversas, mensagens e o histórico continuam guardados");
    expect(txt).toContain("Novo número");
  });

  it("número inativo mostra Ativar (sem confirmação) e não oferece Conectar", async () => {
    const inativo = numero({ ativo: false, sessao: "DESCONECTADO" });
    const html = renderToStaticMarkup(createElement(NumerosPainel, { numeros: [inativo], vendedores: [] }));
    expect(html).toContain(">Ativar<");
    expect(html).not.toContain(">Desativar<");
    expect(html).not.toContain("Conectar");
    expect(html).toContain("inativo");
    ganchos.atual = criarGanchos();
    const arvore = ganchos.atual.renderizar(NumerosPainel, { numeros: [inativo], vendedores: [] });
    (botao(arvore, "Ativar").props.onClick as () => void)();
    await vi.waitFor(() => expect(acoes.reativarNumeroWhatsApp).toHaveBeenCalledWith("n1"));
  });
});
