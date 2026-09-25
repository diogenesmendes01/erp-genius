import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "./mensagens";

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


// Ganho rápido #20 (docs/42-auditoria-frontend-ux.md): o mesmo evento técnico — falha de transporte
// numa ação que muda dados, com resultado desconhecido — dá a mesma instrução em todas as telas. Num
// catch assim, a mensagem é uma das três constantes (nunca texto à mão), e a constante combina com a
// ação: "reenvie sem alterar" só onde o try manda chave; "reenvie a mesma decisão" só em decisão.
// Catches de leitura (listar/consultar/carregar/conferir…) e rotas de API ficam de fora: outro evento.

/** Texto de resultado incerto (qualquer redação) ou de falha afirmada numa ação que muda dados. */
const TEXTO_INCERTO =
  /não foi confirmad|resultado não confirmad|não foi possível confirmar|resultado incerto|antes de repetir|antes de reenviar|antes de tentar novamente|com os mesmos dados|sem alterar|mesma decisão|precisa (de )?confer|precisa ser conferid|consulte novamente antes|confira o resultado antes/i;
const FALHA_EM_MUTACAO =
  /^não foi possível (registrar|salvar|publicar|aplicar|processar|revogar|concluir a operação|preparar a proposta|preparar o processo|preparar o envio|preparar os casos|reconferir|efetivar)/i;
const LEITURA = /^(listar|consultar|carregar|buscar|conferir|calcular|prever|obter|ler|previa|previsualizar|revisar|simular)/i;
const CHAVE_NO_TRY = /chaveIdempotencia|\bchave\b|chave\.current|chaves\.current|tentativa\.current|\bchaves\[/;

type AchadoIncerto = { texto: string | null; constante: string | null; comChave: boolean; decisao: boolean };

/** Cada catch de ação que muda dados: texto incerto à mão (se houver), constante usada e o que o try manda. */
export function incertosDoFonte(fonte: string): AchadoIncerto[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: AchadoIncerto[] = [];
  const nomes = (e: ts.Expression): string[] =>
    ts.isIdentifier(e) ? [e.text] : ts.isPropertyAccessExpression(e) ? [e.name.text] : ts.isParenthesizedExpression(e) ? nomes(e.expression) : ts.isConditionalExpression(e) ? [...nomes(e.whenTrue), ...nomes(e.whenFalse)] : [];
  const visitar = (n: ts.Node) => {
    if (ts.isTryStatement(n) && n.catchClause) {
      // Ações chamadas com await no try: nome da função, do método, ou dos dois ramos de (a ? b : c)(…).
      const chamadas: string[] = [];
      const acharChamadas = (m: ts.Node) => {
        if (ts.isAwaitExpression(m) && ts.isCallExpression(m.expression)) chamadas.push(...nomes(m.expression.expression).filter((c) => c !== "refresh" && c !== "json"));
        ts.forEachChild(m, acharChamadas);
      };
      acharChamadas(n.tryBlock);
      const leitura = chamadas.length > 0 && chamadas.every((c) => LEITURA.test(c));
      if (!leitura) {
        const base = { comChave: CHAVE_NO_TRY.test(n.tryBlock.getText(sf)), decisao: chamadas.length > 0 && chamadas.every((c) => /^(decidir|oficializar)/.test(c)) };
        const olhar = (m: ts.Node) => {
          if ((ts.isStringLiteral(m) || ts.isNoSubstitutionTemplateLiteral(m)) && (TEXTO_INCERTO.test(m.text) || FALHA_EM_MUTACAO.test(m.text))) achados.push({ ...base, texto: m.text, constante: null });
          if (ts.isIdentifier(m) && /^MSG_(RESULTADO_INCERTO|DECISAO_INCERTA)/.test(m.text)) achados.push({ ...base, texto: null, constante: m.text });
          ts.forEachChild(m, olhar);
        };
        olhar(n.catchClause.block);
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

/** Fixtures do detector: await só é await dentro de função async. */
const emAsync = (corpo: string) => `async function f() { ${corpo} }`;

/** Usos de constante que não combinam com a ação do try. */
export function incoerentes<T extends AchadoIncerto>(achados: T[]): T[] {
  return achados.filter((a) => (a.constante === "MSG_RESULTADO_INCERTO" && !a.comChave) || (a.constante === "MSG_DECISAO_INCERTA" && !a.decisao && !a.comChave));
}

describe("resultado incerto: uma instrução por evento (ganho rápido #20)", () => {
  const telas = fontes.filter(({ arquivo }) => !/[\\/]api[\\/]/.test(arquivo));
  const todos = telas.flatMap(({ arquivo, conteudo }) => incertosDoFonte(conteudo).map((a) => ({ arquivo, ...a })));

  it("nenhum catch de ação escreve à mão o resultado incerto ou afirma falha (use as constantes)", () => {
    expect(todos.filter((a) => a.texto).map((a) => `${a.arquivo}: ${a.texto}`)).toEqual([]);
  });

  it("\"reenvie sem alterar\" só onde o try manda chave; \"reenvie a mesma decisão\" só em decisão (ou com chave)", () => {
    expect(incoerentes(todos).map((a) => `${a.arquivo}: ${a.constante}`)).toEqual([]);
  });

  it("a instrução sem chave nunca manda reenviar: conferir antes de repetir", () => {
    expect(MSG_RESULTADO_INCERTO_SEM_CHAVE).toMatch(/recarregue/i);
    expect(MSG_RESULTADO_INCERTO_SEM_CHAVE).toMatch(/antes de repetir/i);
    expect(MSG_RESULTADO_INCERTO_SEM_CHAVE).not.toMatch(/reenvi|sem alterar|mesm[ao]/i);
  });

  it("o detector vê as redações, a ação do try e a chave; leitura fica de fora", () => {
    const [semChave] = incertosDoFonte(emAsync('try { await salvar(d); } catch { setErro("Não foi possível confirmar o envio."); }'));
    expect(semChave).toMatchObject({ texto: "Não foi possível confirmar o envio.", comChave: false, decisao: false });
    expect(incertosDoFonte(emAsync('try { await salvar(d); } catch { setErro("O resultado não foi confirmado. Consulte antes de repetir."); }'))).toHaveLength(1);
    expect(incertosDoFonte(emAsync('try { await registrar(d); } catch { setErro("Não foi possível registrar a proposta."); }'))).toHaveLength(1);
    expect(incertosDoFonte(emAsync('try { await carregarLista(); } catch { setErro("Não foi possível carregar. Tente novamente."); }'))).toEqual([]);
    const [comChave] = incertosDoFonte(emAsync("try { await salvar({ ...d, chaveIdempotencia }); } catch { setErro(MSG_RESULTADO_INCERTO); }"));
    expect(comChave).toMatchObject({ texto: null, constante: "MSG_RESULTADO_INCERTO", comChave: true });
    const [decisao] = incertosDoFonte(emAsync("try { await (p ? decidirA : decidirB)(d); } catch { setErro(MSG_DECISAO_INCERTA); }"));
    expect(decisao).toMatchObject({ constante: "MSG_DECISAO_INCERTA", decisao: true, comChave: false });
  });

  it("a regra de coerência rejeita \"reenvie\" sem chave e decisão incerta fora de decisão", () => {
    const proibidos = [
      ...incertosDoFonte(emAsync("try { await salvar(d); } catch { setErro(MSG_RESULTADO_INCERTO); }")),
      ...incertosDoFonte(emAsync("try { await registrar(d); } catch { setErro(MSG_DECISAO_INCERTA); }")),
    ];
    expect(incoerentes(proibidos)).toHaveLength(2);
    const permitidos = [
      ...incertosDoFonte(emAsync("try { await salvar({ ...d, chaveIdempotencia }); } catch { setErro(MSG_RESULTADO_INCERTO); }")),
      ...incertosDoFonte(emAsync("try { await decidirGrade(d); } catch { setErro(MSG_DECISAO_INCERTA); }")),
      ...incertosDoFonte(emAsync("try { await salvar(d); } catch { setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE); }")),
    ];
    expect(incoerentes(permitidos)).toEqual([]);
  });
});
