import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// E6 (docs/42-auditoria-frontend-ux.md): grade de formulário com `grid-cols-2` como base deixa cada
// campo com ~140px num celular de 375px. A base é uma coluna (`grid-cols-1 sm:grid-cols-2 …`).
// Exceção deliberada: blocos de indicadores (KPIs), em que dois por linha no celular é o desenho.
// A exceção é CONTADA por arquivo (uma grade de KPI em cada): uma segunda grade de duas colunas
// no mesmo arquivo — um formulário novo, por exemplo — ainda falha.
const KPIS_DUAS_COLUNAS: Record<string, number> = {
  "src/app/(app)/alunos/[id]/financeiro/FichaFinanceira.tsx": 1,
  "src/app/(app)/financeiro/FilaCobranca.tsx": 1,
  "src/app/(app)/financeiro/FinanceiroPainel.tsx": 1,
  "src/app/(app)/home/HomeGerente.tsx": 1,
  "src/app/(app)/home/HomeVendedor.tsx": 1,
  "src/app/(app)/leads/[id]/FichaLead.tsx": 1,
};

const telas = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

/** `grid-cols-N` (N ≥ 2) sem prefixo de breakpoint, dentro de uma string de classes. */
const BASE_MULTICOLUNA = /["'`\s]grid-cols-([2-9]|1[0-2])(?=["'`\s])/g;
/** `col-span-N` (N ≥ 2) sem prefixo: numa grade de uma coluna, recria a segunda. */
const COL_SPAN_BASE = /["'`\s]col-span-([2-9]|1[0-2])(?=["'`\s])/g;

const ocorrencias = (conteudo: string, re: RegExp) =>
  conteudo.split("\n").flatMap((l, i) => [...l.matchAll(re)].map(() => i + 1));

describe("grades responsivas", () => {
  it("nenhuma grade usa mais de uma coluna como base no celular (fora as grades de KPI contadas)", () => {
    const ofensores = telas.flatMap(({ arquivo, conteudo }) => {
      const linhas = ocorrencias(conteudo, BASE_MULTICOLUNA);
      return linhas.length > (KPIS_DUAS_COLUNAS[arquivo] ?? 0) ? [`${arquivo}:${linhas.join(",")}`] : [];
    });
    expect(ofensores).toEqual([]);
  });

  it("nenhum item ocupa duas+ colunas como base (col-span-2 numa grade de uma coluna recria a segunda)", () => {
    const ofensores = telas.flatMap(({ arquivo, conteudo }) => ocorrencias(conteudo, COL_SPAN_BASE).map((l) => `${arquivo}:${l}`));
    expect(ofensores).toEqual([]);
  });

  it("a exceção de KPIs não sobra: cada arquivo listado ainda tem as suas grades de indicadores", () => {
    const sobrando = Object.entries(KPIS_DUAS_COLUNAS).filter(([a, n]) => (ocorrencias(telas.find((t) => t.arquivo === a)?.conteudo ?? "", BASE_MULTICOLUNA).length) < n);
    expect(sobrando).toEqual([]);
  });

  it("os detectores aceitam a base de uma coluna e acusam a de duas", () => {
    expect(ocorrencias('className="grid grid-cols-2 gap-4"', BASE_MULTICOLUNA)).toHaveLength(1);
    expect(ocorrencias('className="grid grid-cols-1 sm:grid-cols-2 gap-4"', BASE_MULTICOLUNA)).toHaveLength(0);
    expect(ocorrencias('className="grid gap-2 md:grid-cols-3"', BASE_MULTICOLUNA)).toHaveLength(0);
    expect(ocorrencias('className="col-span-2 md:col-span-1"', COL_SPAN_BASE)).toHaveLength(1);
    expect(ocorrencias('className="sm:col-span-2 md:col-span-1"', COL_SPAN_BASE)).toHaveLength(0);
  });
});
