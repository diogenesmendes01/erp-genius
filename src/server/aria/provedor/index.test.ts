import { afterEach, describe, expect, it } from "vitest";
import { chaveConfigurada, escolherProvedor } from "./index";

const M = { conversa: "claude-sonnet-5-5", classificacao: "claude-haiku-5-5" };
const original = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = original;
});

describe("escolherProvedor", () => {
  it("sem_chave_ou_chave_em_branco_usa_simulado", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(escolherProvedor(M).nome).toBe("simulado");
    process.env.ANTHROPIC_API_KEY = "  ";
    expect(escolherProvedor(M).nome).toBe("simulado");
    expect(chaveConfigurada()).toBe(false);
  });
});
