import { describe, expect, it } from "vitest";
import { ErroRegra } from "@/server/_shared";
import { MSG_FINANCEIRO_EXIGE_MATRICULA, MSG_MATRICULA_DE_OUTRO_ALUNO, MSG_MATRICULA_EXIGE_ALUNO, comoErroRegra } from "./erro-regra-atendimento";

function capturar(e: unknown): unknown {
  try { comoErroRegra(e); } catch (x) { return x; }
  throw new Error("comoErroRegra deveria lançar");
}

describe("comoErroRegra", () => {
  it("mantém o ErroRegra recebido", () => {
    const e = new ErroRegra("Atendimento encerrado.");
    expect(capturar(e)).toBe(e);
  });

  it("converte o RAISE EXCEPTION (P0001) do banco na mensagem do trigger", () => {
    class PrismaClientUnknownRequestError extends Error {}
    const e = new PrismaClientUnknownRequestError('Invalid `prisma.x()` invocation: Raw query failed. Code: `P0001`. Message: `ERROR: x`... code: "P0001", message: "Contexto pedagógico inválido \\"264\\"."');
    const r = capturar(e);
    expect(r).toBeInstanceOf(ErroRegra);
    expect((r as Error).message).toBe('Contexto pedagógico inválido \\"264\\".');
  });

  it.each([MSG_FINANCEIRO_EXIGE_MATRICULA, MSG_MATRICULA_EXIGE_ALUNO, MSG_MATRICULA_DE_OUTRO_ALUNO])("converte a regra conhecida de garantirAtendimento: %s", (msg) => {
    const r = capturar(new Error(msg));
    expect(r).toBeInstanceOf(ErroRegra);
    expect((r as Error).message).toBe(msg);
  });

  it.each([
    ["TypeError", new TypeError("Cannot read properties of undefined (reading 'id')")],
    ["ReferenceError", new ReferenceError("x is not defined")],
    ["Error desconhecido", new Error("falha ao gravar evento")],
    ["subclasse com mensagem conhecida", new TypeError(MSG_FINANCEIRO_EXIGE_MATRICULA)],
  ])("relança sem mudar: %s", (_nome, e) => {
    expect(capturar(e)).toBe(e);
  });

  it("relança erro do Prisma sem P0001 e valores que não são Error", () => {
    class PrismaClientKnownRequestError extends Error {}
    const e = new PrismaClientKnownRequestError("Unique constraint failed");
    expect(capturar(e)).toBe(e);
    expect(capturar("texto")).toBe("texto");
  });
});
