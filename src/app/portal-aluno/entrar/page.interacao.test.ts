import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/42 /portal-aluno/entrar #2 (#172): antes, toda falha virava "Não foi possível entrar com essas
// credenciais" — inclusive queda de rede e erro do servidor, e o aluno ficava redigitando a senha. Agora a
// credencial recusada (401), o serviço fora e a falha de rede têm mensagens próprias. Sem DOM e sem rede.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  fetch: vi.fn(), replace: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real, useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace, refresh: m.refresh }) }));

import EntrarPortalAlunoPage from "./page";
import { FormDataFalso, criarGanchos, elementos, submeter, texto, type No } from "@/test/tela-sem-dom";

const tela = () => m.ganchos!.renderizar(EntrarPortalAlunoPage, {});
const entrar = () => submeter(tela(), { email: "aluna@escola.test", senha: "senha-de-teste" });
const alertas = () => elementos(tela()).filter((n: No) => n.props.role === "alert").map((n: No) => texto(n.props.children));

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  vi.stubGlobal("FormData", FormDataFalso);
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("entrar no portal do aluno — mensagens de falha", () => {
  it("credencial recusada (401): e-mail ou senha incorretos", async () => {
    m.fetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await entrar();
    expect(alertas()).toEqual(["E-mail ou senha incorretos."]);
    expect(m.replace).not.toHaveBeenCalled();
  });

  it("corpo recusado (422): pede para conferir os dados, sem afirmar que a conta existe nem mandar só esperar", async () => {
    m.fetch.mockResolvedValueOnce({ ok: false, status: 422 });
    await entrar();
    expect(alertas()).toEqual(["Não foi possível entrar com esses dados. Confira o e-mail e a senha e tente de novo; se continuar, tente mais tarde."]);
    expect(m.replace).not.toHaveBeenCalled();
  });

  it("origem recusada (403): manda abrir pelo endereço oficial", async () => {
    m.fetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await entrar();
    expect(alertas()).toEqual(["Não foi possível confirmar de onde veio o acesso. Abra o portal pelo endereço oficial e tente de novo."]);
  });

  it("serviço fora: diz que está indisponível, não que a senha está errada", async () => {
    for (const status of [429, 500, 503]) {
      m.fetch.mockResolvedValueOnce({ ok: false, status });
      await entrar();
      expect(alertas(), String(status)).toEqual(["O serviço está indisponível agora. Tente de novo em alguns minutos."]);
    }
    expect(m.replace).not.toHaveBeenCalled();
  });

  it("falha de rede: pede para conferir a conexão", async () => {
    m.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await entrar();
    expect(alertas()).toEqual(["Não foi possível falar com o servidor. Verifique sua conexão e tente de novo."]);
  });

  it("aceito: abre a área do aluno, sem alerta", async () => {
    m.fetch.mockResolvedValueOnce({ ok: true, status: 200 });
    await entrar();
    expect(alertas()).toEqual([]);
    expect(m.replace).toHaveBeenCalledWith("/portal-aluno");
  });

  it("aceito: o botão segue desativado até a troca de rota (duplo clique não abre outra sessão)", async () => {
    m.fetch.mockResolvedValueOnce({ ok: true, status: 200 });
    await entrar();
    const botao = elementos(tela()).find((n: No) => n.props.type === "submit");
    expect(botao?.props.disabled).toBe(true);
  });

  it("recusado: o botão volta a ficar ativo", async () => {
    m.fetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await entrar();
    const botao = elementos(tela()).find((n: No) => n.props.type === "submit");
    expect(botao?.props.disabled).toBe(false);
  });
});
