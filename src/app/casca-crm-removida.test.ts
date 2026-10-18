import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { tabsParaPapeis } from "@/app/(app)/configuracao/_componentes/tabs";
import { navParaPapeis } from "@/lib/nav";

// E1 (docs/planejamento/levantamento-troca-whatsapp-crm-novo.md, Parte 6): a casca do CRM antigo não volta.
const REMOVIDOS: string[] = ["src/server/whatsapp/cron-comercial.ts", "src/server/whatsapp/cron-gestao.ts", "src/app/(app)/pipeline", "src/app/(app)/carteiras", "src/app/(app)/configuracao/whatsapp/comercial", "src/app/(app)/configuracao/whatsapp/reguas", "src/app/(app)/configuracao/whatsapp/ComercialPainel.tsx", "src/app/(app)/configuracao/whatsapp/ReguaComercialPainel.tsx", "src/app/(app)/home/HomeVendedor.tsx", "src/components/CopilotoSugestoes.tsx", "src/server/ia"];
const IMPORTS_PROIBIDOS: string[] = ["@/server/whatsapp/cron-comercial", "./cron-comercial", "./cron-gestao", "@/server/whatsapp/cron-gestao", "@/components/CopilotoSugestoes", "@/server/ia/consultas", "@/server/ia/acoes", "@/server/ia/copiloto"];

const fontes = (readdirSync("src", { recursive: true }) as string[])
  .filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => join("src", f).split("\\").join("/"))
  .filter((f) => f !== "src/app/casca-crm-removida.test.ts");

describe("casca do CRM removida (E1)", () => {
  it.each(REMOVIDOS)("%s não existe", (caminho) => expect(existsSync(caminho)).toBe(false));
  it("nenhum arquivo importa módulo removido", () => {
    const achados = fontes.flatMap((f) => IMPORTS_PROIBIDOS.filter((m) => readFileSync(f, "utf8").includes(`"${m}"`)).map((m) => `${f} → ${m}`));
    expect(achados).toEqual([]);
  });
  it("Gerente Comercial só chega à aba CRM da Configuração (Fase 5F), não ao menu nem às demais abas", () => {
    expect(tabsParaPapeis([Papel.GERENTE_COMERCIAL]).map((t) => t.href)).toEqual(["/configuracao/crm"]);
    expect(navParaPapeis([Papel.GERENTE_COMERCIAL]).map((i) => i.href)).not.toContain("/configuracao");
  });
});
