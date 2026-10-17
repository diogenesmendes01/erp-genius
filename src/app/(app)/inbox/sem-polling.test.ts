import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Arquivos do Inbox antigo, que a Task 33 remove; até lá eles ainda têm `router.refresh()` e `setInterval`.
// Esta lista só pode encolher: a Task 33 apaga o teste do legado junto com os arquivos.
const RAIZ = "src/app/(app)/inbox";
const LEGADO = ["src/app/(app)/inbox/InboxCliente.tsx", "src/app/(app)/inbox/AtendimentosPainel.tsx"];

describe("inbox sem polling", () => {
  it("nenhum arquivo do inbox faz polling", () => {
    const arquivos = (readdirSync(RAIZ, { recursive: true }) as string[]).map((f) => `${RAIZ}/${f}`)
      .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts") && !LEGADO.includes(f));
    expect(arquivos.length).toBeGreaterThan(0);
    for (const f of arquivos) expect(readFileSync(f, "utf8"), f).not.toMatch(/setInterval\(|router\.refresh\(\)/);
  });
  it("a tela nova usa o SSE", () => {
    expect(readFileSync("src/app/(app)/inbox/useEventosInbox.ts", "utf8")).toContain('new EventSource("/api/inbox/eventos")');
  });
});
