import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ERRO_ATIVACAO_RECUSADA, ERRO_LINK_INDISPONIVEL, ERRO_SENHA_RECUSADA, ERRO_RECUPERACAO_RECUSADA, definirSenhaPortalAluno, pedirRecuperacaoPortalAluno,
} from "./requisicoes";

// docs/43 §6 item 8: as chamadas do navegador às rotas do portal. `fetch` é um mock — nenhuma requisição real,
// nenhum e-mail. Recusa do servidor vira { ok: false }; falha de transporte lança (a tela diz "não confirmado").
const fetchFalso = vi.fn();
const resposta = (status: number, corpo?: unknown) => ({
  status, ok: status >= 200 && status < 300,
  json: async () => { if (corpo === undefined) throw new SyntaxError("Unexpected end of JSON input"); return corpo; },
});

beforeEach(() => {
  fetchFalso.mockReset();
  vi.stubGlobal("fetch", fetchFalso);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("definirSenhaPortalAluno", () => {
  it("manda só o segredo e a senha, por POST, para a rota do token", async () => {
    fetchFalso.mockResolvedValueOnce(resposta(200, { ok: true }));
    await definirSenhaPortalAluno("segredo", "senha-boa-de-teste");
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/portal-aluno/token");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ token: "segredo", senha: "senha-boa-de-teste" });
  });

  it("200 abre a sessão; 200 com EMAIL_VALIDADO só valida o novo e-mail", async () => {
    fetchFalso.mockResolvedValueOnce(resposta(200, { ok: true }));
    expect(await definirSenhaPortalAluno("s", "x")).toEqual({ ok: true, dado: { conclusao: "SESSAO" } });
    fetchFalso.mockResolvedValueOnce(resposta(200, { ok: true, situacao: "EMAIL_VALIDADO" }));
    expect(await definirSenhaPortalAluno("s", "x")).toEqual({ ok: true, dado: { conclusao: "EMAIL_VALIDADO" } });
  });

  it("422 é o link que não serve mais; outra recusa é outra mensagem", async () => {
    fetchFalso.mockResolvedValueOnce(resposta(422, { erro: "Este link não está disponível." }));
    expect(await definirSenhaPortalAluno("s", "x")).toEqual({ ok: false, erro: ERRO_LINK_INDISPONIVEL });
    for (const status of [403, 500, 503]) {
      fetchFalso.mockResolvedValueOnce(resposta(status, { erro: "x" }));
      expect(await definirSenhaPortalAluno("s", "x"), String(status)).toEqual({ ok: false, erro: ERRO_ATIVACAO_RECUSADA });
    }
  });

  it("400 com campo senha: a senha foi recusada e o link continua valendo (#172)", async () => {
    fetchFalso.mockResolvedValueOnce(resposta(400, { erro: "Senha fora das regras.", campo: "senha" }));
    expect(await definirSenhaPortalAluno("s", "x")).toEqual({ ok: false, erro: ERRO_SENHA_RECUSADA });
    expect(ERRO_SENHA_RECUSADA).not.toBe(ERRO_LINK_INDISPONIVEL);
    fetchFalso.mockResolvedValueOnce(resposta(400, { erro: "x" }));
    expect(await definirSenhaPortalAluno("s", "x")).toEqual({ ok: false, erro: ERRO_ATIVACAO_RECUSADA });
  });

  it("falha de rede, ou 200 com corpo ilegível, lança (resultado incerto: a senha pode ter sido gravada)", async () => {
    fetchFalso.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(definirSenhaPortalAluno("s", "x")).rejects.toThrow("Failed to fetch");
    fetchFalso.mockResolvedValueOnce(resposta(200));
    await expect(definirSenhaPortalAluno("s", "x")).rejects.toThrow(SyntaxError);
  });
});

describe("pedirRecuperacaoPortalAluno", () => {
  it("manda só o e-mail, por POST, para a rota de recuperação", async () => {
    fetchFalso.mockResolvedValueOnce(resposta(200, { ok: true, situacao: "PENDENTE_ENVIO" }));
    await pedirRecuperacaoPortalAluno("aluna@escola.test");
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/portal-aluno/recuperacao");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "aluna@escola.test" });
  });

  it("resposta neutra: qualquer 200 é o mesmo pedido aceito, sem ler o corpo (não revela se a conta existe)", async () => {
    fetchFalso.mockResolvedValueOnce(resposta(200, { ok: true, situacao: "PENDENTE_ENVIO" }));
    expect(await pedirRecuperacaoPortalAluno("existe@escola.test")).toEqual({ ok: true });
    fetchFalso.mockResolvedValueOnce(resposta(200));
    expect(await pedirRecuperacaoPortalAluno("nao-existe@escola.test")).toEqual({ ok: true });
  });

  it("recusa (origem bloqueada, servidor fora) é erro; falha de rede lança", async () => {
    for (const status of [403, 500]) {
      fetchFalso.mockResolvedValueOnce(resposta(status, { erro: "x" }));
      expect(await pedirRecuperacaoPortalAluno("a@b.test"), String(status)).toEqual({ ok: false, erro: ERRO_RECUPERACAO_RECUSADA });
    }
    fetchFalso.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(pedirRecuperacaoPortalAluno("a@b.test")).rejects.toThrow("Failed to fetch");
  });
});
