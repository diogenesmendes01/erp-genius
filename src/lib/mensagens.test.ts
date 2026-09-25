import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "./mensagens";

const RAIZES = ["src/app", "src/components"];
const fontes = RAIZES.flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

/** Corpo de cada `catch { … }` / `catch (e) { … }`, com chaves balanceadas. */
function corposCatch(fonte: string): string[] {
  const corpos: string[] = [];
  const re = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
  for (let m = re.exec(fonte); m; m = re.exec(fonte)) {
    let nivel = 1, i = re.lastIndex;
    for (; i < fonte.length && nivel > 0; i++) {
      if (fonte[i] === "{") nivel++;
      else if (fonte[i] === "}") nivel--;
    }
    corpos.push(fonte.slice(re.lastIndex, i - 1));
  }
  return corpos;
}

/** Texto de todas as strings/template literals do trecho, concatenadas (pega "a" + "b" e quebras de linha). */
function textoDasStrings(trecho: string): string {
  return [...trecho.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)]
    .map((m) => m[1] ?? m[2] ?? m[3])
    .join(" ")
    .replace(/\s+/g, " ");
}

// Num catch o resultado é desconhecido: não pode afirmar falha, nem convidar a alterar a entrada.
const PROIBIDO = [
  /confira (?:os dados|e tente)/i,
  /\bnão foi (?:registrad|salv|gravad|enviad|efetuad|conclu)/i,
];

describe("mensagens de resultado incerto", () => {
  it("instruem repetir a MESMA entrada, nunca revisar os dados", () => {
    for (const msg of [MSG_RESULTADO_INCERTO, MSG_DECISAO_INCERTA]) {
      expect(msg).toMatch(/mesm[ao]|sem alterar/);
      expect(msg).not.toMatch(/confira os dados/i);
    }
  });

  it("o extrator acha strings quebradas, concatenadas e em template dentro de catch aninhado", () => {
    const fonte = `try { x() } catch (e) { if (a) { f("A proposta não foi " +
      "registrada."); } g(\`Confira os dados e tente novamente\`); }`;
    const texto = corposCatch(fonte).map(textoDasStrings).join(" ");
    expect(PROIBIDO.every((re) => re.test(texto))).toBe(true);
  });

  it("nenhum catch em telas/componentes afirma falha ou convida a alterar os dados", () => {
    const ofensores = fontes.flatMap(({ arquivo, conteudo }) =>
      corposCatch(conteudo)
        .map(textoDasStrings)
        .filter((texto) => PROIBIDO.some((re) => re.test(texto)))
        .map((texto) => `${arquivo}: ${texto}`),
    );
    expect(ofensores).toEqual([]);
  });
});

// Ganho rápido #20 (docs/42-auditoria-frontend-ux.md): o mesmo evento técnico dá a mesma instrução em
// todas as telas. Num catch, o resultado incerto usa uma das três constantes — nunca texto à mão —
// e a constante combina com a ação: "reenvie sem alterar" só onde o try manda chave de idempotência.
const TEXTO_INCERTO = /resultado não confirmado|não foi possível confirmar/i;
const CHAVE_NO_TRY = /chaveIdempotencia|\bchave\b|chave\.current|chaves\.current|tentativa\.current|\bchaves\[/;

type AchadoIncerto = { texto: string | null; constante: string | null; comChave: boolean; decisao: boolean };

/** Cada catch do fonte: texto incerto à mão (se houver), constante usada e o que o try manda. */
export function incertosDoFonte(fonte: string): AchadoIncerto[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: AchadoIncerto[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isTryStatement(n) && n.catchClause) {
      const tryTxt = n.tryBlock.getText(sf);
      // Ações chamadas com await no try: nome da função, do método, ou dos dois ramos de (a ? b : c)(…).
      const chamadas: string[] = [];
      const nomes = (e: ts.Expression): string[] =>
        ts.isIdentifier(e) ? [e.text] : ts.isPropertyAccessExpression(e) ? [e.name.text] : ts.isParenthesizedExpression(e) ? nomes(e.expression) : ts.isConditionalExpression(e) ? [...nomes(e.whenTrue), ...nomes(e.whenFalse)] : [];
      const acharChamadas = (m: ts.Node) => {
        if (ts.isAwaitExpression(m) && ts.isCallExpression(m.expression)) chamadas.push(...nomes(m.expression.expression).filter((c) => c !== "refresh"));
        ts.forEachChild(m, acharChamadas);
      };
      acharChamadas(n.tryBlock);
      const base = { comChave: CHAVE_NO_TRY.test(tryTxt), decisao: chamadas.length > 0 && chamadas.every((c) => /^(decidir|oficializar)/.test(c)) };
      const olhar = (m: ts.Node) => {
        if ((ts.isStringLiteral(m) || ts.isNoSubstitutionTemplateLiteral(m)) && TEXTO_INCERTO.test(m.text)) achados.push({ ...base, texto: m.text, constante: null });
        if (ts.isIdentifier(m) && /^MSG_(RESULTADO_INCERTO|DECISAO_INCERTA)/.test(m.text)) achados.push({ ...base, texto: null, constante: m.text });
        ts.forEachChild(m, olhar);
      };
      olhar(n.catchClause.block);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

describe("resultado incerto: uma instrução por evento (ganho rápido #20)", () => {
  const todos = fontes.flatMap(({ arquivo, conteudo }) => incertosDoFonte(conteudo).map((a) => ({ arquivo, ...a })));

  it("nenhum catch escreve à mão \"resultado não confirmado\" / \"não foi possível confirmar\" (use as constantes)", () => {
    expect(todos.filter((a) => a.texto).map((a) => `${a.arquivo}: ${a.texto}`)).toEqual([]);
  });

  it("\"reenvie sem alterar\" (MSG_RESULTADO_INCERTO) só onde o try manda chave; decisão pode usar MSG_DECISAO_INCERTA", () => {
    const incoerentes = todos.filter((a) =>
      (a.constante === "MSG_RESULTADO_INCERTO" && !a.comChave) || (a.constante === "MSG_DECISAO_INCERTA" && !a.decisao && !a.comChave),
    );
    expect(incoerentes.map((a) => `${a.arquivo}: ${a.constante}`)).toEqual([]);
  });

  it("o detector vê texto à mão, constante e se o try manda chave", () => {
    const [semChave] = incertosDoFonte('try { await salvar(d); } catch { setErro("Não foi possível confirmar o envio."); }');
    expect(semChave).toMatchObject({ texto: "Não foi possível confirmar o envio.", comChave: false, decisao: false });
    const [comChave] = incertosDoFonte("try { await salvar({ ...d, chaveIdempotencia }); } catch { setErro(MSG_RESULTADO_INCERTO); }");
    expect(comChave).toMatchObject({ texto: null, constante: "MSG_RESULTADO_INCERTO", comChave: true });
    const [decisao] = incertosDoFonte("try { await decidirGrade(d); } catch { setErro(MSG_DECISAO_INCERTA); }");
    expect(decisao).toMatchObject({ constante: "MSG_DECISAO_INCERTA", decisao: true, comChave: false });
  });
});
