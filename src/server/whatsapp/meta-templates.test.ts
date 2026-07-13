import { describe, it, expect } from "vitest";
import { corpoParaMeta, statusMetaParaLocal } from "./meta-templates";

// Conversão amigável → posicional (doc 26 §Camada 2, Marco 2) + mapa de status da Meta.

describe("corpoParaMeta", () => {
  it("converte variáveis amigáveis para posicionais na ordem de aparição", () => {
    const r = corpoParaMeta("Olá {nome}, sua mensalidade de {valor} vence em {vencimento}.");
    expect(r.texto).toBe("Olá {{1}}, sua mensalidade de {{2}} vence em {{3}}.");
    expect(r.variaveis).toEqual(["nome", "valor", "vencimento"]);
    expect(r.exemplos).toHaveLength(3);
  });

  it("variável repetida ganha posição nova (regra da Meta)", () => {
    const r = corpoParaMeta("{nome}, confirma? {nome}?");
    expect(r.texto).toBe("{{1}}, confirma? {{2}}?");
    expect(r.variaveis).toEqual(["nome", "nome"]);
  });

  it("corpo sem variáveis passa intacto e sem exemplos", () => {
    const r = corpoParaMeta("Bom dia! Seguem os dados de pagamento.");
    expect(r.texto).toBe("Bom dia! Seguem os dados de pagamento.");
    expect(r.exemplos).toEqual([]);
  });

  it("chave desconhecida não é tratada como variável", () => {
    const r = corpoParaMeta("Olá {nome}, código {pedido}.");
    expect(r.texto).toBe("Olá {{1}}, código {pedido}.");
    expect(r.variaveis).toEqual(["nome"]);
  });
});

describe("statusMetaParaLocal", () => {
  it("mapeia o ciclo da Meta para o enum local", () => {
    expect(statusMetaParaLocal("APPROVED")).toBe("APROVADO");
    expect(statusMetaParaLocal("REJECTED")).toBe("REJEITADO");
    expect(statusMetaParaLocal("PAUSED")).toBe("REJEITADO");
    expect(statusMetaParaLocal("PENDING")).toBe("EM_REVISAO");
    expect(statusMetaParaLocal("IN_APPEAL")).toBe("EM_REVISAO");
    expect(statusMetaParaLocal("qualquer-coisa")).toBeNull();
    expect(statusMetaParaLocal(null)).toBeNull();
  });
});
