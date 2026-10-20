import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { DESTINO_ORDENACAO, ORIGEM_ORDENACAO, expressaoOrdenacaoSql, normalizarParaOrdenacao } from "./nome-ordenacao";

describe("normalizarParaOrdenacao", () => {
  it("tira o acento de Á/á/À/Â/Ã/Ç e põe em minúsculas", () => {
    expect(normalizarParaOrdenacao("Álvaro")).toBe("alvaro");
    expect(normalizarParaOrdenacao("álvaro")).toBe("alvaro");
    expect(normalizarParaOrdenacao("Àquila")).toBe("aquila");
    expect(normalizarParaOrdenacao("Ângela")).toBe("angela");
    expect(normalizarParaOrdenacao("Ãnia")).toBe("ania");
    expect(normalizarParaOrdenacao("Çeliane")).toBe("celiane");
    expect(normalizarParaOrdenacao("ç")).toBe("c");
  });

  it("combinados: vários acentos, maiúsculas e outras línguas no mesmo nome", () => {
    expect(normalizarParaOrdenacao("JOÃO CONCEIÇÃO")).toBe("joao conceicao");
    expect(normalizarParaOrdenacao("Ênio Ávila Ñúñez")).toBe("enio avila nunez");
    expect(normalizarParaOrdenacao("Zoë Øster Łukasz Ștefan")).toBe("zoe oster lukasz stefan");
    // NFD: letra + diacrítico combinante solto (comum em texto colado de macOS).
    expect(normalizarParaOrdenacao("A\u0301lvaro Conceic\u0327a\u0303o")).toBe("alvaro conceicao");
  });

  it("colapsa espaços repetidos (inclusive tab e espaço duro) e apara as pontas", () => {
    expect(normalizarParaOrdenacao("  Ana   Maria  ")).toBe("ana maria");
    expect(normalizarParaOrdenacao("Ana\t\u00A0 Maria")).toBe("ana maria");
    expect(normalizarParaOrdenacao("")).toBe("");
  });

  it("caracteres fora do mapa ficam como estão", () => {
    expect(normalizarParaOrdenacao("O'Neil-2")).toBe("o'neil-2");
  });

  it("ordenar pela forma normalizada põe Álvaro entre Alice e Bruno", () => {
    const nomes = ["Bruno", "Álvaro", "Zé", "alice", "Ângela"];
    const ordenados = [...nomes].sort((a, b) => {
      const x = normalizarParaOrdenacao(a), y = normalizarParaOrdenacao(b);
      return x < y ? -1 : x > y ? 1 : 0; // comparação por código, como o Postgres com locale C
    });
    expect(ordenados).toEqual(["alice", "Álvaro", "Ângela", "Bruno", "Zé"]);
  });
});

describe("mapa do translate", () => {
  it("cada caractere de origem aparece uma vez e só os combinantes ficam sem par", () => {
    const origem = [...ORIGEM_ORDENACAO];
    expect(new Set(origem).size).toBe(origem.length);
    const semPar = origem.slice([...DESTINO_ORDENACAO].length);
    expect(semPar.every((c) => c.charCodeAt(0) >= 0x300 && c.charCodeAt(0) <= 0x36f)).toBe(true);
    expect(semPar).toHaveLength(0x70);
    // O literal SQL não pode ter aspas nem barra invertida.
    expect(ORIGEM_ORDENACAO + DESTINO_ORDENACAO).not.toMatch(/['\\]/);
    expect([...DESTINO_ORDENACAO].every((c) => /^[a-z ]$/.test(c))).toBe(true);
  });
});

// Trava (D1, #141): a coluna `nomeOrdenacao` é GERADA pelo banco em Aluno, Pessoa e Empresa.
// 1. A migration usa exatamente a expressão deste módulo (o espelho em TS não pode divergir).
// 2. O schema declara a coluna com `dbgenerated` e o índice, para o `migrate diff` não propor removê-los.
// 3. Nenhum código de produção grava ou lê a coluna fora de `orderBy`: gravar falharia no banco
//    (coluna GENERATED ALWAYS) e ninguém precisa mantê-la em sincronia à mão.
describe("trava da coluna nomeOrdenacao", () => {
  const raiz = process.cwd();
  const migracao = readFileSync(path.join(raiz, "prisma/migrations/20261019110000_nome_ordenacao/migration.sql"), "utf8");
  const schema = readFileSync(path.join(raiz, "prisma/schema.prisma"), "utf8");
  const modelo = (nome: string) => schema.match(new RegExp(`model ${nome} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
  const TABELAS: Record<string, string> = {
    Aluno: `"primeiroNome" || ' ' || COALESCE("sobrenome", '')`,
    Pessoa: `"nome"`,
    Empresa: `"nome"`,
  };

  it.each(Object.entries(TABELAS))("migration cria a coluna gerada e o índice em %s", (tabela, entrada) => {
    expect(migracao).toContain(
      `ALTER TABLE "${tabela}" ADD COLUMN "nomeOrdenacao" TEXT NOT NULL GENERATED ALWAYS AS (${expressaoOrdenacaoSql(entrada)}) STORED;`,
    );
    expect(migracao).toContain(`CREATE INDEX "${tabela}_nomeOrdenacao_id_idx" ON "${tabela}"("nomeOrdenacao", "id");`);
  });

  it.each(Object.keys(TABELAS))("schema declara a coluna gerada e o índice em %s", (tabela) => {
    const m = modelo(tabela);
    const declaracao = m.match(/^\s*nomeOrdenacao\s+String\s+@default\(dbgenerated\("(.*)"\)\)\s*$/m);
    expect(declaracao, `model ${tabela} sem nomeOrdenacao dbgenerated`).not.toBeNull();
    expect(declaracao![1]).toContain(`translate(`);
    expect(declaracao![1]).toContain(`'${ORIGEM_ORDENACAO}'`);
    expect(declaracao![1]).toContain(`'${DESTINO_ORDENACAO}'`);
    expect(m).toMatch(/@@index\(\[nomeOrdenacao, id\]\)/);
  });

  it("código de produção só usa nomeOrdenacao como critério de orderBy", () => {
    // Pela AST (comentário não conta): toda menção é chave de objeto com valor "asc"/"desc" ou `dir`.
    // Em string/template (SQL cru, select dinâmico) também é proibida.
    const arquivos: string[] = [];
    const varrer = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) varrer(p);
        else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) arquivos.push(p);
      }
    };
    for (const d of ["src", "prisma", "scripts"]) varrer(path.join(raiz, d));
    const usos: string[] = [];
    const indevidos: string[] = [];
    for (const arq of arquivos) {
      const texto = readFileSync(arq, "utf8");
      if (!texto.includes("nomeOrdenacao")) continue;
      const fonte = ts.createSourceFile(arq, texto, ts.ScriptTarget.Latest, true, arq.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visitar = (n: ts.Node) => {
        const literal = ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n);
        if ((ts.isIdentifier(n) || literal) && n.text.includes("nomeOrdenacao")) {
          const onde = `${path.relative(raiz, arq)}:${fonte.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
          usos.push(onde);
          const pai = n.parent;
          const ok = n.text === "nomeOrdenacao" && ts.isPropertyAssignment(pai) && pai.name === n &&
            ((ts.isStringLiteral(pai.initializer) && ["asc", "desc"].includes(pai.initializer.text)) ||
              (ts.isIdentifier(pai.initializer) && pai.initializer.text === "dir"));
          if (!ok) indevidos.push(onde);
        }
        ts.forEachChild(n, visitar);
      };
      visitar(fonte);
    }
    expect(indevidos).toEqual([]);
    expect(usos.length).toBeGreaterThanOrEqual(6);
  });
});
