import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { arquivosCliente, violacoesDeCliente } from "@/test/fronteira-cliente";

describe("fronteira cliente de /carteira", () => {
  it("componentes cliente não importam Prisma nem módulo de servidor que não seja action", () => {
    const arquivos = arquivosCliente("src/app/(app)/carteira");
    expect(arquivos.length).toBeGreaterThan(0);
    expect(violacoesDeCliente(arquivos)).toEqual([]);
  });

  it("o módulo que instancia o Prisma da carteira é server-only", () => {
    const fonte = readFileSync(path.join(process.cwd(), "src/server/crm/carteira.ts"), "utf8");
    expect(fonte).toMatch(/import\s+["']server-only["']/);
  });
});
