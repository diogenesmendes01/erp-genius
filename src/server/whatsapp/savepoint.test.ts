import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { resumoDoErro } from "./savepoint";

describe("resumoDoErro", () => {
  it("guarda_nome_e_codigos_sem_a_mensagem", () => {
    const e = new Prisma.PrismaClientKnownRequestError("valor +5511999990000 inválido", { code: "P2010", clientVersion: "5.22.0", meta: { code: "22012" } });
    const r = resumoDoErro(e);
    expect(r).toEqual({ nome: "PrismaClientKnownRequestError", codigo: "P2010", codigoBanco: "22012" });
    expect(JSON.stringify(r)).not.toContain("+5511999990000");
  });

  it("erro_comum_e_valor_que_nao_e_erro", () => {
    expect(resumoDoErro(new TypeError("Oi, Maria"))).toEqual({ nome: "TypeError", codigo: null, codigoBanco: null });
    expect(resumoDoErro("texto solto")).toEqual({ nome: "string", codigo: null, codigoBanco: null });
  });
});
