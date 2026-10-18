import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Trava de auditoria das configurações (Fase 5, Task 43). Lê a AST do TypeScript (como
 * src/test/guard-pagina.ts), não o texto: comentário e string não contam.
 *
 * 1. Toda função exportada que pode gravar (async, retorno Promise ou chamada direta de mutação do
 *    Prisma) dos módulos de configuração grava `Evento` DENTRO de uma transação, de um destes jeitos:
 *    - abre `x.$transaction(cb)` e, no callback, chama `registrarEvento(<tx do callback>, …)` ou passa
 *      esse tx a uma função que o faz (seguindo chamadas entre arquivos de src/);
 *    - recebe o tx como parâmetro (tipo `Prisma.TransactionClient`/`Tx`) e registra nele: o chamador
 *      fornece a transação (ex.: `aplicarSlaSetor`, `atribuirAutomaticamente`);
 *    - chama outra função que satisfaz o primeiro caso (ex.: a fronteira `salvarSlaDaTela`).
 *    `registrarEvento(prisma, …)` fora de transação não conta. Exceção só para as leituras de
 *    SOMENTE_LEITURA, e cada uma delas é conferida: não chama mutação do Prisma, `$executeRaw*` nem
 *    `$transaction` (seguindo as chamadas). A criação preguiçosa do padrão (`upsert` com `update: {}`)
 *    não é alteração de configuração.
 * 2. Nenhum delete físico (`<modelo>.delete/deleteMany` de um model do schema, `DELETE FROM`/`TRUNCATE`
 *    em SQL cru) fora das exceções ancoradas em EXCECOES_DELETE.
 *
 * Limite: chamada por propriedade (`obj.f()`), função guardada em variável local ou passada como valor
 * não é seguida — o caminho não é reconhecido e a trava falha alto (falso negativo vira teste vermelho).
 */

const RAIZ = process.cwd();
const rel = (abs: string) => relative(RAIZ, abs).split("\\").join("/");

const ARQUIVOS_FIXOS = [
  "src/server/aria/versoes.ts",
  "src/server/aria/estado.ts",
  "src/server/aria/historico.ts",
  "src/server/aria/pausa.ts",
  "src/server/aria/conhecimento/fontes.ts",
  "src/server/metas/metas.ts",
];
const ARQUIVOS_CRM_CONFIG = readdirSync("src/server/crm-config")
  .filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts") && !n.endsWith(".d.ts"))
  .sort()
  .map((n) => `src/server/crm-config/${n}`);
const ARQUIVOS = [...ARQUIVOS_CRM_CONFIG, ...ARQUIVOS_FIXOS];

/** Leituras: não gravam Evento porque não alteram nada (conferido em `somente_leitura_nao_altera_nada`). */
const SOMENTE_LEITURA = new Set([
  // nomes do plano (Task 43)
  "painelIA", "listarRespostasRapidas", "progressoMetas", "versaoPublicada", "situacaoAria",
  // leituras reais que o plano não listou
  "rascunhoAtual", "respostasRapidasDoCompositor", "respostasParaAria", "listarPerfisNumero", "uploadIdPorUrl", "exigirEdicaoDoSetor",
]);

/** Remoções físicas aceitas, ancoradas em arquivo + chamada. */
const EXCECOES_DELETE = new Set([
  // Descarte do rascunho da Aria (Task 8): rascunho não é dado de negócio; `AgenteIARascunhoDescartado`.
  "src/server/aria/versoes.ts:versaoAgenteIA.delete",
  // Desfazer a TAG que a Aria pôs: remove o vínculo pessoa↔tag como crm/tags.ts; `TagRemovida`.
  "src/server/aria/historico.ts:pessoaTag.delete",
]);

const MUTACOES = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert", "delete", "deleteMany"]);
const MUTACOES_CLIENTE = new Set(["$executeRaw", "$executeRawUnsafe", "$transaction"]);
const ORIGEM_EVENTO = "src/server/_shared/evento.ts";

const DELEGADOS = new Set(
  [...readFileSync("prisma/schema.prisma", "utf8").matchAll(/^model\s+(\w+)/gm)].map((m) => m[1][0].toLowerCase() + m[1].slice(1)),
);

type NoFuncao = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
interface Funcao { arquivo: string; nome: string; no: NoFuncao; exportada: boolean }

const ehFuncao = (n: ts.Node | undefined): n is NoFuncao =>
  !!n && (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n));
const exportado = (n: ts.Node) => ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
const assincrona = (f: NoFuncao) => (ts.getModifiers(f) ?? []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);

function visitar(no: ts.Node, fn: (n: ts.Node) => void) {
  fn(no);
  ts.forEachChild(no, (f) => visitar(f, fn));
}

/** Leitor de módulos de src/ com memória; `virtuais` (caminho relativo → código) serve aos autotestes. */
class Projeto {
  private fontes = new Map<string, ts.SourceFile>();
  private memo = new Map<string, boolean>();
  constructor(private virtuais: Record<string, string> = {}) {}

  fonte(arquivo: string): ts.SourceFile {
    let sf = this.fontes.get(arquivo);
    if (!sf) {
      const codigo = this.virtuais[arquivo] ?? readFileSync(arquivo, "utf8");
      sf = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      this.fontes.set(arquivo, sf);
    }
    return sf;
  }

  private existe = (arquivo: string) => arquivo in this.virtuais || existsSync(arquivo);

  resolverModulo(deArquivo: string, especificador: string): string | null {
    let base: string;
    if (especificador.startsWith("@/")) base = rel(resolve(RAIZ, "src", especificador.slice(2)));
    else if (especificador.startsWith(".")) base = rel(resolve(RAIZ, dirname(deArquivo), especificador));
    else return null;
    for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) if (/\.tsx?$/.test(c) && this.existe(c)) return c;
    return null;
  }

  /** Declaração de topo `nome` do arquivo (função ou const com função), seguindo re-exportações. */
  declaracao(arquivo: string, nome: string, visto = new Set<string>()): Funcao | null {
    const chave = `${arquivo}#${nome}`;
    if (visto.has(chave)) return null;
    visto.add(chave);
    const sf = this.fonte(arquivo);
    for (const s of sf.statements) {
      if (ts.isFunctionDeclaration(s) && s.name?.text === nome && s.body) return { arquivo, nome, no: s, exportada: exportado(s) };
      if (ts.isVariableStatement(s)) {
        for (const d of s.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === nome && ehFuncao(d.initializer)) return { arquivo, nome, no: d.initializer, exportada: exportado(s) };
        }
      }
    }
    for (const s of sf.statements) {
      if (!ts.isExportDeclaration(s) || !s.moduleSpecifier || !ts.isStringLiteral(s.moduleSpecifier)) continue;
      const alvo = this.resolverModulo(arquivo, s.moduleSpecifier.text);
      if (!alvo) continue;
      if (!s.exportClause) {
        const r = this.declaracao(alvo, nome, visto);
        if (r) return r;
      } else if (ts.isNamedExports(s.exportClause)) {
        const el = s.exportClause.elements.find((e) => e.name.text === nome);
        if (el) return this.declaracao(alvo, (el.propertyName ?? el.name).text, visto);
      }
    }
    // Importada e re-exportada por `export { x }` sem especificador.
    const imp = this.importacao(arquivo, nome);
    return imp ? this.declaracao(imp.arquivo, imp.nome, visto) : null;
  }

  private importacao(arquivo: string, local: string): { arquivo: string; nome: string } | null {
    for (const s of this.fonte(arquivo).statements) {
      if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
      const nomes = s.importClause?.namedBindings;
      if (!nomes || !ts.isNamedImports(nomes)) continue;
      const el = nomes.elements.find((e) => e.name.text === local);
      if (!el) continue;
      const alvo = this.resolverModulo(arquivo, s.moduleSpecifier.text);
      return alvo ? { arquivo: alvo, nome: (el.propertyName ?? el.name).text } : null;
    }
    return null;
  }

  /** Alvo de `f(...)` com `f` identificador: função de topo do arquivo ou importada de src/. */
  alvo(arquivo: string, c: ts.CallExpression): Funcao | null {
    if (!ts.isIdentifier(c.expression)) return null;
    const nome = c.expression.text;
    const local = this.declaracao(arquivo, nome);
    if (local) return local;
    const imp = this.importacao(arquivo, nome);
    return imp ? this.declaracao(imp.arquivo, imp.nome) : null;
  }

  ehRegistrarEvento(arquivo: string, c: ts.CallExpression): boolean {
    const f = this.alvo(arquivo, c);
    return !!f && f.arquivo === ORIGEM_EVENTO && f.nome === "registrarEvento";
  }

  private comMemo(chave: string, calc: () => boolean): boolean {
    const m = this.memo.get(chave);
    if (m !== undefined) return m;
    this.memo.set(chave, false); // ciclo: não prova nada
    const r = calc();
    this.memo.set(chave, r);
    return r;
  }

  /** `no` (função) registra Evento no seu parâmetro de índice k (direto ou passando-o adiante). */
  registraNoParametro(arquivo: string, no: NoFuncao, k: number, chave?: string): boolean {
    const p = no.parameters[k];
    if (!p || !ts.isIdentifier(p.name)) return false;
    const nomeTx = p.name.text;
    const calc = () => {
      let achou = false;
      visitar(no.body!, (n) => {
        if (achou || !ts.isCallExpression(n)) return;
        const primeiro = n.arguments[0];
        if (this.ehRegistrarEvento(arquivo, n)) {
          if (primeiro && ts.isIdentifier(primeiro) && primeiro.text === nomeTx) achou = true;
          return;
        }
        const g = this.alvo(arquivo, n);
        if (!g) return;
        n.arguments.forEach((a, j) => {
          if (!achou && ts.isIdentifier(a) && a.text === nomeTx && this.registraNoParametro(g.arquivo, g.no, j, `${g.arquivo}#${g.nome}`)) achou = true;
        });
      });
      return achou;
    };
    return chave ? this.comMemo(`P:${chave}:${k}`, calc) : calc();
  }

  /** `no` abre uma transação que registra Evento no tx dela (direto ou por uma função chamada). */
  abreTransacaoQueRegistra(arquivo: string, no: NoFuncao, chave?: string): boolean {
    const calc = () => {
      let achou = false;
      visitar(no.body!, (n) => {
        if (achou || !ts.isCallExpression(n)) return;
        if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "$transaction") {
          const cb = n.arguments[0];
          if (ehFuncao(cb) && this.registraNoParametro(arquivo, cb, 0)) achou = true;
          return;
        }
        const g = this.alvo(arquivo, n);
        if (g && this.abreTransacaoQueRegistra(g.arquivo, g.no, `${g.arquivo}#${g.nome}`)) achou = true;
      });
      return achou;
    };
    return chave ? this.comMemo(`A:${chave}`, calc) : calc();
  }

  /** Mutações (diretas ou nas funções chamadas, seguindo src/) feitas por `no`. */
  mutacoes(arquivo: string, no: NoFuncao, visto = new Set<string>()): string[] {
    const out: string[] = [];
    visitar(no.body!, (n) => {
      if (!ts.isCallExpression(n)) return;
      const m = mutacaoPrisma(n);
      if (m) out.push(`${arquivo}:${m}`);
      const g = this.alvo(arquivo, n);
      if (!g) return;
      const chave = `${g.arquivo}#${g.nome}`;
      if (visto.has(chave)) return;
      visto.add(chave);
      out.push(...this.mutacoes(g.arquivo, g.no, visto));
    });
    return out;
  }
}

/** `x.modelo.metodo(...)` de um model do schema, ou `x.$executeRaw/$transaction`. `upsert` com `update: {}` é criação do padrão. */
function mutacaoPrisma(c: ts.CallExpression): string | null {
  if (!ts.isPropertyAccessExpression(c.expression)) return null;
  const metodo = c.expression.name.text;
  if (MUTACOES_CLIENTE.has(metodo)) return metodo;
  const dono = c.expression.expression;
  if (!MUTACOES.has(metodo) || !ts.isPropertyAccessExpression(dono) || !DELEGADOS.has(dono.name.text)) return null;
  if (metodo === "upsert" && upsertSoCriaPadrao(c)) return null;
  return `${dono.name.text}.${metodo}`;
}

function upsertSoCriaPadrao(c: ts.CallExpression): boolean {
  const arg = c.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return false;
  const upd = arg.properties.find((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "update");
  return !!upd && ts.isPropertyAssignment(upd) && ts.isObjectLiteralExpression(upd.initializer) && upd.initializer.properties.length === 0;
}

function funcoesExportadas(prj: Projeto, arquivo: string): Funcao[] {
  const sf = prj.fonte(arquivo);
  const out: Funcao[] = [];
  for (const s of sf.statements) {
    const padrao = ts.canHaveModifiers(s) && (ts.getModifiers(s) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (ts.isExportAssignment(s) || padrao) throw new Error(`${arquivo}: export default não é coberto pela trava`);
    if (ts.isExportDeclaration(s) && !s.isTypeOnly) throw new Error(`${arquivo}: export { … } não é coberto pela trava; exporte na declaração`);
    if (!exportado(s)) continue;
    if (ts.isFunctionDeclaration(s) && s.name && s.body) out.push({ arquivo, nome: s.name.text, no: s, exportada: true });
    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && ehFuncao(d.initializer)) out.push({ arquivo, nome: d.name.text, no: d.initializer, exportada: true });
      }
    }
  }
  return out;
}

/** Pode gravar: async, retorno declarado Promise, ou mutação direta do Prisma no corpo. */
function podeGravar(f: Funcao): boolean {
  if (assincrona(f.no)) return true;
  if (f.no.type && /\bPromise\b/.test(f.no.type.getText())) return true;
  let mut = false;
  visitar(f.no.body!, (n) => { if (ts.isCallExpression(n) && mutacaoPrisma(n)) mut = true; });
  return mut;
}

const ehTx = (p: ts.ParameterDeclaration) => !!p.type && /\bTransactionClient\b|^Tx$/.test(p.type.getText());

function chamaRegistrarEventoDentroDeTransacao(prj: Projeto, f: Funcao): boolean {
  const chave = `${f.arquivo}#${f.nome}`;
  if (prj.abreTransacaoQueRegistra(f.arquivo, f.no, chave)) return true;
  return f.no.parameters.some((p, k) => ehTx(p) && prj.registraNoParametro(f.arquivo, f.no, k, chave));
}

/** Remoções físicas do arquivo: `modelo.delete/deleteMany` e SQL cru com DELETE FROM/TRUNCATE. */
function chamadasDelete(prj: Projeto, arquivo: string): string[] {
  const out: string[] = [];
  visitar(prj.fonte(arquivo), (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ["delete", "deleteMany"].includes(n.expression.name.text)) {
      const dono = n.expression.expression;
      if (ts.isPropertyAccessExpression(dono) && DELEGADOS.has(dono.name.text)) out.push(`${arquivo}:${dono.name.text}.${n.expression.name.text}`);
    }
    if ((ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) && /\bDELETE\s+FROM\b|\bTRUNCATE\b/i.test(n.text)) {
      out.push(`${arquivo}:sql:${n.text.trim().slice(0, 40)}`);
    }
  });
  return out;
}

describe("trava de auditoria das configurações", () => {
  const prj = new Projeto();

  it("cobre_os_modulos_da_task_43", () => {
    expect(ARQUIVOS_CRM_CONFIG).toEqual(expect.arrayContaining([
      "src/server/crm-config/distribuicao.ts", "src/server/crm-config/ia.ts", "src/server/crm-config/perfil-numero.ts",
      "src/server/crm-config/respostas-rapidas.ts", "src/server/crm-config/sla.ts", "src/server/crm-config/tags-campos.ts",
    ]));
    for (const a of ARQUIVOS) expect(existsSync(a), a).toBe(true);
    // Cada leitura dispensada existe como função exportada de um dos arquivos (a lista não envelhece).
    const exportadas = new Set(ARQUIVOS.flatMap((a) => funcoesExportadas(prj, a).map((f) => f.nome)));
    for (const nome of SOMENTE_LEITURA) expect(exportadas.has(nome), nome).toBe(true);
  });

  it("toda_action_exportada_grava_evento", () => {
    const semEvento: string[] = [];
    let conferidas = 0;
    for (const arquivo of ARQUIVOS) {
      for (const fn of funcoesExportadas(prj, arquivo)) {
        if (SOMENTE_LEITURA.has(fn.nome) || !podeGravar(fn)) continue;
        conferidas++;
        if (!chamaRegistrarEventoDentroDeTransacao(prj, fn)) semEvento.push(`${arquivo}#${fn.nome}`);
      }
    }
    expect(semEvento).toEqual([]);
    expect(conferidas).toBeGreaterThan(30);
  });

  it("somente_leitura_nao_altera_nada", () => {
    const alteram: string[] = [];
    for (const arquivo of ARQUIVOS) {
      for (const fn of funcoesExportadas(prj, arquivo)) {
        if (!SOMENTE_LEITURA.has(fn.nome)) continue;
        for (const m of prj.mutacoes(arquivo, fn.no)) alteram.push(`${fn.nome} → ${m}`);
      }
    }
    expect(alteram).toEqual([]);
  });

  it("nenhum_delete_fisico", () => {
    const todas = ARQUIVOS.flatMap((a) => chamadasDelete(prj, a));
    expect(todas.filter((c) => !EXCECOES_DELETE.has(c))).toEqual([]);
    // Exceção que não existe mais sai da lista.
    for (const e of EXCECOES_DELETE) expect(todas, e).toContain(e);
  });
});

describe("autoteste dos helpers da trava", () => {
  const EVENTO = `export async function registrarEvento(tx: unknown, e: unknown) {}`;
  const cabecalho = `import { prisma } from "@/lib/prisma";\nimport { registrarEvento } from "@/server/_shared";\ntype Tx = Prisma.TransactionClient;\n`;
  const projeto = (codigo: string, extra: Record<string, string> = {}) => {
    const p = new Projeto({ "src/server/_shared/evento.ts": EVENTO, "src/server/_shared/index.ts": `export * from "./evento";`, "src/x/a.ts": cabecalho + codigo, ...extra });
    return { p, fns: funcoesExportadas(p, "src/x/a.ts") };
  };
  const grava = (codigo: string, extra?: Record<string, string>) => {
    const { p, fns } = projeto(codigo, extra);
    return Object.fromEntries(fns.map((f) => [f.nome, chamaRegistrarEventoDentroDeTransacao(p, f)]));
  };

  it("aceita_evento_no_tx_da_transacao_direto_ou_por_helper", () => {
    expect(grava(`
      export async function a() { await prisma.$transaction(async (tx) => { await tx.tag.update({}); await registrarEvento(tx, {}); }); }
      async function aplicar(t: Tx) { await registrarEvento(t, {}); }
      export async function b() { await prisma.$transaction((tx) => aplicar(tx)); }
      export async function c() { return executarAcao(async () => { await b(); }); }
      export async function d(tx: Tx) { await aplicar(tx); }
      const ev = (tx: Tx) => registrarEvento(tx, {});
      export async function e() { await prisma.$transaction(async (tx) => { await ev(tx); }).catch(() => null); }
    `)).toEqual({ a: true, b: true, c: true, d: true, e: true });
  });

  it("segue_import_entre_arquivos_e_reexportacao", () => {
    expect(grava(`import { salvar } from "../y/b";\nexport async function f() { await salvar(); }`, {
      "src/y/b.ts": `import { registrarEvento } from "../server/_shared";\nimport { prisma } from "@/lib/prisma";\nexport async function salvar() { await prisma.$transaction(async (tx) => registrarEvento(tx, {})); }`,
    })).toEqual({ f: true });
  });

  it("recusa_sem_evento_evento_fora_da_transacao_e_tx_trocado", () => {
    expect(grava(`
      export async function semEvento() { await prisma.$transaction(async (tx) => { await tx.tag.update({}); }); }
      export async function foraDaTransacao() { await prisma.tag.update({}); await registrarEvento(prisma, {}); }
      export async function eventoNoPrisma() { await prisma.$transaction(async (tx) => { await registrarEvento(prisma, {}); }); }
      async function aplicar(t: Tx) { await registrarEvento(t, {}); }
      export async function helperComPrisma() { await prisma.$transaction(async (tx) => { await aplicar(prisma); }); }
      export async function paramSemTipoTx(t: unknown) { await registrarEvento(t, {}); }
      const registrarEventoFalso = async (tx: Tx, e: unknown) => {};
      export async function isca() { await prisma.$transaction(async (tx) => registrarEventoFalso(tx, {})); }
    `)).toEqual({ semEvento: false, foraDaTransacao: false, eventoNoPrisma: false, helperComPrisma: false, paramSemTipoTx: false, isca: false });
  });

  it("export_default_e_export_lista_falham_alto", () => {
    expect(() => projeto(`async function f() {}\nexport { f };`)).toThrow(/export \{/);
    expect(() => projeto(`export default async function f() {}`)).toThrow(/export default/);
  });

  it("detecta_mutacao_em_leitura_e_delete_fisico", () => {
    const { p, fns } = projeto(`
      async function interna() { await prisma.tag.create({}); }
      export async function ler() { await prisma.configIA.upsert({ where: {}, create: {}, update: {} }); return prisma.tag.findMany(); }
      export async function lerQueGrava() { await interna(); }
      export async function apaga() { await prisma.tag.deleteMany({}); await prisma.$executeRaw\`DELETE FROM "Tag"\`; const s = new Set([1]); s.delete(1); }
    `);
    const mut = Object.fromEntries(fns.map((f) => [f.nome, p.mutacoes(f.arquivo, f.no)]));
    expect(mut.ler).toEqual([]);
    expect(mut.lerQueGrava).toEqual(["src/x/a.ts:tag.create"]);
    expect(chamadasDelete(p, "src/x/a.ts")).toEqual(["src/x/a.ts:tag.deleteMany", 'src/x/a.ts:sql:DELETE FROM "Tag"']);
  });
});
