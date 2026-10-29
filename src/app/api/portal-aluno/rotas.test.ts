import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ entrar: vi.fn(), token: vi.fn(), recuperar: vi.fn() }));
vi.mock("@/server/portal-aluno/identidade", () => ({ entrarPortalAluno: mocks.entrar, consumirTokenPortalAluno: mocks.token, solicitarRecuperacaoPortalAluno: mocks.recuperar }));
vi.mock("@/server/portal-aluno/sessao", async () => {
  const politica = await import("@/server/portal-aluno/politica");
  return { cookieSessaoPortalAluno: politica.cookieSessaoPortalAluno };
});
import { POST as login } from "./sessao/route";
import { POST as token } from "./token/route";
import { POST as recuperar } from "./recuperacao/route";

const requisicao = (body: string, headers: Record<string, string> = {}) => new Request("https://escola.example/api/portal-aluno/sessao", {
  method: "POST", headers: { origin: "https://escola.example", ...headers }, body,
});
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_BASE_URL", "https://escola.example"); });
afterEach(() => { vi.unstubAllEnvs(); });

it.each([login, token, recuperar])("recusa origem externa antes de processar a identidade", async post => {
  const r = await post(requisicao("{}", { origin: "https://outra.example" }));
  expect(r.status).toBe(403);
  expect(r.headers.get("cache-control")).toBe("no-store");
  expect(mocks.entrar).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.recuperar).not.toHaveBeenCalled();
});

it.each([login, token, recuperar])("limita bytes reais mesmo com tamanho declarado falso", async post => {
  await post(requisicao(JSON.stringify({ email: "á".repeat(6000) }), { "content-length": "2" }));
  expect(mocks.entrar).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.recuperar).not.toHaveBeenCalled();
});

it.each(["login", "token"])("%s devolve segredo somente no cookie protegido", async fluxo => {
  const sessao = { sessaoCookie: "segredo-nao-incluir-no-json", expiraEm: new Date(Date.now() + 60000) };
  mocks.entrar.mockResolvedValue({ autenticado: true, ...sessao });
  mocks.token.mockResolvedValue({ tipo: "SESSAO", ...sessao });
  const r = await (fluxo === "login" ? login : token)(requisicao("{}"));
  expect(await r.json()).toEqual({ ok: true });
  expect(r.headers.get("cache-control")).toBe("no-store");
  const cookie = r.headers.get("set-cookie");
  expect(cookie).toContain("portal_aluno_session=segredo-nao-incluir-no-json");
  expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("SameSite=lax");
});

it("validação de endereço não cria sessão e recuperação mantém resposta genérica", async () => {
  mocks.token.mockResolvedValue({ tipo: "EMAIL_VALIDADO" });
  const r = await token(requisicao("{}"));
  expect(r.headers.get("set-cookie")).toBeNull();
  expect(await r.json()).toEqual({ ok: true, situacao: "EMAIL_VALIDADO" });
  mocks.recuperar.mockRejectedValue(new Error("Conta não encontrada"));
  const erro = await recuperar(requisicao("{}"));
  mocks.recuperar.mockResolvedValue({ situacao: "PENDENTE_ENVIO" });
  const sucesso = await recuperar(requisicao("{}"));
  expect(await erro.json()).toEqual(await sucesso.json());
});

it("token: senha recusada pelo schema devolve 400 com o campo, não o 422 do link", async () => {
  const { z } = await import("zod");
  const curta = z.object({ senha: z.string().min(12) }).safeParse({ senha: "curta" });
  mocks.token.mockRejectedValue(curta.success ? new Error("esperava falha") : curta.error);
  const r = await token(requisicao("{}"));
  expect(r.status).toBe(400);
  expect(r.headers.get("cache-control")).toBe("no-store");
  expect(await r.json()).toEqual({ erro: "Senha fora das regras.", campo: "senha" });
});

it("token inválido no bind interno do proxy segue 422 quando a Origin é a de APP_BASE_URL", async () => {
  vi.stubEnv("APP_BASE_URL", "https://uat.geniusidiomas.com");
  mocks.token.mockRejectedValueOnce(new Error("Este link não está disponível."));
  const r = await token(new Request("https://0.0.0.0:3000/api/portal-aluno/token", {
    method: "POST",
    headers: {
      origin: "https://uat.geniusidiomas.com",
      host: "app:3000",
      "x-forwarded-host": "atacante.example",
      "x-forwarded-proto": "http",
      "content-type": "application/json",
    },
    body: JSON.stringify({ token: "x".repeat(40), senha: "senha-boa-de-teste" }),
  }));
  expect(r.status).toBe(422);
  expect(mocks.token).toHaveBeenCalledOnce();
});

it("token nega Origin forjado mesmo com X-Forwarded-Host e Host repetindo o golpe", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const r = await token(new Request("https://atacante.example/api/portal-aluno/token", {
    method: "POST",
    headers: {
      origin: "https://atacante.example",
      host: "atacante.example",
      "x-forwarded-host": "atacante.example",
      "x-forwarded-proto": "https",
      "content-type": "application/json",
    },
    body: "{}",
  }));
  expect(r.status).toBe(403);
  expect(mocks.token).not.toHaveBeenCalled();
});

it("token: token malformado, link vencido ou corpo ilegível continuam no 422 genérico", async () => {
  const { z } = await import("zod");
  const semToken = z.object({ token: z.string().min(32) }).safeParse({ token: "x" });
  for (const erro of [semToken.success ? new Error("x") : semToken.error, new Error("Este link não está disponível.")]) {
    mocks.token.mockRejectedValueOnce(erro);
    expect((await token(requisicao("{}"))).status).toBe(422);
  }
  expect((await token(requisicao("{nao-json"))).status).toBe(422);
});
