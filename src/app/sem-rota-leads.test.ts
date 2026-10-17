import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(process.cwd(), "src");

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? listar(caminho) : [caminho];
  });
}

function arquivosSrc() {
  return listar(RAIZ)
    .filter((c) => /\.(ts|tsx)$/.test(c) && !/\.test\.tsx?$/.test(c))
    .map((c) => ({ arquivo: relative(process.cwd(), c), conteudo: readFileSync(c, "utf8") }));
}

// Fora da pasta de /leads, só a navegação e a trilha (somem com a Tarefa 37) e o fallback da Secretaria
// na contratação (a Secretaria não acessa /funil até a Tarefa 37) ainda citam a rota antiga.
const ATE_TAREFA_37 = ["src/lib/nav.ts", "src/lib/trilha.ts", "src/app/(app)/oportunidades/[id]/contratacao/page.tsx"];

describe("saída de /leads", () => {
  it("nenhum link ou revalidate aponta para /leads fora da própria pasta", () => {
    const ofensores = arquivosSrc().filter(
      (a) => !a.arquivo.includes("src/app/(app)/leads/") && !ATE_TAREFA_37.includes(a.arquivo) && /["'`]\/leads(?:[/?"'`$]|\$\{)/.test(a.conteudo),
    );
    expect(ofensores.map((o) => o.arquivo)).toEqual([]);
  });
});
