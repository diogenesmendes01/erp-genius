import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { tabsParaPapeis } from "@/app/(app)/configuracao/_componentes/tabs";
import { navParaPapeis } from "@/lib/nav";

// E1 (docs/planejamento/levantamento-troca-whatsapp-crm-novo.md, Parte 6): a casca do CRM antigo não volta.
const REMOVIDOS: string[] = ["src/server/whatsapp/cron-comercial.ts", "src/server/whatsapp/cron-gestao.ts", "src/app/(app)/pipeline", "src/app/(app)/carteiras", "src/app/(app)/comissoes", "src/app/(app)/configuracao/whatsapp/comercial", "src/app/(app)/configuracao/whatsapp/reguas", "src/app/(app)/configuracao/whatsapp/ComercialPainel.tsx", "src/app/(app)/configuracao/whatsapp/ReguaComercialPainel.tsx", "src/app/(app)/home/HomeVendedor.tsx"];
const IMPORTS_PROIBIDOS: string[] = ["@/server/whatsapp/cron-comercial", "./cron-comercial", "./cron-gestao", "@/server/whatsapp/cron-gestao"];

const fontes = (readdirSync("src", { recursive: true }) as string[])
  .filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => join("src", f).split("\\").join("/"))
  .filter((f) => f !== "src/app/casca-crm-removida.test.ts");

describe("casca do CRM removida (E1)", () => {
  it.each(REMOVIDOS)("%s não existe", (caminho) => expect(existsSync(caminho)).toBe(false));
  it("nenhum arquivo importa módulo removido", () => {
    const achados = fontes.flatMap((f) => IMPORTS_PROIBIDOS.filter((m) => readFileSync(f, "utf8").includes(`"${m}"`)).map((m) => `${f} → ${m}`));
    expect(achados).toEqual([]);
  });
  it("nenhuma tela aponta para /comissoes", () => {
    const telas = fontes.filter((f) => f.endsWith(".tsx"));
    expect(telas.filter((f) => /href=["{`]+\/comissoes["?`]/.test(readFileSync(f, "utf8")))).toEqual([]);
  });
  it("Gerente Comercial não chega à Configuração por menu nem por aba", () => {
    expect(tabsParaPapeis([Papel.GERENTE_COMERCIAL])).toEqual([]);
    expect(navParaPapeis([Papel.GERENTE_COMERCIAL]).map((i) => i.href)).not.toContain("/configuracao");
  });
});
