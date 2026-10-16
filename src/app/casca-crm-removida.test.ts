import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// E1 (docs/planejamento/levantamento-troca-whatsapp-crm-novo.md, Parte 6): a casca do CRM antigo não volta.
const REMOVIDOS: string[] = ["src/server/whatsapp/cron-comercial.ts", "src/server/whatsapp/cron-gestao.ts", "src/app/(app)/pipeline", "src/app/(app)/carteiras", "src/app/(app)/comissoes"];
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
});
