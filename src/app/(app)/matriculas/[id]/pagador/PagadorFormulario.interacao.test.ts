import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3 (docs/42 L562): trocar o tipo de pagador e voltar devolve o que foi digitado. Antes,
// `dados` só valia para o tipo registrado e o <fieldset key={tipo}> remontava os seis campos. Sem DOM: ganchos
// de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  registrar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/secretaria/pagador-preparacao", () => ({ registrarPagadorPreparacao: m.registrar }));

import type { ReactNode } from "react";
import { CAMPOS_DO_PAGADOR, PagadorFormulario, TIPOS_COM_IDENTIFICACAO, rascunhosIniciais } from "./PagadorFormulario";
import { FormDataFalso, criarGanchos, elementos, submeter, type No } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

type Props = Parameters<typeof PagadorFormulario>[0];
const base: Props = { matriculaId: "m1", versao: 0, paises: [{ id: "br", nome: "Brasil" }, { id: "cr", nome: "Costa Rica" }], atual: null };
const tela = (p: Props = base) => m.ganchos!.renderizar(PagadorFormulario, p);
const campo = (t: ReactNode, nome: string): No | undefined => elementos(t).find((n) => n.props.name === nome);
const mudarTipo = (tipo: string) => (elementos(tela()).find((n) => n.type === "select" && n.props.name === undefined)!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: tipo } });
const digitar = (nome: string, valor: string) => (campo(tela(), nome)!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });

describe("PagadorFormulario — um rascunho por tipo", () => {
  it("Responsável → Empresa → Responsável: os seis campos do responsável voltam; a empresa tem os seus", () => {
    mudarTipo("RESPONSAVEL");
    const responsavel = { nome: "Maria Silva", paisId: "br", documento: "123.456.789-00", email: "maria@example.com", telefoneE164: "+5511999998888", endereco: "Rua A, 10" };
    for (const [nome, valor] of Object.entries(responsavel)) digitar(nome, valor);

    mudarTipo("EMPRESA");
    for (const nome of CAMPOS_DO_PAGADOR) expect(campo(tela(), nome)!.props.value, `empresa: ${nome}`).toBe("");
    digitar("nome", "Empresa X Ltda");

    mudarTipo("ALUNO");
    expect(campo(tela(), "nome")).toBeUndefined();

    mudarTipo("RESPONSAVEL");
    for (const [nome, valor] of Object.entries(responsavel)) expect(campo(tela(), nome)!.props.value, `responsável: ${nome}`).toBe(valor);
    mudarTipo("EMPRESA");
    expect(campo(tela(), "nome")!.props.value).toBe("Empresa X Ltda");
  });

  it("o fieldset não tem mais key por tipo (não remonta)", () => {
    mudarTipo("RESPONSAVEL");
    const fieldset = elementos(tela()).find((n) => n.type === "fieldset") as (No & { key?: string | null }) | undefined;
    expect(fieldset).toBeDefined();
    expect(fieldset!.key ?? null).toBeNull();
  });

  it("o tipo registrado começa com os dados atuais; o outro começa vazio", () => {
    const atual = { tipo: "EMPRESA", dados: { nome: "Empresa Y", paisId: "cr", documento: "3-101", email: null, telefoneE164: null, endereco: "San José" } };
    expect(rascunhosIniciais(atual)).toEqual({
      RESPONSAVEL: { nome: "", paisId: "", documento: "", email: "", telefoneE164: "", endereco: "" },
      EMPRESA: { nome: "Empresa Y", paisId: "cr", documento: "3-101", email: "", telefoneE164: "", endereco: "San José" },
    });
    const t = tela({ ...base, atual });
    expect(campo(t, "nome")!.props.value).toBe("Empresa Y");
  });

  it("envia os dados do tipo escolhido", async () => {
    mudarTipo("EMPRESA");
    digitar("nome", "Empresa X Ltda");
    m.registrar.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), { nome: "Empresa X Ltda", paisId: "br", documento: "", email: "", telefoneE164: "", endereco: "", motivo: "Contrato com a empresa." });
    expect(m.registrar).toHaveBeenCalledWith(expect.objectContaining({ pagador: { tipo: "EMPRESA", dados: expect.objectContaining({ nome: "Empresa X Ltda", paisId: "br" }) }, motivo: "Contrato com a empresa." }));
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("listas fechadas: tipos com identificação e campos (cópia literal)", () => {
    expect(TIPOS_COM_IDENTIFICACAO).toEqual(["RESPONSAVEL", "EMPRESA"]);
    expect(CAMPOS_DO_PAGADOR).toEqual(["nome", "paisId", "documento", "email", "telefoneE164", "endereco"]);
  });
});
