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

  it("aceita apenas Origin idêntico ao URL canônico e ignora host encaminhado forjado", () => {
    const aceito = new Request("https://portal.geniusidiomas.com/api/portal-aluno/sessao", {
      method: "POST", headers: { origin: "https://portal.geniusidiomas.com", host: "atacante.example" },
    });
    const hostForjado = new Request("https://portal.geniusidiomas.com/api/portal-aluno/sessao", {
      method: "POST", headers: { origin: "https://atacante.example", host: "portal.geniusidiomas.com", "x-forwarded-host": "atacante.example" },
    });
    const protocoloDiferente = new Request("https://portal.geniusidiomas.com/api/portal-aluno/sessao", {
      method: "POST", headers: { origin: "http://portal.geniusidiomas.com" },
    });
    const semOrigin = new Request("https://portal.geniusidiomas.com/api/portal-aluno/sessao", { method: "POST" });
    expect(origemPortalAlunoPermitida(aceito)).toBe(true);
    expect(origemPortalAlunoPermitida(hostForjado)).toBe(false);
    expect(origemPortalAlunoPermitida(protocoloDiferente)).toBe(false);
    expect(origemPortalAlunoPermitida(semOrigin)).toBe(false);
  });
});
