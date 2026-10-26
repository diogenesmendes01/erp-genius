import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

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

// #365: grade de ícones do menu Anexar, diferente de campos de formulário.
// A exceção tem um único elemento, atributos e classes exatos; outra grade continua acusada.
function menuAnexosTresColunas(arquivo: string, conteudo: string): Set<number> {
  if (arquivo !== "src/components/conversa/Compositor.tsx") return new Set();
  const fonte = ts.createSourceFile(arquivo, conteudo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const linhas: number[] = [];
  function visitar(n: ts.Node) {
    if (ts.isJsxOpeningElement(n) && n.tagName.getText(fonte) === "div" && n.attributes.properties.length === 3) {
      const atributos = n.attributes.properties;
      const texto = (nome: string) => { const a = atributos.find(a => ts.isJsxAttribute(a) && a.name.getText(fonte) === nome); return a && ts.isJsxAttribute(a) && a.initializer && ts.isStringLiteral(a.initializer) ? a.initializer.text : null; };
      const classe = atributos.find(a => ts.isJsxAttribute(a) && a.name.getText(fonte) === "className");
      const valor = classe && ts.isJsxAttribute(classe) && classe.initializer && ts.isJsxExpression(classe.initializer) ? classe.initializer.expression : null;
      if (texto("role") === "menu" && texto("aria-label") === "Anexar" && valor && ts.isTemplateExpression(valor)
        && valor.head.text === "absolute bottom-12 left-0 z-20 grid w-[340px] max-w-[calc(100vw-32px)] grid-cols-3 gap-1 "
        && valor.templateSpans.length === 1 && ts.isIdentifier(valor.templateSpans[0].expression)
        && valor.templateSpans[0].expression.text === "CLASSE_PAINEL_MENU" && valor.templateSpans[0].literal.text === "") {
        linhas.push(fonte.getLineAndCharacterOfPosition(n.getStart(fonte)).line + 1);
      }
    }
    ts.forEachChild(n, visitar);
  }
  visitar(fonte);
  return linhas.length === 1 ? new Set(linhas) : new Set();
}

describe("grades responsivas", () => {
  it("nenhuma grade usa mais de uma coluna como base no celular (fora as grades de KPI contadas)", () => {
    const ofensores = telas.flatMap(({ arquivo, conteudo }) => {
      const menus = menuAnexosTresColunas(arquivo, conteudo);
      const linhas = ocorrencias(conteudo, BASE_MULTICOLUNA).filter(l => !menus.has(l));
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

  it("a exceção do menu Anexar é única e não libera formulário, outro arquivo ou outro menu", () => {
    const arquivo = "src/components/conversa/Compositor.tsx";
    const conteudo = telas.find(t => t.arquivo === arquivo)!.conteudo;
    expect(menuAnexosTresColunas(arquivo, conteudo).size).toBe(1);
    expect(menuAnexosTresColunas("src/components/Outro.tsx", conteudo).size).toBe(0);
    expect(menuAnexosTresColunas(arquivo, conteudo.replace('aria-label="Anexar" className=', 'aria-label="Outro" className=')).size).toBe(0);
    expect(menuAnexosTresColunas(arquivo, conteudo.replace('role="menu" aria-label="Anexar"', 'role="form" aria-label="Anexar"')).size).toBe(0);
    expect(menuAnexosTresColunas(arquivo, conteudo + "\n" + conteudo).size).toBe(0);
    const comFormulario = conteudo + '\nconst formulario = <div className="grid grid-cols-2">Campo</div>;';
    const liberadas = menuAnexosTresColunas(arquivo, comFormulario);
    expect(ocorrencias(comFormulario, BASE_MULTICOLUNA).filter(l => !liberadas.has(l))).toHaveLength(1);
  });

  it("os detectores aceitam a base de uma coluna e acusam a de duas", () => {
    expect(ocorrencias('className="grid grid-cols-2 gap-4"', BASE_MULTICOLUNA)).toHaveLength(1);
    expect(ocorrencias('className="grid grid-cols-1 sm:grid-cols-2 gap-4"', BASE_MULTICOLUNA)).toHaveLength(0);
    expect(ocorrencias('className="grid gap-2 md:grid-cols-3"', BASE_MULTICOLUNA)).toHaveLength(0);
    // Base de uma coluna que só abre em telas largas — as 3 grades que um `grep '\bgrid-cols-2\b'`
    // ainda acusa (o `:` do prefixo é borda de palavra): regras/turmas/[turmaId], CorrecoesConclusaoReposicao
    // e contrato/substituicoes/[propostaId]. Não são ofensoras.
    expect(ocorrencias('className="grid gap-4 xl:grid-cols-2"', BASE_MULTICOLUNA)).toHaveLength(0);
    expect(ocorrencias('className="grid gap-3 lg:grid-cols-2"', BASE_MULTICOLUNA)).toHaveLength(0);
    expect(ocorrencias("className={`grid ${denso ? \"grid-cols-2\" : \"grid-cols-1\"}`}", BASE_MULTICOLUNA)).toHaveLength(1);
    expect(ocorrencias('className="col-span-2 md:col-span-1"', COL_SPAN_BASE)).toHaveLength(1);
    expect(ocorrencias('className="sm:col-span-2 md:col-span-1"', COL_SPAN_BASE)).toHaveLength(0);
  });
});
