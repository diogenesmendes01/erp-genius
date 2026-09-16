import { readFileSync } from "node:fs";
import { join } from "node:path";

type Manifesto = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
type Lockfile = { packages: Record<string, Manifesto & { version?: string }> };

/** Não instala nem altera arquivos. Confere dependências diretas, incluindo as
 * ferramentas de teste, contra as versões exatas do lockfile npm do projeto. */
export function conferirDependenciasInstaladas(raiz = process.cwd()) {
  const manifesto: Manifesto = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8"));
  const lock: Lockfile = JSON.parse(readFileSync(join(raiz, "package-lock.json"), "utf8"));
  const problemas: string[] = [];
  for (const grupo of ["dependencies", "devDependencies"] as const) {
    const declaradas = manifesto[grupo] ?? {}, travadas = lock.packages[""]?.[grupo] ?? {};
    for (const nome of new Set([...Object.keys(declaradas), ...Object.keys(travadas)])) {
      if (declaradas[nome] !== travadas[nome]) {
        problemas.push(`${nome}: manifesto e lockfile divergentes`);
        continue;
      }
      const esperada = lock.packages[`node_modules/${nome}`]?.version;
      let instalada: string | undefined;
      try { instalada = JSON.parse(readFileSync(join(raiz, "node_modules", nome, "package.json"), "utf8")).version; }
      catch { /* Ausência ou manifesto inválido não comprovam a versão. */ }
      if (!esperada || instalada !== esperada) problemas.push(`${nome}: lock=${esperada ?? "ausente"}, instalada=${instalada ?? "ausente"}`);
    }
  }
  if (problemas.length) throw new Error(`Dependências inconsistentes; estabilize o ambiente antes dos testes de banco:\n${problemas.join("\n")}`);
}
