import { describe, expect, it } from "vitest";
import { DESTINO_PADRAO_APOS_LOGIN, destinoAposLogin, destinoInterno, enderecoDoLogin } from "./destino-interno";

// docs/42 /login #2 e docs/43 §6 item 8: o callbackUrl só leva a um caminho interno (sem open redirect).

describe("destinoInterno", () => {
  it("aceita caminho interno, com query e fragmento", () => {
    expect(destinoInterno("/matriculas/m1")).toBe("/matriculas/m1");
    expect(destinoInterno("/matriculas/m1?aba=contrato&p=2")).toBe("/matriculas/m1?aba=contrato&p=2");
    expect(destinoInterno("/financeiro#fila")).toBe("/financeiro#fila");
    expect(destinoInterno("/")).toBe("/");
  });

  it("recusa URL externa e protocolo relativo, em qualquer grafia", () => {
    for (const externo of [
      "https://golpe.example/login",
      "http://golpe.example",
      "//golpe.example/x",
      "///golpe.example",
      "/\\golpe.example",
      "\\\\golpe.example",
      "javascript:alert(1)",
      "data:text/html,oi",
      "golpe.example",
      " /matriculas",
      "/.//golpe.example",
      "/a/..//golpe.example",
    ]) expect(destinoInterno(externo), externo).toBeNull();
  });

  it("recusa caractere de controle (o navegador o apaga e /\\t/ vira //)", () => {
    expect(destinoInterno("/\t/golpe.example")).toBeNull();
    expect(destinoInterno("/\n/golpe.example")).toBeNull();
    expect(destinoInterno("/x\u0000")).toBeNull();
    expect(destinoInterno("/x\u007f")).toBeNull();
  });

  it("recusa o próprio login (laço), a API, vazio, não-texto e texto longo demais", () => {
    expect(destinoInterno("/login")).toBeNull();
    expect(destinoInterno("/login?callbackUrl=%2Fhome")).toBeNull();
    expect(destinoInterno("/api/portal-aluno/sair")).toBeNull();
    expect(destinoInterno("/api")).toBeNull();
    expect(destinoInterno("")).toBeNull();
    expect(destinoInterno(null)).toBeNull();
    expect(destinoInterno(undefined)).toBeNull();
    expect(destinoInterno(42)).toBeNull();
    expect(destinoInterno(`/${"a".repeat(2048)}`)).toBeNull();
    // Rota que só começa parecida com o login continua valendo.
    expect(destinoInterno("/login-ajuda")).toBe("/login-ajuda");
  });
});

describe("destinoAposLogin", () => {
  it("usa o callbackUrl interno; externo, ausente ou inválido cai na página inicial", () => {
    expect(destinoAposLogin("/alunos/a1")).toBe("/alunos/a1");
    expect(destinoAposLogin("https://golpe.example")).toBe(DESTINO_PADRAO_APOS_LOGIN);
    expect(destinoAposLogin("//golpe.example")).toBe(DESTINO_PADRAO_APOS_LOGIN);
    expect(destinoAposLogin(null)).toBe(DESTINO_PADRAO_APOS_LOGIN);
    expect(DESTINO_PADRAO_APOS_LOGIN).toBe("/home");
  });
});

describe("enderecoDoLogin", () => {
  it("leva o caminho pedido codificado no callbackUrl", () => {
    expect(enderecoDoLogin("/matriculas/m1?aba=contrato")).toBe("/login?callbackUrl=%2Fmatriculas%2Fm1%3Faba%3Dcontrato");
  });

  it("sem caminho, com caminho externo ou com a própria página inicial, vai para /login puro", () => {
    expect(enderecoDoLogin(null)).toBe("/login");
    expect(enderecoDoLogin("//golpe.example")).toBe("/login");
    expect(enderecoDoLogin("/home")).toBe("/login");
  });
});
