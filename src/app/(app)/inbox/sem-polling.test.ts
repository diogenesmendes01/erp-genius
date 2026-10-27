import { readdirSync, readFileSync } from "node:fs";
import { contratoPresencaValido, MODULO_PRESENCA } from "@/test/contrato-presenca";
import { describe, expect, it } from "vitest";

const RAIZ = "src/app/(app)/inbox";
const LEGADO: string[] = [];

describe("inbox sem polling", () => {
  it("nenhum arquivo do inbox faz polling", () => {
    const arquivos = (readdirSync(RAIZ, { recursive: true }) as string[]).map((f) => `${RAIZ}/${f}`)
      .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts") && !LEGADO.includes(f));
    arquivos.push("src/lib/eventos-inbox.ts", "src/components/SeloNaoLidasInbox.tsx", MODULO_PRESENCA);
    expect(arquivos.length).toBeGreaterThan(0);
    for (const f of arquivos) {
      const fonte=readFileSync(f,"utf8");
      if(f===MODULO_PRESENCA) expect(contratoPresencaValido(f,fonte),f).toBe(true);
      else expect(fonte,f).not.toMatch(/setInterval\(|router\.refresh\(\)/);
    }
  });
  it("a tela nova usa o SSE", () => {
    expect(readFileSync("src/lib/eventos-inbox.ts", "utf8")).toContain('new EventSource("/api/inbox/eventos")');
  });
});
