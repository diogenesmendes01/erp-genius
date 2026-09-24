import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// E6 (docs/42-auditoria-frontend-ux.md): grade de formulário com `grid-cols-2` como base deixa cada
// campo com ~140px num celular de 375px. A base é uma coluna (`grid-cols-1 sm:grid-cols-2 …`).
// Exceção deliberada: blocos de indicadores (KPIs), em que dois por linha no celular é o desenho.
const KPIS_DUAS_COLUNAS = new Set([
  "src/app/(app)/alunos/[id]/financeiro/FichaFinanceira.tsx",
  "src/app/(app)/financeiro/FilaCobranca.tsx",
  "src/app/(app)/financeiro/FinanceiroPainel.tsx",
  "src/app/(app)/home/HomeGerente.tsx",
  "src/app/(app)/home/HomeVendedor.tsx",
  "src/app/(app)/leads/[id]/FichaLead.tsx",
]);

const telas = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

/** `grid-cols-N` (N ≥ 2) sem prefixo de breakpoint, dentro de uma string de classes. */
const BASE_MULTICOLUNA = /["'`\s]grid-cols-([2-9]|1[0-2])(?=["'`\s])/;

describe("grades responsivas", () => {
  it("nenhuma grade usa mais de uma coluna como base no celular (fora os KPIs listados)", () => {
    const ofensores = telas
      .filter(({ arquivo }) => !KPIS_DUAS_COLUNAS.has(arquivo))
      .flatMap(({ arquivo, conteudo }) =>
        conteudo.split("\n").map((l, i) => (BASE_MULTICOLUNA.test(l) ? `${arquivo}:${i + 1}` : "")).filter(Boolean));
    expect(ofensores).toEqual([]);
  });

  it("a exceção de KPIs não sobra: cada arquivo listado ainda tem a grade de indicadores", () => {
    const sobrando = [...KPIS_DUAS_COLUNAS].filter((a) => !telas.some((t) => t.arquivo === a && BASE_MULTICOLUNA.test(t.conteudo)));
    expect(sobrando).toEqual([]);
  });

  it("o detector aceita a base de uma coluna e acusa a de duas", () => {
    expect(BASE_MULTICOLUNA.test('className="grid grid-cols-2 gap-4"')).toBe(true);
    expect(BASE_MULTICOLUNA.test('className="grid grid-cols-1 sm:grid-cols-2 gap-4"')).toBe(false);
    expect(BASE_MULTICOLUNA.test('className="grid gap-2 md:grid-cols-3"')).toBe(false);
  });
});
