import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { achadosDoRepositorio, extrairAchados, resumoPorArea } from "../../scripts/medicao-ux/achados.mjs";
import { amostra, argumentosDaAmostra, gerador, sortear } from "../../scripts/medicao-ux/amostra.mjs";
import { medir } from "../../scripts/medicao-ux/metricas.mjs";
import {
  chamaServerAction, contarCores, contraste, ehTeste, estimativaEstratificada, exigirNode, hexParaRgb, inteiroDoArgumento,
  mapaDeCores, nomesDeControles, normalizarSeveridade, paginasCobertas, paresReprovados, semCatchCentral, semCatchLiteral,
} from "../../scripts/medicao-ux/nucleo.mjs";

// Guarda a lógica de medição do docs/43-medicao-auditoria-ux.md (scripts/medicao-ux): cada número
// publicado sai destas funções, então mudar uma regex ou o sorteador tem de quebrar um teste aqui.

const DOC_43 = readFileSync("docs/43-medicao-auditoria-ux.md", "utf-8").split(/\r?\n/);
const ACHADOS = achadosDoRepositorio();

/** Linhas de tabela markdown entre o título `inicio` e o próximo título de nível ≤ `nivel`. */
function secao(inicio: string, fimPrefixo: string): string[] {
  const i = DOC_43.findIndex((l) => l.startsWith(inicio));
  if (i < 0) throw new Error(`seção ausente: ${inicio}`);
  const j = DOC_43.findIndex((l, k) => k > i && l.startsWith(fimPrefixo));
  return DOC_43.slice(i + 1, j < 0 ? undefined : j);
}
const celulas = (linha: string) => linha.replace(/^\|\s*/, "").replace(/\s*\|$/, "").split(" | ").map((c) => c.trim());

// ---------------------------------------------------------------------------------------------------
// Funções puras
// ---------------------------------------------------------------------------------------------------

describe("nucleo: mapa de cores e contagem", () => {
  const config = `const config = { theme: { extend: { colors: {
    // comentário com "chave": { 1: 2 }
    white: "#ffffff",
    "brand-solid": "var(--brand-solid)",
    gray: {
      50: "var(--a)", 200: "var(--b)",
      900: "var(--c)",
    },
    red: { 600: "var(--d)", 700: "var(--e)" },
  } } } };`;
  it("lê só as entradas com objeto de shades, sem importar o .ts", () => {
    const mapa = mapaDeCores(config);
    expect([...mapa.keys()].sort()).toEqual(["gray", "red"]);
    expect([...(mapa.get("gray") ?? [])].sort((a, b) => a - b)).toEqual([50, 200, 900]);
    expect([...(mapa.get("red") ?? [])]).toEqual([600, 700]);
  });
  it("lê o tailwind.config.ts do repositório (gray sem 950, brand com 700)", () => {
    const mapa = mapaDeCores(readFileSync("tailwind.config.ts", "utf-8"));
    expect(mapa.get("gray")?.has(900)).toBe(true);
    expect(mapa.get("gray")?.has(950)).toBe(false);
    expect(mapa.get("brand")?.has(700)).toBe(true);
    expect(mapa.has("brand-solid")).toBe(false);
  });
  it("conta shade não mapeada de cor mapeada, paleta padrão fora do mapa e borda; e as mapeadas", () => {
    const mapa = mapaDeCores(config);
    expect(contarCores(`"bg-gray-200 text-gray-950 bg-rose-500 border-red-300 hover:text-red-600 bg-surface bg-brand-solid"`, mapa))
      .toEqual({ fora: 3, mapeadas: 2 });
    expect(contarCores(`"border-t-red-300 ring-offset-gray-100 dark:md:text-sky-700"`, mapa)).toEqual({ fora: 3, mapeadas: 0 });
  });
});

describe("nucleo: nome acessível dos controles", () => {
  it("separa dentro de <label>, aria-label, id↔htmlFor e sem nome; ignora hidden; atributo com => não corta a tag", () => {
    const tsx = `
      <label>Nome<input name="a" /></label>
      <input aria-label="B" />
      <label htmlFor="c">C</label><input id="c" />
      <input name="d" />
      <input type="hidden" name="e" />
      <select onChange={(e) => x(e.target.value > 1)}><option>1</option></select>
      <textarea id={idT} /><label htmlFor={idT}>T</label>`;
    expect(nomesDeControles(tsx)).toEqual({ controles: 6, semNome: 2, dentroLabel: 1, comAria: 1, comHtmlFor: 2 });
  });
});

describe("nucleo: contraste e famílias", () => {
  it("razão WCAG conhecida", () => {
    expect(contraste([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    expect(contraste([255, 255, 255], hexParaRgb("#6366f1"))).toBeCloseTo(4.47, 2);
  });
  it("limiares 4,5 (texto, #fff) e 3 (borda); família conta uma vez por token, nos dois temas e superfícies", () => {
    const css = `:root {
  --bg-page: #ffffff;
  --surface: #ffffff;
  --surface-muted: #ffffff;
  --text-terciary: #777777;
  --border-control: rgba(0, 0, 0, 0.6);
  --border: rgba(0, 0, 0, 0.1);
  --brand: #6366f1;
  --brand-solid: #4338ca;
}
.dark {
  --brand: #4338ca;
}`;
    const r = paresReprovados(css);
    expect(r.familias).toEqual(["#fff/--brand", "--border", "--text-terciary"]);
    expect(r.reprovados.filter((p) => p.familia === "--text-terciary")).toHaveLength(6);
    expect(r.reprovados.filter((p) => p.familia === "#fff/--brand").map((p) => p.tema)).toEqual(["claro"]);
    // #767676 sobre branco = 4,54 → passa
    expect(paresReprovados(css.replace("#777777", "#767676")).familias).toEqual(["#fff/--brand", "--border"]);
  });
  it("globals.css atual: 3 famílias, sem --text-terciary e sem --border-control (docs/43 §6 item 5)", () => {
    const r = paresReprovados(readFileSync("src/app/globals.css", "utf-8"));
    // O docs/43 mediu 4 famílias em 6b105093; o item 5 da §6 tirou --border-control (.42/.34 → .44/.36).
    // #fff/--brand segue reprovando no token, mas nenhum elemento usa mais o par: o texto branco da
    // seleção foi para bg-brand-solid, e src/app/contraste.test.ts proíbe bg-brand-500|600 com text-white.
    expect(r.familias).toEqual(["#fff/--brand", "--border", "--brand-border"]);
    expect(r.reprovados.filter((p) => p.familia === "#fff/--brand-solid")).toEqual([]);
    const brand = r.reprovados.find((p) => p.familia === "#fff/--brand");
    expect(brand?.tema).toBe("escuro");
    expect(brand?.valor).toBeCloseTo(4.06, 2);
  });
});

describe("nucleo: herança, testes e catch central", () => {
  it("página coberta por especial no próprio segmento ou acima, até src/app", () => {
    const paginas = ["src/app/(app)/page.tsx", "src/app/(app)/x/y/page.tsx", "src/app/login/page.tsx"];
    expect(paginasCobertas(paginas, new Set(["src/app/(app)"]))).toBe(2);
    expect(paginasCobertas(paginas, new Set(["src/app/(app)/x/y"]))).toBe(1);
    expect(paginasCobertas(paginas, new Set(["src/app"]))).toBe(3);
  });
  it("arquivo de teste e src/test ficam fora", () => {
    expect(ehTeste("src/app/a.test.tsx")).toBe(true);
    expect(ehTeste("src/test/apoio.ts")).toBe(true);
    expect(ehTeste("src/app/a.tsx")).toBe(false);
  });
  it("catch literal × catch central", () => {
    const com = `"use client";\nimport { a } from "@/server/a";\nconst acao = useAcaoCliente({ idempotente: true });`;
    const sem = `"use client";\nimport { a } from "@/server/a";\nawait a();`;
    expect(chamaServerAction(com)).toBe(true);
    expect(chamaServerAction(`import { a } from "@/server/a";`)).toBe(false);
    expect([semCatchLiteral(com), semCatchCentral(com)]).toEqual([true, false]);
    expect([semCatchLiteral(sem), semCatchCentral(sem)]).toEqual([true, true]);
    expect(semCatchLiteral(`${sem}\ntry { x() } catch { y() }`)).toBe(false);
    // Cada forma do catch central conta (verificação de integração da #146: tirar uma delas não falhava teste).
    for (const central of ["useAcaoCliente(", "executarAcaoCliente(() => a())", "criarExecutor("]) {
      expect(semCatchCentral(`${sem}\n${central}`), central).toBe(false);
    }
  });
});

describe("nucleo: argumentos, severidade, versão e estimativa", () => {
  it("inteiro inválido é erro; ausente usa o padrão", () => {
    expect(inteiroDoArgumento(undefined, "x", 6)).toBe(6);
    expect(inteiroDoArgumento("7", "x", 6)).toBe(7);
    expect(() => inteiroDoArgumento("abc", "x", 6)).toThrow(/inválido/);
    expect(() => inteiroDoArgumento("-1", "x", 6)).toThrow(/inválido/);
  });
  it("severidade com acento é aceita; fora de Alta|Media|Baixa é erro", () => {
    expect(normalizarSeveridade("Média")).toBe("Media");
    expect(normalizarSeveridade("baixa")).toBe("Baixa");
    expect(() => normalizarSeveridade("Critica")).toThrow(/severidade inválida/);
  });
  it("Node < 18 sai com mensagem clara", () => {
    expect(() => exigirNode("16.20.0")).toThrow(/Node ≥ 18/);
    expect(() => exigirNode("20.19.2")).not.toThrow();
  });
  it("estimativa estratificada pondera pela população", () => {
    const r = estimativaEstratificada([
      { populacao: 90, amostra: 3, casos: 3 },
      { populacao: 10, amostra: 3, casos: 0 },
    ]);
    expect(r.proporcao).toBeCloseTo(0.9, 10);
    expect(r.total).toBeCloseTo(90, 10);
  });
});

// ---------------------------------------------------------------------------------------------------
// metricas.mjs sobre uma árvore-fixture
// ---------------------------------------------------------------------------------------------------

describe("metricas.medir sobre árvore-fixture", () => {
  const raiz = mkdtempSync(join(tmpdir(), "medicao-ux-"));
  afterAll(() => rmSync(raiz, { recursive: true, force: true }));
  const escrever = (rel: string, texto: string) => {
    const p = join(raiz, ...rel.split("/"));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, texto);
  };
  escrever("tailwind.config.ts", `export default { theme: { extend: { colors: { gray: { 200: "a" }, red: { 600: "b" } } } } };`);
  escrever("src/app/globals.css", ":root {\n  --surface: #ffffff;\n  --border: rgba(0, 0, 0, 0.1);\n  --brand: #6366f1;\n}\n");
  escrever("src/app/(app)/loading.tsx", "export default function L() { return null; }");
  escrever("src/app/(app)/error.tsx", "export default function E() { return null; }");
  escrever("src/app/(app)/page.tsx", "export default function P() { return null; }");
  escrever("src/app/(app)/x/y/page.tsx", "export default function P() { notFound(); return null; }");
  escrever("src/app/login/page.tsx", "export default function P() { return null; }");
  escrever("src/app/(app)/x/Cores.tsx", `<p className="bg-gray-200 text-gray-950 bg-rose-500 border-red-300 text-red-600" />`);
  escrever("src/app/(app)/x/Cores.test.tsx", `<p className="bg-rose-500 bg-sky-500" />`);
  escrever("src/test/Apoio.tsx", `<p className="bg-rose-500" /><input name="z" />`);
  escrever("src/app/(app)/x/Form.tsx", `<label>A<input name="a" /></label><input aria-label="B" /><input name="d" /><select onChange={(e) => f(e)} />`);
  escrever("src/app/(app)/x/ComCentral.tsx", `"use client";\nimport { a } from "@/server/a";\nconst acao = useAcaoCliente({});`);
  escrever("src/app/(app)/x/SemCatch.tsx", `"use client";\nimport { a } from "@/server/a";\nawait a();`);
  escrever("src/app/(app)/x/Lista.tsx", `<a>Próxima</a>`);

  const { n, secoes } = medir(raiz);
  it("estado de rota: páginas, especiais e cobertura por herança", () => {
    expect(n.paginas).toBe(3);
    expect([n.loading, n.loadingCobertas, n.error, n.errorCobertas]).toEqual([1, 2, 1, 2]);
    expect(n.chamadasNotFound).toBe(1);
  });
  it("cor: testes e src/test fora; shade e borda fora do mapa contam", () => {
    expect([n.coresFora, n.coresMapeadas]).toEqual([3, 2]);
  });
  it("controles: src/test fora; aria-label e <label> nomeiam", () => {
    expect([n.controles, n.controlesSemNome]).toEqual([4, 2]);
  });
  it("contraste da fixture: --border e #fff/--brand", () => {
    expect(n.familiasReprovadas).toBe(2);
    expect(secoes["7.4"].find((i) => i.nome === "pares de token reprovando AA")?.valor).toBe("2 famílias (#fff/--brand, --border)");
  });
  it("catch literal e central; paginação só para frente", () => {
    expect([n.chamaAcao, n.semCatchLiteral, n.semCatchCentral]).toEqual([2, 2, 1]);
    expect(n.soParaFrente).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------
// achados.mjs e amostra.mjs contra o doc 42
// ---------------------------------------------------------------------------------------------------

describe("achados do doc 42", () => {
  it("872 achados em tabela: 145 Alta, 515 Média, 212 Baixa, em 14 áreas", () => {
    expect(ACHADOS).toHaveLength(872);
    const sev = (s: string) => ACHADOS.filter((a) => a.sev === s).length;
    expect([sev("Alta"), sev("Media"), sev("Baixa")]).toEqual([145, 515, 212]);
    expect(Object.keys(resumoPorArea(ACHADOS))).toHaveLength(14);
  });
  it("área vem do ### e rota do ####", () => {
    expect(ACHADOS[0]).toMatchObject({ linha: 224, area: "Alunos e turmas", rota: "/alunos", n: 1, sev: "Alta" });
  });
  it("extrator isolado: severidade com acento e pipe escapado", () => {
    const doc = ["## 6. Página", "### Área X", "#### `/r`", "| 1 | Média | Cat | a \\| b | ev | rec |", "## 7. Medir"].join("\n");
    expect(extrairAchados(doc)).toEqual([
      { linha: 4, area: "Área X", rota: "/r", n: 1, sev: "Media", categoria: "Cat", problema: "a \\| b", evidencia: "ev", recomendacao: "rec" },
    ]);
  });
});

describe("amostra semeada", () => {
  const sorteada = amostra(ACHADOS, 6, 3, 42);
  it("6 Média e 3 Baixa por área = 126", () => {
    expect(sorteada).toHaveLength(126);
  });
  it("argumentos: padrão 6/3/42, semente lida, inválido é erro", () => {
    expect(argumentosDaAmostra([])).toEqual({ qMedia: 6, qBaixa: 3, semente: 42 });
    expect(argumentosDaAmostra(["6", "3", "7"]).semente).toBe(7);
    expect(() => argumentosDaAmostra(["abc", "3", "42"])).toThrow();
    expect(() => argumentosDaAmostra(["6", "3", "xyz"])).toThrow();
  });
  it("semente diferente dá outra amostra; mesma semente, a mesma", () => {
    const linhas = (s: number) => amostra(ACHADOS, 6, 3, s).map((a) => a.linha).join();
    expect(linhas(42)).toBe(linhas(42));
    expect(linhas(7)).not.toBe(linhas(42));
  });
  it("gerador e Fisher–Yates: valores fixos", () => {
    const g = gerador(42);
    expect([g(), g()].map((v) => Math.round(v * 1e6))).toEqual([252345, 88125]);
    expect(sortear([1, 2, 3, 4, 5].map((linha) => ({ linha })), 5, gerador(1)).map((x) => x.linha)).toEqual([1, 2, 3, 4, 5]);
    expect(sortear([1, 2, 3, 4, 5].map((linha) => ({ linha })), 2, gerador(1))).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------------------------------
// Consistência do docs/43 com os scripts
// ---------------------------------------------------------------------------------------------------

describe("docs/43: tabela 4.1 (Alta)", () => {
  const linhas = secao("### 4.1", "## 5.").filter((l) => /^\| \d+ \|/.test(l)).map(celulas);
  const STATUS = ["resolvido", "parcial", "aberto"] as const;
  it("tem exatamente os 145 Alta do doc 42", () => {
    const doDoc = linhas.map((c) => Number(c[0])).sort((a, b) => a - b);
    const alta = ACHADOS.filter((a) => a.sev === "Alta").map((a) => a.linha);
    expect(doDoc).toEqual(alta);
  });
  it("soma por área e total batem com o resumo da seção 4", () => {
    const area = new Map(ACHADOS.map((a) => [a.linha, a.area]));
    const areas = Object.keys(resumoPorArea(ACHADOS));
    const resumo = secao("## 4.", "### 4.1").filter((l) => /^\| [^-|*][^|]* \| \d+ \| \d+ \| \d+ \| \d+ \|$/.test(l)).map(celulas);
    expect(resumo).toHaveLength(14);
    resumo.forEach((r, i) => {
      const daArea = linhas.filter((c) => area.get(Number(c[0])) === areas[i]);
      expect([daArea.length, ...STATUS.map((s) => daArea.filter((c) => c[3] === s).length)], r[0]).toEqual(r.slice(1).map(Number));
    });
    const total = DOC_43.find((l) => l.startsWith("| **Total** | **145**"));
    const n = STATUS.map((s) => linhas.filter((c) => c[3] === s).length);
    expect(total).toBe(`| **Total** | **145** | **${n[0]} (${Math.round((100 * n[0]) / 145)}%)** | **${n[1]} (${Math.round((100 * n[1]) / 145)}%)** | **${n[2]} (${Math.round((100 * n[2]) / 145)}%)** |`);
  });
});

describe("docs/43: tabela 5.1 (amostra Média/Baixa)", () => {
  const linhas = secao("### 5.1", "## 6.").filter((l) => /^\| \d+ \|/.test(l)).map(celulas);
  const STATUS = ["resolvido", "parcial", "aberto"] as const;
  it("tem exatamente as 126 linhas sorteadas com semente 42", () => {
    expect(linhas.map((c) => Number(c[0]))).toEqual(amostra(ACHADOS, 6, 3, 42).map((a) => a.linha).sort((a, b) => a - b));
  });
  it("contagem por área × severidade e populações batem com o resumo da seção 5; estimativa estratificada idem", () => {
    const resumo = secao("## 5.", "### 5.1").filter((l) => /^\| [^-|*][^|]* \| \d+ \/ \d+ \/ \d+ \| \d+ \/ \d+ \/ \d+ \| \d+ \/ \d+ \|$/.test(l)).map(celulas);
    expect(resumo).toHaveLength(14);
    const pop = Object.values(resumoPorArea(ACHADOS));
    const estratos: Record<(typeof STATUS)[number], { populacao: number; amostra: number; casos: number }[]> = { resolvido: [], parcial: [], aberto: [] };
    resumo.forEach((r, i) => {
      for (const [col, sev] of [[1, "Média"], [2, "Baixa"]] as const) {
        const doEstrato = linhas.filter((c) => c[1] === r[0] && c[4] === sev);
        const contagem = STATUS.map((s) => doEstrato.filter((c) => c[5] === s).length);
        expect(contagem.join(" / "), `${r[0]} ${sev}`).toBe(r[col]);
        const populacao = sev === "Média" ? pop[i].Media : pop[i].Baixa;
        STATUS.forEach((s, k) => estratos[s].push({ populacao, amostra: doEstrato.length, casos: contagem[k] }));
      }
      expect(r[3]).toBe(`${pop[i].Media} / ${pop[i].Baixa}`);
    });
    const n = STATUS.map((s) => linhas.filter((c) => c[5] === s).length);
    expect(DOC_43.some((l) => l.includes(`Na amostra crua: ${n[0]} resolvidos, ${n[1]} parciais e ${n[2]} abertos`))).toBe(true);
    const pct = (x: number) => (100 * x).toFixed(1).replace(".", ",");
    for (const [s, rotulo] of [["resolvido", "Resolvido"], ["parcial", "Parcial"], ["aberto", "Aberto"]] as const) {
      const e = estimativaEstratificada(estratos[s]);
      expect(DOC_43, rotulo).toContain(`| ${rotulo} | ${pct(e.proporcao)}% | ${pct(e.ic95[0])}–${pct(e.ic95[1])}% | ${Math.round(e.total)} |`);
    }
  });
});

describe("docs/43: tabela 2.1 (calibração)", () => {
  it("a frase de resultado conta as linhas da tabela", () => {
    const linhas = secao("### 2.1", "## 3.").filter((l) => /^\| [^-|]/.test(l) && !l.startsWith("| Métrica")).map(celulas);
    const iguais = linhas.filter((c) => c[3] === "—").length;
    expect(DOC_43).toContain(`Resultado: ${iguais} linhas iguais e ${linhas.length - iguais} diferentes. Das ${linhas.length - iguais}, 4 são de unidade ou método (enum, códigos, busca, tabelas), 1 é de denominador (%) e 7 são de critério de regex (de −11 a +3).`);
  });
});
