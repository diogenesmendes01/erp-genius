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

// Agendadores do portal do aluno e dos avisos de agenda: antes as rotas existiam sem ninguém chamá-las.
// Com a flag desligada a rota responde {executou:false} (coberto nos testes das rotas).
const NOVOS_CRONS = [
  { servico: "cron-portal-envios", rota: "http://app:3000/api/portal-aluno/envios/cron", sono: "sleep 60" },
  { servico: "cron-avisos-agenda", rota: "http://app:3000/api/agenda/avisos/cron", sono: "sleep 300" },
];
for (const arq of ["docker-compose.prod.yml", "docker-compose.coolify.yml"]) {
  describe(`${arq}: agendadores do portal e da agenda`, () => {
    const texto = fs.readFileSync(path.resolve(process.cwd(), arq), "utf8").replace(/\r\n/g, "\n");
    it.each(NOVOS_CRONS)("$servico faz POST autenticado em laço", ({ servico, rota, sono }) => {
      const m = texto.match(new RegExp(`^  ${servico}:\\n([\\s\\S]*?)(?=\\n  \\S|\\nvolumes:|(?![\\s\\S]))`, "m"));
      expect(m, servico).not.toBeNull();
      const corpo = m![1];
      expect(corpo).toContain("image: curlimages/curl:8.10.1");
      expect(corpo).toContain("restart: unless-stopped");
      expect(corpo).toContain("while true");
      expect(corpo).toContain("-X POST");
      expect(corpo).toContain('-H "x-cron-secret: $$CRON_SECRET"');
      expect(corpo).toContain(rota);
      expect(corpo).toContain(sono);
      expect(corpo).toMatch(/CRON_SECRET: \$\{CRON_SECRET:\?defina/);
      expect(corpo).toMatch(/depends_on:\n\s+- app/);
      expect(corpo).not.toMatch(/^\s+ports:/m);
    });
  });
}
