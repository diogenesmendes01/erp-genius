import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

describe("saída de /leads", () => {
  it("nenhum link ou revalidate aponta para /leads em lugar nenhum de src", () => {
    const ofensores = arquivosSrc().filter(
      (a) => /["'`]\/leads(?:[/?"'`$]|\$\{)/.test(a.conteudo),
    );
    expect(ofensores.map((o) => o.arquivo)).toEqual([]);
  });

  it("a rota /leads não existe mais", () => expect(existsSync("src/app/(app)/leads")).toBe(false));

  it("Preparar contratação, link de pagamento e exportar leads têm casa nova", () => {
    expect(existsSync("src/app/(app)/oportunidades/[id]/contratacao/page.tsx")).toBe(true);
    expect(readFileSync("src/app/(app)/funil/PainelOportunidade.tsx", "utf-8")).toContain("registrarLinkPagamento");
    expect(readFileSync("src/app/(app)/funil/page.tsx", "utf-8")).toContain("/api/exportacoes/leads");
  });
});
