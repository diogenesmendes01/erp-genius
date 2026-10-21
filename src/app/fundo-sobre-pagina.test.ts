import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { DIFERENCA_MINIMA, fundosDoTailwind } from "@/test/fundo-visivel";
import config from "../../tailwind.config";

const { destaqueSobreAPagina } = fundosDoTailwind(config);

// Revisão R1 do #269, ponto 1, e o follow-up dela: no tema claro, `bg-surface-muted`/`bg-gray-50` (--surface-muted)
// é a mesma cor da página (--bg-page). Uma caixa, um cabeçalho de tabela ou uma pílula com esse fundo e sem borda
// some quando fica direto sobre a página — e a maioria das telas operacionais não tem cartão branco: os blocos são
// `rounded border` sem fundo. Esses casos passam a usar `bg-gray-100` (--neutral-muted), que se destaca nos dois temas.
// Um fundo sutil com borda própria segue livre. Dentro de cartão/superfície branca (`bg-surface`, modal) ele continua
// visível; esses casos foram conferidos pelo JSX, um a um, e ficam na lista abaixo com o motivo. Um uso NOVO sem borda
// quebra este teste: ou ele vira `bg-gray-100`/ganha borda, ou entra na lista depois de conferir onde fica.
const RAIZES = ["src/app", "src/components"];
const SUTIL = /^(?:bg-surface-muted|bg-gray-50)$/;
const BORDA = /^border(?:-[a-z]+-\d+|-border-soft)?$/;

/** Conferidos dentro de superfície branca (ou que são o próprio fundo da página). Arquivo → quantidade permitida. */
const DENTRO_DE_SUPERFICIE: Record<string, { quantidade: number; motivo: string }> = {
  "src/app/(app)/academico/MudancasAcademicasPainel.tsx": { quantidade: 2, motivo: "dentro do bloco/artigo bg-surface" },
  "src/app/(app)/alunos/ImportarAlunosModal.tsx": { quantidade: 2, motivo: "dentro do Modal (bg-surface-raised)" },
  "src/app/(app)/configuracao/turmas/ImportarTurmasModal.tsx": { quantidade: 1, motivo: "dentro do Modal (bg-surface-raised)" },
  "src/app/(app)/empresas/[id]/FichaEmpresa.tsx": { quantidade: 2, motivo: "thead dentro de section bg-surface" },
  "src/app/(app)/financeiro/AcessoAulasPainel.tsx": { quantidade: 1, motivo: "dentro da section bg-surface" },
  "src/app/(app)/funil/CartaoOportunidade.tsx": { quantidade: 1, motivo: "pílula dentro do cartão bg-surface" },
  "src/app/(app)/home/HomeProfessor.tsx": { quantidade: 1, motivo: "item dentro da section bg-surface" },
  "src/app/(app)/secretaria/SecretariaPainel.tsx": { quantidade: 1, motivo: "dentro do artigo bg-surface" },
  "src/app/pagar/[token]/page.tsx": { quantidade: 1, motivo: "tom neutro dentro da section bg-surface" },
  "src/app/portal-aluno/layout.tsx": { quantidade: 1, motivo: "é o próprio <main> (fundo da página do portal)" },
};

function arquivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = path.posix.join(dir, nome);
    if (statSync(p).isDirectory()) return arquivosTsx(p);
    return p.endsWith(".tsx") && !p.includes(".test.") ? [p] : [];
  });
}

/**
 * Literais de string do arquivo ("…", '…', `…`), sem os comentários. Usa o parser do TypeScript (TSX): um `/*` ou `//`
 * dentro de string (glob, URL) não é comentário e não apaga o resto. Um template com `${…}` conta inteiro, uma vez.
 */
function literaisDeString(fonte: string): string[] {
  const arquivo = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const literais: string[] = [];
  const visitar = (no: ts.Node): void => {
    if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no) || ts.isTemplateExpression(no)) {
      literais.push(no.getText(arquivo));
      return;
    }
    ts.forEachChild(no, visitar);
  };
  visitar(arquivo);
  return literais;
}

/** Strings de classe com fundo sutil sem prefixo de estado (hover:, disabled:) e sem borda junto. */
function semBorda(fonte: string): string[] {
  return literaisDeString(fonte).filter((literal) => {
    const classes = literal.slice(1, -1).split(/\s+/);
    return classes.some((c) => SUTIL.test(c)) && !classes.some((c) => BORDA.test(c));
  });
}

describe("nada de fundo igual ao da página sem borda (#269 e follow-up)", () => {
  const porArquivo = new Map(RAIZES.flatMap(arquivosTsx).map((arq) => [arq, semBorda(readFileSync(arq, "utf-8"))] as const));

  it("fora da lista conferida, nenhuma string de classe com bg-surface-muted/bg-gray-50 sem borda", () => {
    const ofensas = [...porArquivo].flatMap(([arq, achados]) =>
      achados.length > (DENTRO_DE_SUPERFICIE[arq]?.quantidade ?? 0) ? achados.map((a) => `${arq}: ${a}`) : [],
    );
    expect(ofensas).toEqual([]);
  });

  it("a lista conferida não guarda sobra (arquivo some ou deixa de usar o fundo sutil → atualize a lista)", () => {
    const sobras = Object.entries(DENTRO_DE_SUPERFICIE)
      .filter(([arq, { quantidade }]) => (porArquivo.get(arq)?.length ?? 0) !== quantidade)
      .map(([arq]) => arq);
    expect(sobras).toEqual([]);
  });

  it("o detector pega a forma do bug e respeita borda, prefixo de estado e comentário", () => {
    expect(semBorda(`<div className="rounded bg-gray-50 p-3" />`)).toHaveLength(1);
    expect(semBorda(`<thead className="bg-surface-muted text-xs" />`)).toHaveLength(1);
    expect(semBorda(`<div className="rounded border bg-gray-50 p-3" />`)).toEqual([]);
    expect(semBorda(`<div className="rounded border-gray-200 bg-gray-50" />`)).toEqual([]);
    expect(semBorda(`<button className="hover:bg-gray-50 disabled:bg-surface-muted" />`)).toEqual([]);
    expect(semBorda("  // com `bg-surface-muted` sem borda a caixa some\n")).toEqual([]);
    expect(semBorda("/* `bg-gray-50` num comentário de bloco */ const x = 1;")).toEqual([]);
  });

  it("um /* ou // dentro de string (glob, URL) não vira comentário nem esconde o que vem depois", () => {
    const fonte = [
      `const padrao = "src/app/*.tsx";`,
      `const url = "https://exemplo.com";`,
      `const el = <div className="rounded bg-gray-50 p-3" />;`,
      `const fim = "*/";`,
    ].join("\n");
    expect(semBorda(fonte)).toEqual([`"rounded bg-gray-50 p-3"`]);
  });

  it("o substituto, bg-gray-100, se destaca da página nos dois temas", () => {
    for (const tema of ["claro", "escuro"] as const) expect(destaqueSobreAPagina("bg-gray-100", tema)).toBeGreaterThanOrEqual(DIFERENCA_MINIMA);
  });
});
