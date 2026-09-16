import { afterEach, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { conferirDependenciasInstaladas } from "./dependencias";

const temporarios: string[] = [];
afterEach(() => {
  for (const raiz of temporarios.splice(0)) {
    const destino = resolve(raiz);
    if (dirname(destino) !== resolve(tmpdir()) || !basename(destino).startsWith("erp-dependencias-")) {
      throw new Error("Diretório temporário fora do escopo do teste.");
    }
    rmSync(destino, { recursive: true, force: true });
  }
});
function preparar(instalada = "1.2.3") {
  const raiz = mkdtempSync(join(tmpdir(), "erp-dependencias-")); temporarios.push(raiz);
  const manifesto = { dependencies: { biblioteca: "^1.2.0" }, devDependencies: { ferramenta: "2.0.0" } };
  writeFileSync(join(raiz, "package.json"), JSON.stringify(manifesto));
  writeFileSync(join(raiz, "package-lock.json"), JSON.stringify({ packages: {
    "": manifesto, "node_modules/biblioteca": { version: "1.2.3" }, "node_modules/ferramenta": { version: "2.0.0" },
    "node_modules/opcional-outro-sistema": { version: "9.0.0", optional: true },
  } }));
  for (const [nome, version] of [["biblioteca", instalada], ["ferramenta", "2.0.0"]]) {
    mkdirSync(join(raiz, "node_modules", nome), { recursive: true });
    writeFileSync(join(raiz, "node_modules", nome, "package.json"), JSON.stringify({ version }));
  }
  return raiz;
}
it("aceita versões diretas travadas sem exigir opcional de outra plataforma", () => {
  expect(() => conferirDependenciasInstaladas(preparar())).not.toThrow();
});
it("recusa atualização dentro do mesmo intervalo sem alterar o ambiente", () => {
  const raiz = preparar("1.9.0");
  const caminho = join(raiz, "node_modules/biblioteca/package.json"), antes = readFileSync(caminho, "utf8");
  expect(() => conferirDependenciasInstaladas(raiz)).toThrow("lock=1.2.3, instalada=1.9.0");
  expect(readFileSync(caminho, "utf8")).toBe(antes);
});
it("recusa manifesto divergente mesmo com versão instalada correta", () => {
  const raiz = preparar();
  writeFileSync(join(raiz, "package.json"), JSON.stringify({ dependencies: { biblioteca: "^1.3.0" }, devDependencies: { ferramenta: "2.0.0" } }));
  expect(() => conferirDependenciasInstaladas(raiz)).toThrow("manifesto e lockfile divergentes");
});
it("recusa ferramenta de teste ausente", () => {
  const raiz = preparar();
  rmSync(join(raiz, "node_modules/ferramenta/package.json"));
  expect(() => conferirDependenciasInstaladas(raiz)).toThrow("ferramenta: lock=2.0.0, instalada=ausente");
});
