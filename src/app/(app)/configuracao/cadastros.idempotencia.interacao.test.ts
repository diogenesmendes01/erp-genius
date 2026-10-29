import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  criarPais: vi.fn(), editarPais: vi.fn(), criarUsuario: vi.fn(), editarUsuario: vi.fn(), refresh: vi.fn(),
  valores: {} as Record<string, unknown>,
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
vi.mock("@/server/paises/acoes", () => ({ criarPais: m.criarPais, editarPais: m.editarPais }));
vi.mock("@/server/acesso/acoes", () => ({ criarUsuario: m.criarUsuario, editarUsuario: m.editarUsuario }));
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    register: () => ({}),
    control: {},
    handleSubmit: (f: (v: unknown) => unknown) => () => f(m.valores),
    formState: { errors: {} },
  }),
  useFieldArray: () => ({ fields: [], append: vi.fn(), remove: vi.fn() }),
  Controller: () => null,
}));

import { PaisFormulario } from "./paises/PaisFormulario";
import { UsuarioFormulario } from "./usuarios/UsuarioFormulario";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { criarGanchos, elementos } from "@/test/tela-sem-dom";

const enviar = async (t: ReactNode) => {
  const form = elementos(t).find((n) => n.type === "form");
  if (!form) throw new Error("formulário não encontrado");
  await (form.props.onSubmit as () => Promise<void>)();
};
const erros = (t: ReactNode) => elementos(t).filter((n) => n.type === FeedbackAcao).map((n) => n.props.erro).filter(Boolean);
const chaves = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => (c[c.length - 1] as { chaveIdempotencia?: string }).chaveIdempotencia);

async function conferirTentativas(acao: ReturnType<typeof vi.fn>, tela: () => ReactNode) {
  acao.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await enviar(tela());
  expect(erros(tela())).toContain(MSG_RESULTADO_INCERTO);
  acao.mockResolvedValueOnce({ ok: false, erro: "Já existe." });
  await enviar(tela());
  await enviar(tela());
  await enviar(tela());
  const [primeira, recusa, sucesso, nova] = chaves(acao);
  expect(primeira).toMatch(/^[0-9a-f-]{36}$/);
  expect(recusa).toBe(primeira);
  expect(sucesso).toBe(primeira);
  expect(nova).toMatch(/^[0-9a-f-]{36}$/);
  expect(nova).not.toBe(primeira);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  for (const f of [m.criarPais, m.editarPais, m.criarUsuario, m.editarUsuario]) f.mockResolvedValue({ ok: true, dado: { id: "novo" } });
});

describe("criação de país com chave de idempotência", () => {
  const valores = { nome: "Costa Rica", codigoISO: "CR", moedaLocal: "CRC", ddi: "+506", fuso: "America/Costa_Rica", idioma: "es", tiposDocumento: [] };

  it("reenvio incerto repete a chave e o sucesso troca a chave", async () => {
    m.valores = valores;
    await conferirTentativas(m.criarPais, () => m.ganchos!.renderizar(PaisFormulario, { onClose: vi.fn() }));
    expect(m.criarPais.mock.calls[0][0]).toMatchObject(valores);
  });

  it("a edição não manda chave e mantém o aviso sem garantia de repetição", async () => {
    m.valores = valores;
    const tela = () => m.ganchos!.renderizar(PaisFormulario, { onClose: vi.fn(), pais: { id: "cr", ...valores } });
    m.editarPais.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await enviar(tela());
    expect(erros(tela())).toContain(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    expect(m.editarPais.mock.calls[0]).toEqual(["cr", valores]);
  });
});

describe("criação de usuário com chave de idempotência", () => {
  const valores = { nome: "Ana", email: "ana@escola.test", papeis: ["VENDEDOR"], limiteDescontoPct: null, limiteDescontoTaxaPct: null, limiteDescontoMensalidadePct: null, gerenteComercialId: null, permissoes: [], senha: "segredo1" };

  it("reenvio incerto repete a chave e o sucesso troca a chave", async () => {
    m.valores = valores;
    await conferirTentativas(m.criarUsuario, () => m.ganchos!.renderizar(UsuarioFormulario, { onClose: vi.fn() }));
    expect(m.criarUsuario.mock.calls[0][0]).toMatchObject(valores);
  });

  it("a edição não manda chave", async () => {
    m.valores = { ...valores, senha: "" };
    const usuario = { id: "u1", nome: "Ana", email: "ana@escola.test", papeis: [], limiteDescontoPct: null, limiteDescontoTaxaPct: null, limiteDescontoMensalidadePct: null, gerenteComercialId: null, permissoes: [] };
    const tela = () => m.ganchos!.renderizar(UsuarioFormulario, { onClose: vi.fn(), usuario });
    m.editarUsuario.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await enviar(tela());
    expect(erros(tela())).toContain(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    expect(m.editarUsuario.mock.calls[0]).toEqual(["u1", m.valores]);
  });
});
