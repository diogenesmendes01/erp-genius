import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ entrar: vi.fn(), token: vi.fn(), recuperar: vi.fn() }));
vi.mock("@/server/portal-aluno/identidade", () => ({ entrarPortalAluno: mocks.entrar, consumirTokenPortalAluno: mocks.token, solicitarRecuperacaoPortalAluno: mocks.recuperar }));
vi.mock("@/server/portal-aluno/sessao", async () => {
  const politica = await import("@/server/portal-aluno/politica");
  return { cookieSessaoPortalAluno: politica.cookieSessaoPortalAluno };
});
import { ErroRegra } from "@/server/_shared";
import { ErroConfigPortalIncompleta } from "@/server/portal-aluno/erros";
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

it("F1: token em produção nega Origin http da URL canônica mesmo sem X-Forwarded-Proto", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_BASE_URL", "https://erp.geniusidiomas.com");
  const r = await token(new Request("http://127.0.0.1:3000/api/portal-aluno/token", {
    method: "POST",
    headers: {
      origin: "http://erp.geniusidiomas.com",
      host: "erp.geniusidiomas.com",
      "content-type": "application/json",
    },
    body: "{}",
  }));
  expect(r.status).toBe(403);
  expect(mocks.token).not.toHaveBeenCalled();
});

it("F2: token em produção nega Origin https da URL canônica quando a porta é 8443", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_BASE_URL", "https://erp.geniusidiomas.com");
  const r = await token(new Request("https://erp.geniusidiomas.com/api/portal-aluno/token", {
    method: "POST",
    headers: {
      origin: "https://erp.geniusidiomas.com:8443",
      host: "erp.geniusidiomas.com:8443",
      "content-type": "application/json",
    },
    body: "{}",
  }));
  expect(r.status).toBe(403);
  expect(mocks.token).not.toHaveBeenCalled();
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

describe("#536 login com configuração de prazos incompleta", () => {
  const credenciais = { email: "aluna.segredo@example.test", senha: "Senha-Secreta-Do-Caso-536" };
  const corpo = () => JSON.stringify(credenciais);
  const MENSAGEM_CONFIG = "Configure todos os prazos do portal do aluno antes de emitir links ou sessões.";

  it("T1: ErroConfigPortalIncompleta → 503 neutro, no-store, sem cookie e log estruturado sem PII", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.entrar.mockRejectedValue(new ErroConfigPortalIncompleta(["prazoSessaoPortalAlunoMinutos", "prazoConvitePortalAlunoMinutos"]));
    const r = await login(requisicao(corpo()));
    expect(r.status).toBe(503);
    const texto = await r.text();
    expect(JSON.parse(texto)).toEqual({ erro: "Portal temporariamente indisponível, procure a secretaria.", codigo: "PORTAL_INDISPONIVEL" });
    expect(texto).not.toMatch(/prazo|config|ConfiguracaoOperacional/i);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("retry-after")).toBe("300");
    expect(r.headers.get("set-cookie")).toBeNull();
    expect(erro).toHaveBeenCalledOnce();
    expect(erro).toHaveBeenCalledWith("portal-aluno.login.config-incompleta", {
      codigo: "PORTAL_CONFIG_INCOMPLETA", camposAusentes: ["prazoSessaoPortalAlunoMinutos", "prazoConvitePortalAlunoMinutos"],
    });
    const log = JSON.stringify(erro.mock.calls);
    expect(log).not.toContain(credenciais.email);
    expect(log).not.toContain(credenciais.senha);
  });

  it("T1b: 503 é byte-idêntico independentemente das credenciais", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.entrar.mockRejectedValue(new ErroConfigPortalIncompleta(["prazoSessaoPortalAlunoMinutos"]));
    const a = await login(requisicao(corpo()));
    const b = await login(requisicao(JSON.stringify({ email: "inexistente@example.test", senha: "errada" })));
    expect(await a.text()).toBe(await b.text());
    expect([...a.headers]).toEqual([...b.headers]);
  });

  it("T2: credenciais inválidas seguem 401 sem mudança", async () => {
    mocks.entrar.mockResolvedValue({ autenticado: false });
    const r = await login(requisicao(corpo()));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ erro: "Credenciais inválidas." });
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("set-cookie")).toBeNull();
  });

  it.each([["ErroRegra genérico", () => new ErroRegra("Outra regra qualquer.")], ["Error", () => new Error("falha com aluna.segredo@example.test")]])(
    "T3: %s nunca vira 503 e é logado só pelo nome", async (_n, criar) => {
      const erro = vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.entrar.mockRejectedValue(criar());
      const r = await login(requisicao(corpo()));
      expect(r.status).toBe(500);
      expect(await r.json()).toEqual({ erro: "Não foi possível iniciar a sessão. Tente novamente." });
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(r.headers.get("set-cookie")).toBeNull();
      expect(erro).toHaveBeenCalledWith("portal-aluno.login.erro-inesperado", { nome: criar().name });
      expect(JSON.stringify(erro.mock.calls)).not.toContain(credenciais.email);
    });

  it("T4: erro com a MESMA mensagem da config, mas de outra classe, não vira 503 (sem discriminação por string)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.entrar.mockRejectedValueOnce(new ErroRegra(MENSAGEM_CONFIG));
    expect((await login(requisicao(corpo()))).status).toBe(500);
    const falso = Object.assign(new Error(MENSAGEM_CONFIG), { codigo: "PORTAL_CONFIG_INCOMPLETA", camposAusentes: [] });
    mocks.entrar.mockRejectedValueOnce(falso);
    expect((await login(requisicao(corpo()))).status).toBe(500);
  });

  it("entrada inválida (JSON ou Zod) mantém o 422 genérico com aviso sem dados", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await login(requisicao("{nao-json"));
    expect(r.status).toBe(422);
    expect(mocks.entrar).not.toHaveBeenCalled();
    const { z } = await import("zod");
    const zod = z.object({ email: z.string() }).safeParse({});
    mocks.entrar.mockRejectedValue(zod.success ? new Error("x") : zod.error);
    const r2 = await login(requisicao(corpo()));
    expect(r2.status).toBe(422);
    expect(await r2.json()).toEqual({ erro: "Não foi possível iniciar a sessão." });
    expect(aviso).toHaveBeenCalledWith("portal-aluno.login.entrada-invalida");
    expect(aviso.mock.calls.every(c => c.length === 1)).toBe(true);
  });

  it("origem externa continua sendo a primeira checagem (403), mesmo com portal indisponível", async () => {
    mocks.entrar.mockRejectedValue(new ErroConfigPortalIncompleta(["prazoSessaoPortalAlunoMinutos"]));
    const r = await login(requisicao(corpo(), { origin: "https://outra.example" }));
    expect(r.status).toBe(403);
    expect(mocks.entrar).not.toHaveBeenCalled();
  });
});
