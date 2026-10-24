import { describe, expect, it } from "vitest";
import { extrairMencoes, normalizarNotaComMencoes, tokensAposEdicao, consultaMencaoNoCursor, type TokenMencao } from "./mencoes-nota";

const pessoas = [{ id: "j1", nome: "João Silva" }, { id: "a1", nome: "Ána Maria" }];
describe("menções: aliases autorizados e inequívocos", () => {
  it.each([
    ["@joao, falar com @ANA MARIA.", ["j1", "a1"]],
    ["@Joa\u0303o Silva e @João", ["j1"]],
    ["email@joao.com / @joaosilva / @Anabela", []],
    ["(@João Silva), @Ána!", ["j1", "a1"]],
    ["Sem menções", []],
  ])("%s", (texto, ids) => expect(extrairMencoes(texto, pessoas)).toEqual(ids));
  it("não escolhe homônimo nem prefixo quando o nome completo é ambíguo", () => {
    expect(extrairMencoes("@João Silva e @João", [...pessoas, { id: "j2", nome: "João Silva" }])).toEqual([]);
    expect(extrairMencoes("@João Souza e @João", [...pessoas, { id: "j2", nome: "João Souza" }])).toEqual(["j2"]);
  });
  it("token explícito resolve homônimo, sem duplicar o prefixo para outra pessoa", () => {
    expect(extrairMencoes("@João Silva", [...pessoas, { id: "j2", nome: "João Silva" }], [{ usuarioId: "j2", inicio: 0, fim: 11 }])).toEqual(["j2"]);
  });
  it("token precisa corresponder ao nome do usuário e ao trecho inteiro", () => {
    expect(() => extrairMencoes("@João Silva", pessoas, [{ usuarioId: "a1", inicio: 0, fim: 11 }])).toThrow();
  });
});
describe("tokens: coordenadas da entrada normalizada e comando canônico", () => {
  it("CRLF/trim preservam coordenadas UTF16 do comando normalizado e acento decomposto", () => {
    expect(normalizarNotaComMencoes(" \r\n😀 @Joa\u0303o Silva\r\n ", [{ usuarioId: "j1", inicio: 3, fim: 15 }])).toEqual({ nota: "😀 @Joa\u0303o Silva", mencoes: [{ usuarioId: "j1", inicio: 3, fim: 15 }] });
  });
  it("ausência não cria campo novo e array presente tem ordem canônica", () => {
    expect(normalizarNotaComMencoes(" x ")).toEqual({ nota: "x" });
    expect(normalizarNotaComMencoes("@Ana @João", [{ usuarioId: "j", inicio: 5, fim: 10 }, { usuarioId: "a", inicio: 0, fim: 4 }]).mencoes).toEqual([{ usuarioId: "a", inicio: 0, fim: 4 }, { usuarioId: "j", inicio: 5, fim: 10 }]);
  });
  it.each([
    [{ usuarioId: "j", inicio: -1, fim: 4 }], [{ usuarioId: "j", inicio: 0.5, fim: 4 }],
    [{ usuarioId: "j", inicio: 0, fim: 99 }], [{ usuarioId: "j", inicio: 3, fim: 2 }],
    [{ usuarioId: "j", inicio: 1, fim: 4 }],
  ])("recusa limites inválidos/surrogate %j", token => expect(() => normalizarNotaComMencoes("😀 @João", [token])).toThrow());
  it("recusa sobreposição e excesso de tokens", () => {
    expect(() => normalizarNotaComMencoes("@Ana", [{ usuarioId: "a", inicio: 0, fim: 4 }, { usuarioId: "b", inicio: 0, fim: 4 }])).toThrow();
    expect(() => normalizarNotaComMencoes("@Ana", Array.from({ length: 51 }, () => ({ usuarioId: "a", inicio: 0, fim: 4 })))).toThrow();
  });
  const tokens: TokenMencao[] = [{ usuarioId: "a", inicio: 2, fim: 6 }];
  it.each([["x @Ana", "xx @Ana"], ["x @Ana", "x @Anaa"], ["x @Ana", "x @An"]])("editar antes/dentro invalida sem reassociar %s", (antes, depois) => expect(tokensAposEdicao(antes, depois, tokens)).toEqual([]));
  it("adicionar depois preserva seleção; comando não compartilha array mutável", () => {
    expect(tokensAposEdicao("x @Ana", "x @Ana depois", tokens)).toEqual(tokens);
    const resultado = normalizarNotaComMencoes("x @Ana", tokens); tokens[0].usuarioId = "outro";
    expect(resultado.mencoes?.[0].usuarioId).toBe("a");
  });
});
it("cursor controla consulta; email, prefixo incompleto e cursor externo não abrem lista", () => {
  expect(consultaMencaoNoCursor("Oi @Ana depois", 7)).toEqual({ inicio: 3, fim: 7, busca: "Ana" });
  expect(consultaMencaoNoCursor("email@Ana", 9)).toBeNull();
  expect(consultaMencaoNoCursor("@", 1)).toBeNull();
  expect(consultaMencaoNoCursor("@Ana", 0)).toBeNull();
});
