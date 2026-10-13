import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 8 (docs/42 /login #2 e #4): depois do login a pessoa volta à página pedida (`callbackUrl`),
// só quando é um caminho interno — URL externa, `//…` e `/\…` caem no /home. A queda de rede vira mensagem.
// Sem DOM: ganchos de src/test/tela-sem-dom.ts; o react-hook-form entrega os valores direto ao onSubmit.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  signIn: vi.fn(), push: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
  };
});
vi.mock("next-auth/react", () => ({ signIn: m.signIn }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, refresh: m.refresh }) }));
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    register: (nome: string) => ({ name: nome, onChange: () => {}, onBlur: () => {}, ref: () => {} }),
    handleSubmit: (enviar: (dados: { email: string; senha: string }) => unknown) => () => enviar({ email: "operadora@escola.test", senha: "senha-de-teste" }),
    formState: { errors: {}, isSubmitting: false },
  }),
}));

import LoginPage from "./page";
import { anuncios } from "@/test/feedback-acao";
import { criarGanchos, submeter } from "@/test/tela-sem-dom";

const tela = () => m.ganchos!.renderizar(LoginPage, {});
/** Abre o login com esta query (o que o guard montou) e entra com credenciais aceitas. */
async function entrarCom(search: string) {
  vi.stubGlobal("window", { location: { search } });
  m.signIn.mockResolvedValueOnce({ ok: true, error: undefined });
  await submeter(tela());
}

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("LoginPage — destino depois do login", () => {
  it("volta ao caminho interno pedido no callbackUrl, com a query", async () => {
    await entrarCom("?callbackUrl=%2Fmatriculas%2Fm1%3Faba%3Dcontrato");
    expect(m.signIn).toHaveBeenCalledWith("credentials", { email: "operadora@escola.test", senha: "senha-de-teste", redirect: false });
    expect(m.push).toHaveBeenCalledWith("/matriculas/m1?aba=contrato");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("callbackUrl externo é recusado: vai para /home, nunca para fora do sistema", async () => {
    for (const externo of ["https://golpe.example/login", "//golpe.example", "/\\golpe.example", "/.//golpe.example", "javascript:alert(1)"]) {
      m.push.mockClear();
      await entrarCom(`?callbackUrl=${encodeURIComponent(externo)}`);
      expect(m.push, externo).toHaveBeenCalledWith("/home");
    }
  });

  it("sem callbackUrl, vai para /home", async () => {
    await entrarCom("");
    expect(m.push).toHaveBeenCalledWith("/home");
  });

  it("credencial recusada: alerta e fica no login", async () => {
    vi.stubGlobal("window", { location: { search: "?callbackUrl=%2Falunos" } });
    m.signIn.mockResolvedValueOnce({ ok: false, error: "CredentialsSignin" });
    await submeter(tela());
    expect(m.push).not.toHaveBeenCalled();
    expect(anuncios(tela())).toEqual({ alerta: ["E-mail ou senha incorretos."], status: [] });
  });

  it("queda de rede no signIn: diz que não falou com o servidor (não que a senha está errada) e fica no login", async () => {
    vi.stubGlobal("window", { location: { search: "" } });
    m.signIn.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await submeter(tela());
    expect(m.push).not.toHaveBeenCalled();
    expect(anuncios(tela())).toEqual({ alerta: ["Não foi possível falar com o servidor. Verifique sua conexão e tente de novo."], status: [] });
  });
});
