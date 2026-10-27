import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { tabsParaPapeis } from "@/app/(app)/configuracao/_componentes/tabs";
import { navParaPapeis } from "@/lib/nav";

describe("casca do CRM removida (E1)", () => {
  it("Gerente Comercial só chega à aba CRM da Configuração (Fase 5F; as Metas da 5E são uma seção dela), não ao menu nem às demais abas", () => {
    expect(tabsParaPapeis([Papel.GERENTE_COMERCIAL]).map((t) => t.href)).toEqual(["/configuracao/crm"]);
    expect(navParaPapeis([Papel.GERENTE_COMERCIAL]).map((i) => i.href)).not.toContain("/configuracao");
  });
});
