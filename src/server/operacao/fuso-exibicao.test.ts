import { describe, expect, it } from "vitest";
import { formatarInstanteExibicao, resolverFusoExibicao } from "./fuso-exibicao";

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
