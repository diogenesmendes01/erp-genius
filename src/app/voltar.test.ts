import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { DESTINOS_FORA_DO_SHELL, rotuloDoDestino } from "@/lib/trilha";

// E2 (docs/42-auditoria-frontend-ux.md): link de volta é <VoltarPara/> — formato e nome únicos.
// Nenhum <Link>/<a> com texto "Voltar…" escrito à mão, fora das exceções contadas abaixo, que não
// são "voltar ao nível de cima" (reinício de paginação, troca de fuso, versão, chamada principal).
const EXCECOES: Record<string, number> = {
  "src/app/(app)/acesso-negado/page.tsx": 1, // chamada principal da tela ("Voltar ao início")
  "src/app/(app)/diario/reposicoes/page.tsx": 1, // reinício da paginação
  "src/app/(app)/financeiro/continuidade/page.tsx": 1, // reinício da paginação
  "src/app/(app)/financeiro/desistencias/page.tsx": 1, // reinício da paginação
  "src/app/(app)/secretaria/avisos-agenda/page.tsx": 2, // reinício da paginação
  "src/app/(app)/secretaria/desistencias/page.tsx": 1, // reinício da paginação
  "src/app/(app)/secretaria/envios-portal/page.tsx": 1, // reinício da paginação
  "src/app/(app)/academico/avaliacoes/[alocacaoId]/[codigo]/page.tsx": 1, // "Voltar para UTC" (fuso)
  "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/page.tsx": 2, // versão atual / recentes
  "src/app/(app)/academico/recuperacoes/planos/[propostaId]/autorizacao-reserva/page.tsx": 1, // frase de instrução
};

export function voltasAMao(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isJsxElement(n)) {
      const tag = n.openingElement.tagName.getText(sf);
      const texto = n.children.map((c) => c.getText(sf)).join("").replace(/\s+/g, " ").trim();
      if ((tag === "Link" || tag === "a") && /^(←\s*)?Voltar\b/.test(texto)) achados.push(texto);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

const telas = (readdirSync("src/app", { recursive: true }) as string[])
  .filter((f) => /\.tsx$/.test(f))
  .map((f) => ({ arquivo: join("src/app", f).split("\\").join("/"), conteudo: readFileSync(join("src/app", f), "utf-8") }));

describe("links de volta", () => {
  it("nenhum \"Voltar…\" escrito à mão fora das exceções contadas (use <VoltarPara/>)", () => {
    const ofensores = telas.flatMap(({ arquivo, conteudo }) => {
      const achados = voltasAMao(conteudo);
      return achados.length > (EXCECOES[arquivo] ?? 0) ? [`${arquivo}: ${achados.join(" | ")}`] : [];
    });
    expect(ofensores).toEqual([]);
  });

  it("a lista de exceções não sobra", () => {
    const sobrando = Object.entries(EXCECOES).filter(([a, n]) => voltasAMao(telas.find((t) => t.arquivo === a)?.conteudo ?? "").length < n);
    expect(sobrando).toEqual([]);
  });

  it("`para` é nome de destino de verdade, e só onde o mapa não nomeia o destino", () => {
    const problemas = telas.flatMap(({ arquivo, conteudo }) => {
      const sf = ts.createSourceFile("x.tsx", conteudo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const achados: string[] = [];
      const visitar = (n: ts.Node) => {
        if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(sf) === "VoltarPara") {
          const attr = (nome: string) => n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === nome) as ts.JsxAttribute | undefined;
          const href = attr("href")?.initializer, para = attr("para")?.initializer;
          const textoPara = para && ts.isStringLiteral(para) ? para.text : null;
          // "Voltar para Voltar": o nome do destino não pode ser o próprio verbo.
          if (textoPara !== null && /^voltar\b/i.test(textoPara)) achados.push(`${arquivo}: para="${textoPara}"`);
          // Destino que o mapa nomeia: `para` seria ignorado e só confundiria quem lê.
          if (para && href && ts.isStringLiteral(href) && rotuloDoDestino(href.text)) achados.push(`${arquivo}: para redundante em ${href.text}`);
        }
        ts.forEachChild(n, visitar);
      };
      visitar(sf);
      return achados;
    });
    expect(problemas).toEqual([]);
  });

  it("destinos fora do shell (portal do aluno) são páginas que existem; mesmo destino, mesmo nome", () => {
    for (const destino of Object.keys(DESTINOS_FORA_DO_SHELL)) {
      expect(existsSync(join("src/app", destino, "page.tsx")), destino).toBe(true);
    }
    expect(rotuloDoDestino("/portal-aluno")).toBe("Área do aluno");
    expect(rotuloDoDestino("/portal-aluno?x=1")).toBe("Área do aluno");
  });

  it("o detector pega Link e <a>, com ou sem seta", () => {
    expect(voltasAMao('<Link href="/x">Voltar ao início</Link>')).toHaveLength(1);
    expect(voltasAMao('<a href="/x">← Voltar ao aditivo</a>')).toHaveLength(1);
    expect(voltasAMao('<VoltarPara href="/x" para="X" />')).toEqual([]);
    expect(voltasAMao('<button>Voltar</button>')).toEqual([]);
  });
});
