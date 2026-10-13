import { describe, expect, it } from "vitest";
import {
  CHAVE_TOKEN_ATIVACAO, MAXIMO_BYTES_SENHA, MINIMO_CARACTERES_SENHA, bytesDaSenha, capturarTokenAtivacao, esquecerTokenAtivacao,
  tokenDoFragmento, validarSenhas, type ArmazenamentoDaAba,
} from "./ativacao";

// docs/42 /portal-aluno/ativar #1 e #2 (docs/43 §6 item 8): o link sobrevive ao F5 (cópia só desta aba) e a
// senha segue as regras do servidor, com confirmação.

function armazenamento(inicial: Record<string, string> = {}): ArmazenamentoDaAba & { dados: Map<string, string> } {
  const dados = new Map(Object.entries(inicial));
  return {
    dados,
    getItem: (k) => dados.get(k) ?? null,
    setItem: (k, v) => { dados.set(k, v); },
    removeItem: (k) => { dados.delete(k); },
  };
}
const bloqueado: ArmazenamentoDaAba = {
  getItem: () => { throw new Error("SecurityError"); },
  setItem: () => { throw new Error("SecurityError"); },
  removeItem: () => { throw new Error("SecurityError"); },
};
const SEGREDO = "s3gr3do-do-convite-com-mais-de-32-caracteres";

describe("token de ativação", () => {
  it("lê o segredo do fragmento, com ou sem #", () => {
    expect(tokenDoFragmento(`#token=${SEGREDO}`)).toBe(SEGREDO);
    expect(tokenDoFragmento(`token=${encodeURIComponent("a+b/c")}`)).toBe("a+b/c");
    expect(tokenDoFragmento("")).toBeNull();
    expect(tokenDoFragmento("#token=")).toBeNull();
    expect(tokenDoFragmento("#outra=1")).toBeNull();
  });

  it("com fragmento: guarda a cópia na aba (um link mais novo substitui o anterior)", () => {
    const aba = armazenamento({ [CHAVE_TOKEN_ATIVACAO]: "link-antigo" });
    expect(capturarTokenAtivacao(`#token=${SEGREDO}`, aba)).toBe(SEGREDO);
    expect(aba.dados.get(CHAVE_TOKEN_ATIVACAO)).toBe(SEGREDO);
  });

  it("sem fragmento (F5, voltar): relê a cópia da aba", () => {
    const aba = armazenamento({ [CHAVE_TOKEN_ATIVACAO]: SEGREDO });
    expect(capturarTokenAtivacao("", aba)).toBe(SEGREDO);
  });

  it("sem fragmento e sem cópia: não há link nesta aba", () => {
    expect(capturarTokenAtivacao("", armazenamento())).toBeNull();
    expect(capturarTokenAtivacao("", null)).toBeNull();
  });

  it("storage bloqueado: o fragmento ainda ativa; sem fragmento, não há link (sem estourar)", () => {
    expect(capturarTokenAtivacao(`#token=${SEGREDO}`, bloqueado)).toBe(SEGREDO);
    expect(capturarTokenAtivacao("", bloqueado)).toBeNull();
    expect(() => esquecerTokenAtivacao(bloqueado)).not.toThrow();
  });

  it("esquecer apaga a cópia", () => {
    const aba = armazenamento({ [CHAVE_TOKEN_ATIVACAO]: SEGREDO, outra: "fica" });
    esquecerTokenAtivacao(aba);
    expect([...aba.dados.keys()]).toEqual(["outra"]);
  });
});

describe("validarSenhas", () => {
  const doze = "a".repeat(MINIMO_CARACTERES_SENHA);

  it("as regras são as do servidor: 12 caracteres, 72 bytes", () => {
    expect(MINIMO_CARACTERES_SENHA).toBe(12);
    expect(MAXIMO_BYTES_SENHA).toBe(72);
  });

  it("menos de 12 caracteres: erro na senha (a confirmação espera)", () => {
    expect(validarSenhas("a".repeat(11), "a".repeat(11))).toEqual({ senha: "A senha precisa de pelo menos 12 caracteres." });
  });

  it("12 caracteres iguais nos dois campos: sem erro", () => {
    expect(validarSenhas(doze, doze)).toEqual({});
  });

  it("as duas diferentes: erro na confirmação, bloqueando o envio", () => {
    expect(validarSenhas(doze, `${doze}b`)).toEqual({ confirmacao: "As duas senhas não coincidem. Digite a mesma senha nos dois campos." });
    expect(validarSenhas(doze, "")).toHaveProperty("confirmacao");
  });

  it("mais de 72 bytes (acento ocupa 2): erro na senha, mesmo com menos de 72 caracteres", () => {
    const acentuada = "é".repeat(37);
    expect(acentuada.length).toBe(37);
    expect(bytesDaSenha(acentuada)).toBe(74);
    expect(validarSenhas(acentuada, acentuada).senha).toMatch(/72 bytes/);
    const limite = "é".repeat(36);
    expect(validarSenhas(limite, limite)).toEqual({});
  });
});
