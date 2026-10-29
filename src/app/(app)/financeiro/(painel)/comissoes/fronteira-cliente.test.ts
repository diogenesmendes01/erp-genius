import { describe, expect, it } from "vitest";
import { especificadoresDeRuntime } from "@/test/fronteira-cliente";

const PAINEL = "src/app/(app)/financeiro/FinanceiroPainel.tsx";

describe("fronteira cliente de /financeiro/comissoes", () => {
  it("a aba cliente não importa o runtime do Prisma", () => {
    const prisma = especificadoresDeRuntime(PAINEL).filter((spec) => spec === "@prisma/client" || spec === "@/lib/prisma" || spec.startsWith("@/lib/prisma/"));
    expect(prisma).toEqual([]);
  });
});
