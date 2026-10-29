import { describe, expect, it } from "vitest";
import {
  COOKIE_SESSAO_PORTAL_ALUNO,
  cookieSessaoPortalAluno,
  caminhoAtivacaoPortalAluno,
  digestSegredoPortalAluno,
  exigirPrazosPortalAluno,
  gerarSegredoPortalAluno,
  normalizarEmailPortalAluno,
  origemPortalAlunoPermitida,
  validarAppBaseUrlNoBoot,
} from "./politica";

const prazos = {
  prazoSessaoPortalAlunoMinutos: 60,
  prazoConvitePortalAlunoMinutos: 120,
  prazoRecuperacaoPortalAlunoMinutos: 90,
  prazoValidacaoEmailPortalAlunoMinutos: 30,
};

describe("política do portal do aluno", () => {
  it("não presume prazos ausentes ou valores que causariam expiração inválida", () => {
    expect(() => exigirPrazosPortalAluno({ ...prazos, prazoSessaoPortalAlunoMinutos: null })).toThrow();
    expect(() => exigirPrazosPortalAluno({ ...prazos, prazoConvitePortalAlunoMinutos: Number.MAX_SAFE_INTEGER })).toThrow();
    expect(exigirPrazosPortalAluno(prazos).sessaoMinutos).toBe(60);
  });

  it("normaliza o e-mail e guarda somente digest do segredo", () => {
    expect(normalizarEmailPortalAluno(" Aluno@Exemplo.com ")).toBe("aluno@exemplo.com");
    const segredo = gerarSegredoPortalAluno();
    expect(segredo).not.toEqual(digestSegredoPortalAluno(segredo));
    expect(digestSegredoPortalAluno(segredo)).toHaveLength(64);
    const caminho = caminhoAtivacaoPortalAluno(segredo);
    expect(caminho).toContain("#token=");
    expect(caminho).not.toContain("?token=");
  });

  it("emite cookie isolado, HttpOnly e com expiração", () => {
    const cookie = cookieSessaoPortalAluno("sessao-opaca", new Date(Date.now() + 60_000));
    expect(cookie.name).toBe(COOKIE_SESSAO_PORTAL_ALUNO);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/");
  });

  it("aceita a origem exata de APP_BASE_URL, com scheme, host e porta", () => {
    const producao = { NODE_ENV: "production", APP_BASE_URL: "https://erp.geniusidiomas.com" };
    const noBind = new Request("https://0.0.0.0:3000/api/portal-aluno/token", {
      method: "POST",
      headers: { origin: "https://erp.geniusidiomas.com", host: "app:3000", "x-forwarded-host": "atacante.example" },
    });
    expect(origemPortalAlunoPermitida(noBind, producao)).toBe(true);
    const comPorta = { NODE_ENV: "production", APP_BASE_URL: "https://erp.geniusidiomas.com:8443" };
    expect(origemPortalAlunoPermitida(pedido("https://erp.geniusidiomas.com:8443"), comPorta)).toBe(true);
    expect(origemPortalAlunoPermitida(pedido("https://erp.geniusidiomas.com"), comPorta)).toBe(false);
  });

  it("nega Origin forjado mesmo quando X-Forwarded-Host e Host repetem o golpe", () => {
    const producao = { NODE_ENV: "production", APP_BASE_URL: "https://erp.geniusidiomas.com" };
    const forjado = new Request("https://atacante.example/api/portal-aluno/token", {
      method: "POST",
      headers: {
        origin: "https://atacante.example",
        host: "atacante.example",
        "x-forwarded-host": "atacante.example",
        "x-forwarded-proto": "https",
      },
    });
    expect(origemPortalAlunoPermitida(forjado, producao)).toBe(false);
  });

  it("em produção, env ausente ou inválida nega e não usa request.url", () => {
    const mesmaUrl = pedido("https://erp.geniusidiomas.com");
    expect(origemPortalAlunoPermitida(mesmaUrl, { NODE_ENV: "production" })).toBe(false);
    const espelhaRequest = new Request("https://erp.geniusidiomas.com/api/portal-aluno/token", {
      method: "POST",
      headers: { origin: "https://erp.geniusidiomas.com", host: "erp.geniusidiomas.com" },
    });
    expect(origemPortalAlunoPermitida(espelhaRequest, { NODE_ENV: "production" })).toBe(false);
    expect(origemPortalAlunoPermitida(mesmaUrl, { NODE_ENV: "production", APP_BASE_URL: "" })).toBe(false);
    expect(origemPortalAlunoPermitida(pedido("http://erp.geniusidiomas.com"), { NODE_ENV: "production", APP_BASE_URL: "http://erp.geniusidiomas.com" })).toBe(false);
    expect(origemPortalAlunoPermitida(mesmaUrl, { NODE_ENV: "production", APP_BASE_URL: "nao-e-url" })).toBe(false);
  });

  it("nega requisição sem Origin", () => {
    const semOrigin = new Request("https://erp.geniusidiomas.com/api/portal-aluno/sessao", { method: "POST" });
    expect(origemPortalAlunoPermitida(semOrigin, { NODE_ENV: "production", APP_BASE_URL: "https://erp.geniusidiomas.com" })).toBe(false);
  });

  it("nega downgrade para http", () => {
    expect(origemPortalAlunoPermitida(pedido("http://erp.geniusidiomas.com"), {
      NODE_ENV: "production", APP_BASE_URL: "https://erp.geniusidiomas.com",
    })).toBe(false);
  });

  it("fora de produção também aceita http://localhost em qualquer porta", () => {
    const dev = { NODE_ENV: "development" };
    expect(origemPortalAlunoPermitida(pedido("http://localhost:3000"), dev)).toBe(true);
    expect(origemPortalAlunoPermitida(pedido("http://localhost:4317"), dev)).toBe(true);
    expect(origemPortalAlunoPermitida(pedido("https://escola.example"), dev)).toBe(false);
    expect(origemPortalAlunoPermitida(pedido("https://localhost:3000"), dev)).toBe(false);
    expect(origemPortalAlunoPermitida(pedido("http://127.0.0.1:3000"), dev)).toBe(false);
  });
});

const pedido = (origin: string) => new Request("https://0.0.0.0:3000/api/portal-aluno/token", { method: "POST", headers: { origin } });

describe("APP_BASE_URL no boot", () => {
  it("em produção exige URL https e fora de produção não exige", () => {
    expect(() => validarAppBaseUrlNoBoot({ NODE_ENV: "production" })).toThrow(/APP_BASE_URL/);
    expect(() => validarAppBaseUrlNoBoot({ NODE_ENV: "production", APP_BASE_URL: "http://erp.geniusidiomas.com" })).toThrow(/APP_BASE_URL/);
    expect(() => validarAppBaseUrlNoBoot({ NODE_ENV: "production", APP_BASE_URL: "https://erp.geniusidiomas.com" })).not.toThrow();
    expect(() => validarAppBaseUrlNoBoot({ NODE_ENV: "development" })).not.toThrow();
  });
});
