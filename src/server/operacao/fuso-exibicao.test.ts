import { describe, expect, it } from "vitest";
import { formatarInstanteExibicao, fusoInicialDeEntrada, resolverFusoExibicao } from "./fuso-exibicao";

// docs/43 §6 item 6: o valor inicial de um campo de fuso de entrada.
describe("fusoInicialDeEntrada", () => {
  it("fuso da escola; sem ele, a preferência; sem nenhum válido, vazio — nunca UTC presumido", () => {
    expect(fusoInicialDeEntrada("America/Sao_Paulo", "America/Costa_Rica")).toBe("America/Sao_Paulo");
    expect(fusoInicialDeEntrada(null, "America/Costa_Rica")).toBe("America/Costa_Rica");
    expect(fusoInicialDeEntrada("fuso-invalido", " America/Manaus ")).toBe("America/Manaus");
    expect(fusoInicialDeEntrada(null, null)).toBe("");
    expect(fusoInicialDeEntrada(undefined, "Factory")).toBe("");
  });
});

describe("fuso pessoal de exibição", () => {
  it("prefere IANA pessoal e preserva origem para preferência ausente ou inválida", () => {
    expect(resolverFusoExibicao("America/Costa_Rica", "America/Sao_Paulo")).toBe("America/Costa_Rica");
    expect(resolverFusoExibicao(null, "America/Sao_Paulo")).toBe("America/Sao_Paulo");
    expect(resolverFusoExibicao("fuso-invalido", "America/Sao_Paulo")).toBe("America/Sao_Paulo");
    expect(resolverFusoExibicao("Factory", "origem-legada-invalida")).toBe("UTC");
  });

  it("formata apenas o instante, sem reescrever sua origem", () => {
    const exibicao = formatarInstanteExibicao("2099-02-01T02:30:00.000Z", "America/Costa_Rica", "America/Sao_Paulo");
    expect(exibicao).toMatchObject({ fuso: "America/Costa_Rica" });
    expect(exibicao.texto).toContain("31/01/2099");
  });
});
