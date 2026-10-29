import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { tabsParaPapeis } from "@/app/(app)/configuracao/_componentes/tabs";
import { navParaPapeis } from "@/lib/nav";

describe("casca do CRM removida (E1)", () => {
  it("Gerente Comercial entra em Configuração pela aba CRM e o Vendedor consulta Empresas", () => {
    expect(tabsParaPapeis([Papel.GERENTE_COMERCIAL]).map((t) => t.href)).toEqual(["/configuracao/crm"]);
    expect(navParaPapeis([Papel.GERENTE_COMERCIAL]).map((i) => i.href)).toContain("/configuracao");
    expect(navParaPapeis([Papel.VENDEDOR]).map((i) => i.href)).toContain("/empresas");
  });
});
