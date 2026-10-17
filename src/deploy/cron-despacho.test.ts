import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

// Os dois composes têm um laço de despacho a cada minuto, além do tick de 5 min da régua.
for (const arq of ["docker-compose.prod.yml", "docker-compose.coolify.yml"]) {
  describe(arq, () => {
    const texto = fs.readFileSync(path.resolve(process.cwd(), arq), "utf8").replace(/\r\n/g, "\n");
    it("laço de despacho chama /api/whatsapp/despacho e dorme 60 s", () => {
      const m = texto.match(/cron-despacho:\n([\s\S]*?)(?=\n  \S|\nvolumes:|$)/);
      expect(m).not.toBeNull();
      expect(m![1]).toContain("while true");
      expect(m![1]).toContain("/api/whatsapp/despacho");
      expect(m![1]).toContain("sleep 60");
      expect(m![1]).toContain("x-cron-secret");
    });
    it("o tick de 5 min da régua continua", () => {
      expect(texto).toContain("/api/whatsapp/cron");
      expect(texto).toContain("sleep 300");
    });
  });
}
