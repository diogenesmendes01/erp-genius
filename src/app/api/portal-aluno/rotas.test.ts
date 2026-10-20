import { beforeEach, expect, it, vi } from "vitest";
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
beforeEach(() => { vi.resetAllMocks(); });

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

// #172: a senha recusada pelo schema não é "link indisponível". O link continua valendo (a validação vem antes
// de tocar no token), então a rota responde 400 com o campo, e o 422 fica só para o link que não serve.
it("token: senha recusada pelo schema devolve 400 com o campo, não o 422 do link", async () => {
  const { z } = await import("zod");
  const curta = z.object({ senha: z.string().min(12) }).safeParse({ senha: "curta" });
  mocks.token.mockRejectedValue(curta.success ? new Error("esperava falha") : curta.error);
  const r = await token(requisicao("{}"));
  expect(r.status).toBe(400);
  expect(r.headers.get("cache-control")).toBe("no-store");
  expect(await r.json()).toEqual({ erro: "Senha fora das regras.", campo: "senha" });
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
