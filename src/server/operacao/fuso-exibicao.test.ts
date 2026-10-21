import { describe, expect, it } from "vitest";
import { formatarDiaCivilGravado, formatarInstanteExibicao, fusoInicialDeEntrada, resolverFusoExibicao } from "./fuso-exibicao";

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

// Fuso pessoal nas telas restantes (pendência da Q176): o mesmo instante, em estilos diferentes, sempre no fuso
// resolvido — nunca no fuso do servidor ou do navegador. As expectativas são fixas: passam igual em TZ=UTC e em
// TZ=America/Sao_Paulo (a suíte roda nos dois).
describe("formatarInstanteExibicao: estilos, sem depender do TZ do processo", () => {
  const virada = "2026-10-21T02:30:00.000Z"; // 20/10 23:30 em São Paulo; 20/10 20:30 em Costa Rica; 21/10 em UTC

  it("dataHora (padrão), data, hora e diaMesHora no fuso pessoal", () => {
    expect(formatarInstanteExibicao(virada, "America/Costa_Rica", "UTC").texto).toBe("20/10/2026, 20:30");
    expect(formatarInstanteExibicao(virada, "America/Costa_Rica", "UTC", "data").texto).toBe("20/10/2026");
    expect(formatarInstanteExibicao(virada, "America/Costa_Rica", "UTC", "hora").texto).toBe("20:30");
    expect(formatarInstanteExibicao(virada, "America/Costa_Rica", "UTC", "diaMesHora").texto).toBe("20/10, 20:30");
  });

  it("sem preferência, o fuso de origem (ex.: o da escola) — e não o do servidor", () => {
    expect(formatarInstanteExibicao(virada, null, "America/Sao_Paulo", "data")).toEqual({ texto: "20/10/2026", fuso: "America/Sao_Paulo" });
    expect(formatarInstanteExibicao(virada, null, "UTC", "data")).toEqual({ texto: "21/10/2026", fuso: "UTC" });
  });

  it("hora é sempre 24h (meia-noite é 00, não 24)", () => {
    expect(formatarInstanteExibicao("2026-10-21T03:05:00.000Z", "America/Sao_Paulo", "UTC", "hora").texto).toBe("00:05");
  });

  it("valor inválido volta como está", () => {
    expect(formatarInstanteExibicao("ontem", "America/Sao_Paulo", "UTC", "hora").texto).toBe("ontem");
  });
});

describe("formatarDiaCivilGravado: data civil gravada (promessa, pagamento) no dia da escola, sem fuso pessoal", () => {
  it("meio-dia da escola, meia-noite da escola e meia-noite UTC dão o mesmo dia", () => {
    expect(formatarDiaCivilGravado("2026-10-05T15:00:00.000Z", "America/Sao_Paulo")).toBe("05/10/2026");
    expect(formatarDiaCivilGravado("2026-10-05T03:00:00.000Z", "America/Sao_Paulo")).toBe("05/10/2026");
    expect(formatarDiaCivilGravado("2026-10-05T00:00:00.000Z", "America/Sao_Paulo")).toBe("05/10/2026");
    expect(formatarDiaCivilGravado(new Date("2026-10-05T18:00:00.000Z"), "America/Costa_Rica")).toBe("05/10/2026");
  });

  it("fuso da escola inválido cai no dia UTC; valor inválido volta como está; ausente vira —", () => {
    expect(formatarDiaCivilGravado("2026-10-05T00:00:00.000Z", "")).toBe("05/10/2026");
    expect(formatarDiaCivilGravado("x", "America/Sao_Paulo")).toBe("x");
    expect(formatarDiaCivilGravado(null, "America/Sao_Paulo")).toBe("—");
  });
});
