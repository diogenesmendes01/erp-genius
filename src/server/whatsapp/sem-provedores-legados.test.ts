import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Trava da Task 25 (Fase 4): Meta Cloud e Evolution saíram do código. Só rótulos de enum legado,
// o comentário da porta do canal e este próprio arquivo podem citá-los.
const PROIBIDOS = [
  /EVOLUTION_[A-Z_]+/,
  /META_WA_[A-Z_]+/,
  /driverEvolution|driverMetaCloud/,
  /evolution-jid|meta-templates/,
  /["']BAILEYS["']/,
  /["']META_CLOUD["']/,
  /[A-Za-z_]Evolution\b|\bEvolution[A-Z_]/,
];
const PERMITIDOS = new Set(["src/lib/labels.ts", "src/server/whatsapp/canal.ts", "src/server/whatsapp/sem-provedores-legados.test.ts"]);

function listarFontes(dir: string): { caminho: string; conteudo: string }[] {
  const raiz = process.cwd();
  const saida: { caminho: string; conteudo: string }[] = [];
  const andar = (d: string) => {
    for (const nome of readdirSync(d)) {
      const completo = join(d, nome);
      if (statSync(completo).isDirectory()) andar(completo);
      else if (/\.(ts|tsx)$/.test(nome)) saida.push({ caminho: relative(raiz, completo).split("\\").join("/"), conteudo: readFileSync(completo, "utf8") });
    }
  };
  andar(join(raiz, dir));
  return saida;
}

describe("sem provedores legados", () => {
  it("nenhum arquivo de src cita Meta/Evolution fora dos permitidos", () => {
    const achados = listarFontes("src")
      .filter((f) => !PERMITIDOS.has(f.caminho) && PROIBIDOS.some((r) => r.test(f.conteudo)))
      .map((f) => f.caminho);
    expect(achados).toEqual([]);
  });
});
