import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import {
  AlcanceImpactoQuantidadeAulas, CanalAvisoAlteracaoAgenda, CategoriaDocumento, ClassificacaoImpactoCoberturaAditivo,
  DecisaoImpactoTaxaAditivo, EstadoDiaCompensacao, EstadoEnvioAssinatura, EstadoLinhaPreparacaoMigracao,
  EstadoReconferenciaDeltaDesistencia, EstadoReservaDevolucaoCredito, FinalidadeTokenPortalAluno,
  ModalidadeConciliacaoFinanceiraMigracao, MotivoPendenciaAvisoAgenda, ParticipacaoAula, ResultadoEnsaioVinculoMigracao,
  SituacaoAplicacaoCadastroMigracao, SituacaoAvisoAlteracaoAgenda, SituacaoEnvioPortalAluno, SituacaoPropostaQuantidadeAulas,
  SituacaoTrocaEmailPortalAluno, StatusConjuntoImpactosCoberturaAditivo, StatusConjuntoImpactosTaxaAditivo,
  StatusCorrecaoCadastro, StatusFaturaB2B, StatusIntencao, StatusMudancaAcademica, StatusPropostaAcertoTaxaAditivo,
  StatusPropostaConciliacaoFinanceiraMigracao, StatusPropostaEntradaFinanceiraHistoricaMigracao,
  StatusPropostaPresencaHistoricaMigracao, StatusReservaSegundaChamada, StatusReservaVaga, StatusSolicitacaoEncerramento,
  StatusTemplate, StatusTurma, TipoAjuste, TipoAprovacao, TipoDestinacaoRecebimento, TipoMensagem, TipoMovimentacao,
  TipoSugestaoIA, UnidadePermutaServico, Vigencia, StatusEncontroAgenda, StatusPagamentoInformado, ReferenciaCoberturaMensal,
  FinalidadeNumero, FormaAgendaOferta, EtapaLead, Papel,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as L from "@/lib/labels";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { PagadorEntradaFinanceiraHistoricaSchema } from "@/server/migracao/entrada-financeira-historica-schema";
import { OcorrenciaHorasSchema } from "@/server/matricula/ocorrencia-horas";
import { SaldoCompraHorasSchema } from "@/server/matricula/saldo-horas";

// E5 (docs/42-auditoria-frontend-ux.md §5.7): enum cru na tela ("Estado: PREVISTO", "COMPREENSAO ORAL",
// "PENDENTE_DECISAO") e mapas de rótulo soltos em telas (30 ad-hoc em 23 arquivos). A trava tem três
// partes:
//   (i)  telas não montam rótulo a partir do código (`replaceAll("_", " ")`, `.toLowerCase()` do enum) nem
//        imprimem enum direto no texto — por AST (campo com nome de enum), por TIPO (checker do TypeScript: a
//        expressão é união de literais de enum, qualquer que seja o nome; C13 da #138) e por RENDERIZAÇÃO em cinco
//        telas, cada uma com todos os valores dos seus enums;
//   (ii) mapa de rótulo de enum (código → texto, em qualquer forma) só existe em src/lib/labels.ts — também fora
//        das telas (src/lib, src/server); exceções ancoradas (arquivo + nome + motivo), cada uma casando com um caso;
//   (iii) labels.ts exporta só `rotular` e os mapas listados; os mapas novos cobrem exatamente os valores do enum,
//        em texto de gente, e mapa interno só serve de base, por spread, a mapa exportado.
//
// Tempo: o Program com checker é criado uma vez (só as telas e o que elas importam de src/; `@prisma/client` e
// `react` viram declarações virtuais pequenas, o resto de node_modules fica sem resolver). Medido na R1 da #150:
// 25–42 s para a trava + travas irmãs (Linux com a máquina carregada; antes, ~2 s só com AST; a parte sintática
// sozinha fica em ~1,5 s). A execução imprime o tempo do Program e o da varredura das telas.

// ---------------------------------------------------------------------------------------------------
// Fontes e enums
// ---------------------------------------------------------------------------------------------------

/** Enums do schema (lidos do próprio schema.prisma) + habilidades avaliadas (enum de domínio). */
function enumsDoSchema(schema: string): Map<string, string[]> {
  const enums = new Map<string, string[]>();
  for (const m of schema.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const valores = m[2].split("\n").map((l) => l.replace(/\/\/.*$/, "").trim().split(/\s+/)[0]).filter((v) => /^[A-Z][A-Z0-9_]*$/.test(v ?? ""));
    enums.set(m[1], valores);
  }
  return enums;
}
const SCHEMA = readFileSync("prisma/schema.prisma", "utf-8");
const ENUMS = enumsDoSchema(SCHEMA);
ENUMS.set("Habilidade", [...HABILIDADES]);

/** Arquivos-fonte de uma raiz, sem os testes. */
const listar = (raiz: string) => (readdirSync(raiz, { recursive: true }) as string[])
  .filter((f) => /\.(t|j)sx?$/.test(f) && !/\.test\./.test(f))
  .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") }));
/** Telas: onde fica o texto lido (i) e onde não pode haver mapa de rótulo (ii). */
const fontes = ["src/app", "src/components"].flatMap(listar);
/** Domínio fora das telas: também não guarda mapa de rótulo (ii; R3 da #138, B13) — o lugar é src/lib/labels.ts. */
const fontesDominio = ["src/lib", "src/server"].flatMap(listar).filter((f) => f.arquivo !== "src/lib/labels.ts");

/** Árvore sintática; o tipo de script segue a extensão (.ts não é lido como TSX: `<T>(x)` viraria JSX). */
const arvore = (fonte: string, arquivo = "x.tsx") => ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true,
  arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : arquivo.endsWith(".jsx") ? ts.ScriptKind.JSX : arquivo.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS);
const visitar = (no: ts.Node, f: (n: ts.Node) => void) => { f(no); ts.forEachChild(no, (filho) => visitar(filho, f)); };
const linhaDe = (sf: ts.SourceFile, no: ts.Node) => sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1;

const CODIGO = /^[A-Z][A-Z0-9_]*$/;
const CLASSE = /(^|\s)(bg|text|border|ring|from|to)-[a-z]/;
/** Objeto não vazio só com valores de texto, e não de classes CSS — a forma de um mapa de rótulo. */
const ehMapaDeTexto = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).length > 0
  && Object.values(v).every((x) => typeof x === "string") && !Object.values(v).some((x) => CLASSE.test(x as string));
/** Códigos de enum conhecidos (schema + domínios dos mapas de labels.ts): o tipo precisa conter um deles para contar. */
const codigosConhecidos = () => new Set([...[...ENUMS.values()].flat(),
  ...Object.values(L).filter(ehMapaDeTexto).flatMap((m) => Object.keys(m as object))].filter((c) => CODIGO.test(c)));

// ---------------------------------------------------------------------------------------------------
// Projeto: de onde a trava lê (disco ou memória) e, com Program, o checker de tipos (C13 da #138)
// ---------------------------------------------------------------------------------------------------

const VAZIO: ReadonlySet<string> = new Set();
const lerDoDisco = (caminho: string): string | undefined => { try { return readFileSync(caminho, "utf-8"); } catch { return undefined; } };

/**
 * O que a trava enxerga. `ler` é injetável (disco na trava real, mapa em memória nos autotestes — R3 da #138, B15):
 * imports de helper e de componente são seguidos até o arquivo de origem por ele. Com Program, `checkerDe` devolve o
 * checker para as árvores do Program (o checker só entende os nós dele) e a trava passa a acusar também pelo tipo.
 */
export type Projeto = {
  ler: (caminho: string) => string | undefined;
  rastreador: (caminho: string) => Rastreador | undefined;
  checkerDe: (sf: ts.SourceFile) => ts.TypeChecker | undefined;
  codigos: ReadonlySet<string>;
};

const RAIZ = process.cwd().split("\\").join("/");
function criarProjeto(ler: (caminho: string) => string | undefined, opcoes: { programa?: ts.Program; codigos?: ReadonlySet<string> } = {}): Projeto {
  const { programa } = opcoes;
  const lidos = new Map<string, string | undefined>(), rastreadores = new Map<string, Rastreador | undefined>();
  let checker: ts.TypeChecker | undefined;
  const projeto: Projeto = {
    ler: (c) => { if (!lidos.has(c)) lidos.set(c, ler(c)); return lidos.get(c); },
    codigos: opcoes.codigos ?? VAZIO,
    checkerDe: (sf) => programa && programa.getSourceFile(sf.fileName) === sf ? (checker ??= programa.getTypeChecker()) : undefined,
    rastreador: (c) => {
      if (!rastreadores.has(c)) {
        rastreadores.set(c, undefined); // import circular: sem rastreador enquanto o próprio arquivo é montado
        const doPrograma = programa?.getSourceFile(`${RAIZ}/${c}`);
        const texto = doPrograma ? undefined : projeto.ler(c);
        const sf = doPrograma ?? (texto === undefined ? undefined : arvore(texto, c));
        rastreadores.set(c, sf && rastreadorDeEnum(sf, c, projeto));
      }
      return rastreadores.get(c);
    },
  };
  return projeto;
}
/** Projeto de um arquivo só (os autotestes de sempre): a fonte dada, e o resto do projeto lido do disco. */
const projetoDeUmArquivo = (fonte: string, arquivo: string) => criarProjeto((c) => (c === arquivo ? fonte : lerDoDisco(c)));

/** Caminho do arquivo do projeto que o import aponta ("./X", "../X", "@/X"), se existir. */
function resolverModulo(de: string, origem: string, ler: (caminho: string) => string | undefined): string | null {
  const base = origem.startsWith("@/") ? "src/" + origem.slice(2) : origem.startsWith(".") ? posix.join(posix.dirname(de), origem) : null;
  if (!base) return null;
  return ["", ".tsx", ".ts", "/index.tsx", "/index.ts", ".jsx", ".js"].map((ext) => base + ext).find((c) => /\.(t|j)sx?$/.test(c) && ler(c) !== undefined) ?? null;
}

/**
 * `@prisma/client` em miniatura, gerado do schema: enums como no client real (`$Enums.X` + const + tipo), modelos com
 * escalares e relações, e delegados `prisma.modelo.findMany/findFirst/…` que devolvem o modelo e `count` que devolve
 * número (o total da página não é texto; R2 da #150, B1). O client gerado tem
 * megabytes de tipos condicionais; para saber que `item.status` é `StatusTurma` basta isto. O que não está aqui
 * (`Prisma.TurmaWhereInput`, `groupBy`…) vira erro de tipo = `any`, que a trava não acusa.
 */
export function clientePrismaVirtual(schema: string): string {
  const enums = enumsDoSchema(schema);
  const modelos = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map((m) => ({
    nome: m[1],
    campos: m[2].split("\n").map((l) => /^\s*(\w+)\s+(\w+)(\[\])?(\?)?/.exec(l.replace(/\/\/.*$/, ""))).filter((c): c is RegExpExecArray => !!c),
  }));
  const nomesModelos = new Set(modelos.map((m) => m.nome));
  const ESCALARES: Record<string, string> = { String: "string", Int: "number", Float: "number", BigInt: "bigint", Boolean: "boolean", DateTime: "Date", Decimal: "Prisma.Decimal", Json: "Prisma.JsonValue", Bytes: "Uint8Array" };
  const tipo = (c: RegExpExecArray) => {
    const base = ESCALARES[c[2]] ?? (enums.has(c[2]) ? `$Enums.${c[2]}` : nomesModelos.has(c[2]) ? `$Linha_${c[2]}` : "any");
    return c[3] ? `${base}[]` : c[4] ? `${base} | null` : base;
  };
  const linhas = ["export declare namespace $Enums {"];
  for (const [nome, valores] of enums) linhas.push(`  const ${nome}: { ${valores.map((v) => `readonly ${v}: "${v}"`).join("; ")} };`, `  type ${nome} = (typeof ${nome})[keyof typeof ${nome}];`);
  linhas.push("}");
  for (const nome of enums.keys()) linhas.push(`export declare const ${nome}: typeof $Enums.${nome};`, `export type ${nome} = $Enums.${nome};`);
  for (const m of modelos) {
    linhas.push(`export type ${m.nome} = { ${m.campos.filter((c) => !nomesModelos.has(c[2])).map((c) => `${c[1]}: ${tipo(c)}`).join("; ")} };`);
    linhas.push(`type $Linha_${m.nome} = ${m.nome} & { ${m.campos.filter((c) => nomesModelos.has(c[2])).map((c) => `${c[1]}: ${tipo(c)}`).join("; ")} };`);
  }
  linhas.push(
    "interface $Delegado<M> { findMany(a?: any): Promise<M[]>; findFirst(a?: any): Promise<M | null>; findUnique(a?: any): Promise<M | null>; findFirstOrThrow(a?: any): Promise<M>; findUniqueOrThrow(a?: any): Promise<M>; create(a?: any): Promise<M>; update(a?: any): Promise<M>; upsert(a?: any): Promise<M>; delete(a?: any): Promise<M>; createManyAndReturn(a?: any): Promise<M[]>; updateManyAndReturn(a?: any): Promise<M[]>; count(a?: any): Promise<number>; groupBy(a?: any): Promise<any[]>; aggregate(a?: any): Promise<any>; createMany(a?: any): Promise<{ count: number }>; updateMany(a?: any): Promise<{ count: number }>; deleteMany(a?: any): Promise<{ count: number }>; }",
    "export declare class PrismaClient {",
    "  constructor(opcoes?: any);",
    "  $transaction<T>(operacao: (tx: Prisma.TransactionClient) => Promise<T>, opcoes?: any): Promise<T>;",
    "  $transaction<P extends readonly unknown[]>(lote: [...P], opcoes?: any): Promise<{ -readonly [K in keyof P]: Awaited<P[K]> }>;",
    "  $queryRaw: any; $executeRaw: any; $queryRawUnsafe: any; $executeRawUnsafe: any; $on: any; $extends: any;",
    "  $connect(): Promise<void>; $disconnect(): Promise<void>;",
    ...modelos.map((m) => `  ${m.nome[0].toLowerCase()}${m.nome.slice(1)}: $Delegado<$Linha_${m.nome}>;`),
    "}",
    "export declare namespace Prisma {",
    "  type TransactionClient = PrismaClient; type PrismaPromise<T> = Promise<T>;",
    "  type Decimal = any; const Decimal: any; type TransactionIsolationLevel = any; const TransactionIsolationLevel: any;",
    "  type JsonValue = any; type JsonObject = any; type JsonArray = any; type InputJsonValue = any; type InputJsonObject = any;",
    "  const sql: any; const join: any; const raw: any; const empty: any; const AnyNull: any; const DbNull: any; const JsonNull: any;",
    "  class PrismaClientKnownRequestError extends Error { code: string; meta?: any; }",
    "}",
  );
  return linhas.join("\n");
}
/** `react` em miniatura: só o que carrega tipo de dado (estado, memo, ref); o resto vira `any`. */
const REACT_VIRTUAL = [
  "export type ReactNode = any; export type ReactElement = any; export type FC<P = {}> = (props: P) => any; export type PropsWithChildren<P = {}> = P & { children?: any };",
  "export type Dispatch<A> = (valor: A) => void; export type SetStateAction<S> = S | ((anterior: S) => S);",
  "export declare function useState<S>(inicial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];",
  "export declare function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];",
  "export declare function useMemo<T>(fabrica: () => T, deps: readonly unknown[] | undefined): T;",
  "export declare function useCallback<T extends (...args: any[]) => any>(f: T, deps: readonly unknown[]): T;",
  "export declare function useRef<T>(inicial: T): { current: T };",
  "export declare function useDeferredValue<T>(valor: T): T;",
  "export declare function useTransition(): [boolean, (f: () => void | Promise<void>) => void];",
  "export declare function useEffect(f: () => unknown, deps?: readonly unknown[]): void;",
  "export declare function useId(): string;",
  "export declare const Fragment: any; export declare const Suspense: any; export declare function createElement(...args: any[]): any;",
  "declare const React: any; export default React;",
].join("\n");
const MODULOS_VIRTUAIS: Record<string, string> = { "@prisma/client": "__trava__/prisma-client.d.ts", react: "__trava__/react.d.ts" };
const virtuais = (schema: string): Record<string, string> => ({ [MODULOS_VIRTUAIS["@prisma/client"]]: clientePrismaVirtual(schema), [MODULOS_VIRTUAIS.react]: REACT_VIRTUAL });

const OPCOES: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve, strict: true, allowJs: true,
  noEmit: true, skipLibCheck: true, types: [], lib: ["lib.es2023.d.ts"],
};
/** Árvores das libs do TypeScript, lidas uma vez e reaproveitadas entre Programs (autotestes criam vários). */
const LIBS = new Map<string, ts.SourceFile>();
const extensaoTs = (c: string) => c.endsWith(".d.ts") ? ts.Extension.Dts : c.endsWith(".tsx") ? ts.Extension.Tsx : c.endsWith(".ts") ? ts.Extension.Ts : c.endsWith(".jsx") ? ts.Extension.Jsx : ts.Extension.Js;
/** Program com host próprio: arquivos do projeto por `ler`, módulos virtuais por caminho, libs do pacote typescript. */
function criarPrograma(raizes: string[], ler: (caminho: string) => string | undefined, modulos: Record<string, string>): ts.Program {
  const barra = (f: string) => f.split("\\").join("/");
  const relativo = (f: string) => { const p = barra(f); return p.startsWith(RAIZ + "/") ? p.slice(RAIZ.length + 1) : p; };
  const pastaLibs = posix.dirname(barra(ts.getDefaultLibFilePath(OPCOES)));
  const ehLib = (f: string) => barra(f).startsWith(pastaLibs + "/");
  const conteudo = (f: string): string | undefined => {
    const r = relativo(f);
    if (r in modulos) return modulos[r];
    if (ehLib(f)) return ts.sys.readFile(f);
    return /\.(t|j)sx?$/.test(r) ? ler(r) : undefined;
  };
  const host: ts.CompilerHost = {
    getSourceFile: (f, versao) => {
      if (ehLib(f) && LIBS.has(f)) return LIBS.get(f);
      const texto = conteudo(f);
      if (texto === undefined) return undefined;
      const sf = ts.createSourceFile(f, texto, versao, true);
      if (ehLib(f)) LIBS.set(f, sf);
      return sf;
    },
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    getDefaultLibLocation: () => pastaLibs,
    writeFile: () => {},
    getCurrentDirectory: () => RAIZ,
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (f) => conteudo(f) !== undefined,
    readFile: conteudo,
    resolveModuleNames: (nomes, de) => nomes.map((origem): ts.ResolvedModuleFull | undefined => {
      const alvo = MODULOS_VIRTUAIS[origem] ?? resolverModulo(relativo(de), origem, ler);
      return alvo ? { resolvedFileName: `${RAIZ}/${alvo}`, extension: extensaoTs(alvo), isExternalLibraryImport: false } : undefined;
    }),
  };
  return ts.createProgram({ rootNames: raizes.map((r) => `${RAIZ}/${r}`), options: OPCOES, host });
}

/**
 * O tipo é (ou guarda) código de enum? União de literais de texto com pelo menos um código conhecido — também em
 * lista (`StatusTurma[]`) ou parâmetro de tipo restrito a enum. `any`, `unknown` e `string` não contam.
 */
function tipoDeEnum(checker: ts.TypeChecker, t: ts.Type, codigos: ReadonlySet<string>, fundo = 0): boolean {
  if (fundo > 3 || t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) return false;
  if (t.flags & ts.TypeFlags.TypeParameter) {
    const restricao = checker.getBaseConstraintOfType(t);
    return !!restricao && restricao !== t && tipoDeEnum(checker, restricao, codigos, fundo + 1);
  }
  return (t.isUnion() ? t.types : [t]).some((p) => (p.isStringLiteral() && codigos.has(p.value))
    || ((checker.isArrayType(p) || checker.isTupleType(p)) && checker.getTypeArguments(p as ts.TypeReference).some((a) => tipoDeEnum(checker, a, codigos, fundo + 1))));
}

let projetoDaTravaCache: Projeto | undefined;
/** O projeto da trava real: um Program só, com checker, sobre as telas (e o que elas importam de src/). */
function projetoDaTrava(): Projeto {
  if (projetoDaTravaCache) return projetoDaTravaCache;
  const inicio = performance.now();
  const programa = criarPrograma(fontes.map((f) => f.arquivo), lerDoDisco, virtuais(SCHEMA));
  projetoDaTravaCache = criarProjeto(lerDoDisco, { programa, codigos: codigosConhecidos() });
  console.info(`[enums-rotulos] Program com ${programa.getSourceFiles().length} arquivos em ${Math.round(performance.now() - inicio)} ms`);
  return projetoDaTravaCache;
}

/** Schema mínimo dos autotestes com tipos: campos de enum com nomes que a trava NÃO reconhece pelo nome. */
const SCHEMA_DE_TESTE = [
  "enum MotivoY {\n  SEM_CONTATO\n  RECUSA\n}",
  "enum FaseZ {\n  INICIAL\n  FINAL\n}",
  "model Turma {\n  id   String @id\n  fase FaseZ\n  itens Item[]\n}",
  "model Item {\n  id      String  @id\n  motivo  MotivoY\n  nota    String\n  turmaId String?\n  turma   Turma?  @relation(fields: [turmaId], references: [id])\n}",
].join("\n\n");
/** Projeto em memória para os autotestes (leitor injetado); com `tipos`, Program e checker sobre o schema mínimo. */
export function projetoVirtual(arquivos: Record<string, string>, tipos = false, schema = SCHEMA_DE_TESTE): Projeto {
  const ler = (c: string) => (Object.prototype.hasOwnProperty.call(arquivos, c) ? arquivos[c] : undefined);
  if (!tipos) return criarProjeto(ler);
  const programa = criarPrograma(Object.keys(arquivos), ler, virtuais(schema));
  return criarProjeto(ler, { programa, codigos: new Set([...enumsDoSchema(schema).values()].flat()) });
}

// ---------------------------------------------------------------------------------------------------
// (i) enum cru na tela — por AST e por tipo
// ---------------------------------------------------------------------------------------------------

/** Campos que carregam valor de enum nas telas (status, situação, tipo…). */
const CAMPOS_ENUM = new Set([
  "status", "situacao", "estado", "tipo", "canal", "papel", "finalidade", "habilidade", "participacao",
  "statusMatricula", "matriculaStatus", "encontroStatus", "statusReserva", "statusBeneficio", "statusMeta",
  "alcance", "classificacao", "categoria", "modalidade", "unidade", "etapa", "forma", "temperatura", "segmento", "vigencia",
]);
/** Nomes exatos que também carregam enum (revisão R1 da #138, B1). */
const CAMPOS_ENUM_EXATOS = new Set(["decisao", "ambiente", "destino", "desfecho"]);
/** Bases que nomeiam enum também com complemento (`estadoEnvio`, `ocorrenciaHistoricaTipo`). */
const BASES_COMPOSTAS = ["status", "situacao", "estado", "tipo", "participacao", "desfecho", "finalidade", "classificacao"];
/** Complemento que faz do campo um identificador, data ou texto — não o enum (`statusId`, `estadoEm`, `tipoNome`). */
const COMPLEMENTO_NAO_ENUM = /(Id|Ids|Em|Hash|Nome|Codigo|Texto|Rotulo|Label|Versao|Conferido)$/;
/** Nome de campo de enum: o nome da lista (`status`, `decisao`), a base com complemento
 * (`estadoEnvio`, `participacaoAnterior`) ou o complemento com a base no fim (`ocorrenciaHistoricaTipo`). */
export const nomeDeEnum = (nome: string) => CAMPOS_ENUM.has(nome) || CAMPOS_ENUM_EXATOS.has(nome)
  || (!COMPLEMENTO_NAO_ENUM.test(nome) && BASES_COMPOSTAS.some((b) => (nome.startsWith(b) && /^[A-Z]/.test(nome.slice(b.length)))
    || (nome.length > b.length && nome.endsWith(b[0].toUpperCase() + b.slice(1)))));
/** Atributos HTML que são texto lido pela pessoa (os demais — key, href, name, value… — não são). R3 da #138, B11:
 * `label` (`<option label>`, `<optgroup>`, `<track>`) e os `aria-*` de texto. */
const ATRIBUTOS_TEXTO = new Set(["title", "aria-label", "placeholder", "alt", "aria-description", "label", "aria-valuetext",
  "aria-roledescription", "aria-placeholder", "aria-braillelabel", "aria-brailleroledescription"]);
/** Props que são texto em qualquer componente (mesmo sem declaração à vista). */
const PROPS_TEXTO = new Set(["texto", "titulo", "rotulo", "label", "descricao", "mensagem", "legenda", "children", "title", "aria-label"]);
/** Props de estado/valor: num componente SEM declaração no projeto (pacote, nome com ponto), as demais contam como
 * texto (regra invertida da R3 da #138, B11). Componente do projeto é analisado por dentro. */
const PROPS_DE_ESTADO = new Set(["key", "ref", "href", "value", "defaultValue", "name", "id", "className", "style", "status", "estado",
  "situacao", "tipo", "variante", "variant", "tom", "cor", "tamanho", "size", "modo", "valor", "selecionado", "ativo", "desabilitado",
  "disabled", "checked", "type", "htmlFor", "target", "rel", "src", "as", "prefetch", "scroll", "replace", "role", "tabIndex", "form",
  "method", "action", "required", "min", "max", "step", "pattern", "autoComplete", "width", "height"]);
const propDeTextoSemDeclaracao = (nome: string) => ATRIBUTOS_TEXTO.has(nome) || PROPS_TEXTO.has(nome)
  || (!PROPS_DE_ESTADO.has(nome) && !/^on[A-Z]/.test(nome) && !/^(data|aria)-/.test(nome));

const semEmbrulho = (e: ts.Expression): ts.Expression => {
  let atual = e;
  while (ts.isParenthesizedExpression(atual) || ts.isNonNullExpression(atual) || ts.isAsExpression(atual) || ts.isSatisfiesExpression(atual)) atual = atual.expression;
  return atual;
};
/** Tira embrulhos que não mudam o texto: `String(x)`, `x.toString()`, `` `${x}` `` sozinho. */
const semConversao = (e: ts.Expression): ts.Expression => {
  let x = semEmbrulho(e);
  for (;;) {
    if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && x.expression.text === "String" && x.arguments.length === 1) x = semEmbrulho(x.arguments[0]);
    else if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && x.expression.name.text === "toString" && !x.arguments.length) x = semEmbrulho(x.expression.expression);
    else if (ts.isTemplateExpression(x) && !x.head.text && x.templateSpans.length === 1 && !x.templateSpans[0].literal.text) x = semEmbrulho(x.templateSpans[0].expression);
    else return x;
  }
};
/** Valores de texto das constantes do arquivo (`const SEP = "_"`), por nome — para argumento passado por nome. */
function constantesDeTexto(sf: ts.SourceFile): Map<string, string[]> {
  const m = new Map<string, string[]>();
  visitar(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer) return;
    const i = semEmbrulho(n.initializer);
    if (ts.isStringLiteralLike(i)) m.set(n.name.text, [...(m.get(n.name.text) ?? []), i.text]);
  });
  return m;
}
/** Os textos que a expressão pode ser: literal, ou constante do arquivo com esse nome. */
const textosDe = (e: ts.Expression | undefined, consts: Map<string, string[]>): string[] => {
  if (!e) return [];
  const x = semEmbrulho(e);
  if (ts.isStringLiteralLike(x)) return [x.text];
  return ts.isIdentifier(x) ? consts.get(x.text) ?? [] : [];
};
/** Regex que pega "_" e não pega letra nem dígito (`/_/g`, `/_+/g`, `/[_]/g`, `/[_-]+/g`…). */
const regexDeSublinhado = (literal: string) => {
  const m = /^\/(.*)\/([a-z]*)$/s.exec(literal);
  if (!m) return false;
  try { const re = new RegExp(m[1], m[2].replace(/[gy]/g, "")); return re.test("_") && !re.test("a") && !re.test("A") && !re.test("0"); } catch { return false; }
};
/** Funções que transformam o código em rótulo — o valor que sai delas é texto de gente (com mapa do labels). */
const ROTULADORES = new Set(["rotular"]);
/** Métodos cujo resultado não carrega o texto do receptor (booleano, número, posição). */
const METODOS_SEM_TEXTO = new Set(["includes", "has", "some", "every", "startsWith", "endsWith", "test", "indexOf", "lastIndexOf",
  "findIndex", "findLastIndex", "localeCompare", "getTime"]);
/** Métodos que devolvem um ELEMENTO do receptor (o argumento não chega ao resultado; R3 da #138, B12): `find`, `filter`,
 * `get`, `at`… — `[d.status].find(Boolean)` é o código; `ROTULOS.get(d.status)` é o rótulo. */
const METODOS_DO_RECEPTOR = new Set(["filter", "find", "findLast", "get", "at", "sort", "toSorted", "reverse", "toReversed", "values", "flat"]);
/** Métodos cujo callback recebe o item do receptor (índice do parâmetro do item). */
const METODOS_COM_ITEM: Record<string, number> = { map: 0, flatMap: 0, forEach: 0, filter: 0, find: 0, findLast: 0, some: 0, every: 0, reduce: 1 };
/** Métodos que guardam argumento no receptor (`partes.push(d.status)`): quais argumentos são guardados. */
const METODOS_QUE_GUARDAM: Record<string, (args: readonly ts.Expression[]) => readonly ts.Expression[]> = {
  push: (a) => a, unshift: (a) => a, splice: (a) => a.slice(2), fill: (a) => a.slice(0, 1), set: (a) => a.slice(1, 2), add: (a) => a.slice(0, 1),
};
/** Objetos globais cujas funções recebem o dado pelos ARGUMENTOS (R2 da #150, B2): `Object.values(o)`, `Reflect.get(o, k)`,
 * `JSON.parse(s)`, `Array.from(xs)`… — `get`/`values` aqui não devolvem elemento do receptor, e o resultado (e a
 * propriedade dele) carrega o que entrou. Também por colchete (`Object["values"]`), por `globalThis.X`, por alias do
 * objeto (`const O = Object`) ou do membro (`const ov = Object.values`, `const { fromEntries } = Object`). */
const NAMESPACES_GLOBAIS = new Set(["Object", "Reflect", "JSON", "Array", "Promise", "Map", "Set"]);
/** Raízes pelas quais um objeto global também é alcançado (`globalThis.Reflect.get`). */
const RAIZES_GLOBAIS = new Set(["globalThis", "window", "self"]);
/** Campos de objeto que viram texto lido (`{ value, label }` de opção, `{ titulo, descricao }` de item). */
const CAMPOS_DE_TEXTO = new Set(["label", "rotulo", "texto", "titulo", "descricao", "legenda", "mensagem"]);
/** Teto de argumentos ligados a um parâmetro rest. */
const MAX_ARGUMENTOS_REST = 64;
const OPS_QUE_CARREGAM_TEXTO = new Set([ts.SyntaxKind.PlusToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken]);
/** Tipos que não podem ser o código (texto): número, booleano, bigint, null/undefined/void (R2 da #150, B1). */
const TIPOS_SEM_TEXTO = ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral | ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral
  | ts.TypeFlags.BigInt | ts.TypeFlags.BigIntLiteral | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void;

type Funcao = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;
/** As expressões que uma função devolve (corpo de expressão ou cada `return` do bloco, sem entrar em função aninhada).
 * Vale também para método e `get` de objeto literal (`{ get a() { return d.status; } }`). */
function retornos(fn: ts.FunctionLikeDeclaration): ts.Expression[] {
  if (!fn.body) return [];
  if (!ts.isBlock(fn.body)) return [fn.body];
  const r: ts.Expression[] = [];
  const andar = (n: ts.Node) => {
    if (ts.isReturnStatement(n) && n.expression) r.push(n.expression);
    if (!ts.isFunctionLike(n)) ts.forEachChild(n, andar);
  };
  ts.forEachChild(fn.body, andar);
  return r;
}
/** Nomes que vêm de um módulo de rótulos (`@/lib/labels`, `./labels`): import nomeado, namespace e alias local. */
function nomesDeLabels(sf: ts.SourceFile): Set<string> {
  const nomes = new Set<string>();
  for (const d of sf.statements) {
    if (!ts.isImportDeclaration(d) || !ts.isStringLiteral(d.moduleSpecifier) || !/(^|\/)labels$/.test(d.moduleSpecifier.text)) continue;
    const b = d.importClause?.namedBindings;
    if (b && ts.isNamedImports(b)) for (const e of b.elements) nomes.add(e.name.text);
    if (b && ts.isNamespaceImport(b)) nomes.add(b.name.text);
  }
  for (let mudou = true; mudou;) {
    mudou = false;
    visitar(sf, (n) => {
      if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer || nomes.has(n.name.text)) return;
      const i = semEmbrulho(n.initializer);
      if ((ts.isIdentifier(i) && nomes.has(i.text)) || (ts.isPropertyAccessExpression(i) && ts.isIdentifier(i.expression) && nomes.has(i.expression.text))) { nomes.add(n.name.text); mudou = true; }
    });
  }
  return nomes;
}
/** A chave de desestruturação de um elemento (`{ status: s }` → "status", `{ conteudo }` → "conteudo"). */
const chaveDoElemento = (el: ts.BindingElement): string | null => el.propertyName
  ? (ts.isIdentifier(el.propertyName) || ts.isStringLiteral(el.propertyName) ? el.propertyName.text : null)
  : ts.isIdentifier(el.name) ? el.name.text : null;

export type Rastreador = {
  sf: ts.SourceFile;
  /** O que da expressão chega ao texto como código. `direto` (padrão): campos de enum por nome e por tipo, e os aliases
   * do arquivo, mais `extra`; sem `direto`, só os nomes de `extra` (a prop dentro do componente). */
  crus: (e: ts.Expression, extra?: ReadonlySet<string>, direto?: boolean) => ts.Expression[];
  campoDireto: (x: ts.Expression) => boolean;
  consts: Map<string, string[]>;
  funcoes: Map<string, Funcao>;
  atravessa: (nome: string) => boolean;
  /** Índices dos parâmetros do helper que chegam ao retorno dele. */
  fluem: (nome: string) => ReadonlySet<number>;
  /** As expressões em posição de texto que nascem neste nó: filho de JSX, atributo/prop de texto, `__html`. */
  textosDoNo: (n: ts.Node) => ts.Expression[];
  atributoDeTexto: (a: ts.JsxAttribute) => boolean;
  /** O componente `nome` deste arquivo leva a prop `prop` até o texto? */
  imprimeProp: (nome: string, prop: string) => boolean;
  /** `rotular(M, x)`: true se M é mapa do labels (ou mapa local com chaves), false se não; null se não é rotular. */
  rotularSeguro: (x: ts.CallExpression) => boolean | null;
  /** Constantes do arquivo que são objeto com chaves (mapa local). */
  mapasLocais: ReadonlySet<string>;
  /** O nome, neste arquivo, é mapa de rótulo? Do labels (import ou alias), mapa local com chaves, alias local de um
   * deles, ou importado de outro módulo do projeto onde é um deles (R2 da #150, B1: `export const M = MAPA_DO_LABELS`). */
  mapaPorNome: (nome: string) => boolean;
};

/**
 * Rastreia o código de enum até o texto (revisões R2/R3 da #138): em vez de listar formas, desce por QUALQUER
 * expressão e só para onde o valor deixa de ser o código — `rotular(MAPA do labels, x)`, comparação, condição de
 * ternário/`&&`, método que devolve booleano/número, `MAPA.get(x)`. Concatenação, template, `join`, `trim`, `slice`,
 * `find`/`filter`, `[x][0]`, `await`, helper de identidade (do arquivo ou importado), `.map`/`reduce` — tudo carrega o
 * código adiante. A fonte do código é o campo com nome de enum e, com checker, QUALQUER expressão cujo tipo é união
 * de literais de enum (C13). Aliases: `const`/`let`, atribuição, desestruturação de objeto e de lista, `push` numa
 * lista, propriedade de objeto local, `for…of` e parâmetro de callback sobre lista que guarda o código. Objeto literal
 * guarda os valores dele; `new X(…)` e função de objeto global (`Object.*`, `Reflect.*`, `JSON.*`…, também por alias ou
 * colchete) devolvem o que entrou, e a propriedade do resultado também (R2 da #150, B2). Com checker, número/booleano
 * não é o código (B1).
 */
function rastreadorDeEnum(sf: ts.SourceFile, arquivo: string, projeto: Projeto): Rastreador {
  const consts = constantesDeTexto(sf);
  const enumsImportados = new Set<string>();
  /** Nome importado de outro arquivo do projeto → `caminho#exportado` (helper ou componente analisado na origem). */
  const importados = new Map<string, string>();
  for (const d of sf.statements) {
    if (!ts.isImportDeclaration(d) || !ts.isStringLiteral(d.moduleSpecifier)) continue;
    const c = d.importClause, b = c?.namedBindings, origem = d.moduleSpecifier.text;
    if (origem === "@prisma/client" && b && ts.isNamedImports(b)) for (const e of b.elements) enumsImportados.add(e.name.text);
    const caminho = resolverModulo(arquivo, origem, projeto.ler);
    if (!caminho) continue;
    if (b && ts.isNamedImports(b)) for (const e of b.elements) importados.set(e.name.text, `${caminho}#${(e.propertyName ?? e.name).text}`);
    if (c?.name) importados.set(c.name.text, `${caminho}#default`);
  }
  const deLabels = nomesDeLabels(sf);
  // Objetos globais (R2 da #150, B2): `Object`, `globalThis.Reflect`, alias do objeto (`const O = Object`) e alias de
  // membro (`const ov = Object.values`, `const { fromEntries } = Object`), em ponto fixo.
  const namespacesLocais = new Set<string>(), membrosGlobais = new Set<string>();
  const ehNamespaceGlobal = (e: ts.Expression | undefined): boolean => {
    const x = e && semEmbrulho(e);
    if (!x) return false;
    if (ts.isIdentifier(x)) return NAMESPACES_GLOBAIS.has(x.text) || namespacesLocais.has(x.text);
    return ts.isPropertyAccessExpression(x) && NAMESPACES_GLOBAIS.has(x.name.text) && ts.isIdentifier(x.expression) && RAIZES_GLOBAIS.has(x.expression.text);
  };
  for (let mudou = true; mudou;) {
    mudou = false;
    const novo = (conjunto: Set<string>, nome: string) => { if (!conjunto.has(nome)) { conjunto.add(nome); mudou = true; } };
    visitar(sf, (n) => {
      if (!ts.isVariableDeclaration(n) || !n.initializer) return;
      const i = semEmbrulho(n.initializer);
      if (ts.isIdentifier(n.name)) {
        if (ehNamespaceGlobal(i)) novo(namespacesLocais, n.name.text);
        else if ((ts.isPropertyAccessExpression(i) || ts.isElementAccessExpression(i)) && ehNamespaceGlobal(i.expression)) novo(membrosGlobais, n.name.text);
      } else if (ts.isObjectBindingPattern(n.name) && ehNamespaceGlobal(i)) {
        for (const el of n.name.elements) if (ts.isIdentifier(el.name)) novo(membrosGlobais, el.name.text);
      }
    });
  }
  /** O receptor de uma chamada `R.m(…)`/`R["m"](…)` é objeto global? */
  const receptorGlobal = (alvo: ts.Expression) => (ts.isPropertyAccessExpression(alvo) || ts.isElementAccessExpression(alvo)) && ehNamespaceGlobal(alvo.expression);
  /**
   * Chamada OPACA: o resultado é feito dos argumentos e a trava não tem a declaração para saber quais campos saem —
   * `new X(…)`, função de objeto global (direta, por colchete ou por alias), callee que não é nome nem método
   * (`obj["m"](…)`, `(0, f)(…)`, `f()(…)`). A propriedade do resultado (`Object.fromEntries(…).a`) carrega o que entrou
   * (falha fechada; R2 da #150, B2). Método de receptor do projeto (`lista.find(…)?.nome`) não é opaco.
   */
  const chamadaOpaca = (e: ts.Expression): boolean => {
    let y = semEmbrulho(e);
    if (ts.isAwaitExpression(y)) y = semEmbrulho(y.expression);
    if (ts.isNewExpression(y)) return true;
    if (!ts.isCallExpression(y)) return false;
    const alvo = semEmbrulho(y.expression);
    if (ts.isIdentifier(alvo)) return membrosGlobais.has(alvo.text);
    if (ts.isPropertyAccessExpression(alvo)) return receptorGlobal(alvo);
    return true;
  };
  /** Nomes cujo valor saiu de chamada opaca que recebeu o código (`const o = Object.fromEntries([["a", d.status]])`):
   * a propriedade deles (`o.a`) também é o código. */
  const opacos = new Set<string>();
  /** Mapas locais com chaves (`const M = { … }`, `Object.freeze({ … })`): `rotular(M, x)` com eles devolve rótulo. */
  const mapasLocais = new Set<string>();
  const comoFuncao = (e: ts.Expression | undefined): Funcao | undefined => {
    const x = e && semEmbrulho(e);
    if (!x) return undefined;
    if (ts.isArrowFunction(x) || ts.isFunctionExpression(x)) return x;
    // memo(function X…) / forwardRef((props, ref) => …): o componente é a função de dentro.
    if (ts.isCallExpression(x) && /^(React\.)?(memo|forwardRef)$/.test(x.expression.getText(sf))) return comoFuncao(x.arguments[0]);
    return undefined;
  };
  // Funções do arquivo (declaração, const com arrow/function, memo/forwardRef, export default): o código só atravessa
  // uma delas se ela devolve o parâmetro (ou algo feito dele) sem rotular — `const tipo = (v) => rotular(MAPA, v)` é seguro.
  const funcoes = new Map<string, Funcao>();
  visitar(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.body) {
      if (n.name) funcoes.set(n.name.text, n);
      if (ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) funcoes.set("default", n);
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const f = comoFuncao(n.initializer);
      if (f) funcoes.set(n.name.text, f);
      let i = semEmbrulho(n.initializer);
      if (ts.isCallExpression(i) && i.expression.getText(sf) === "Object.freeze" && i.arguments[0]) i = semEmbrulho(i.arguments[0]);
      if (ts.isObjectLiteralExpression(i) && i.properties.length > 0) mapasLocais.add(n.name.text);
    }
    if (ts.isExportAssignment(n) && !n.isExportEquals) {
      const f = comoFuncao(n.expression) ?? (ts.isIdentifier(n.expression) ? funcoes.get(n.expression.text) : undefined);
      if (f) funcoes.set("default", f);
    }
  });
  const checker = projeto.checkerDe(sf);
  const porTipo = (x: ts.Expression) => !!checker && !ts.isStringLiteralLike(x) && tipoDeEnum(checker, checker.getTypeAtLocation(x), projeto.codigos);
  const campoDireto = (x: ts.Expression) => (ts.isPropertyAccessExpression(x) && nomeDeEnum(x.name.text))
    || (ts.isElementAccessExpression(x) && textosDe(x.argumentExpression, consts).some(nomeDeEnum));
  /** Nome de um alias: `s`, `v.rot`, `props.conteudo`, `d["status"]` → "d.status". */
  const chaveDe = (x: ts.Expression): string | null => {
    if (ts.isIdentifier(x)) return x.text;
    if (ts.isPropertyAccessExpression(x)) { const o = chaveDe(semEmbrulho(x.expression)); return o && `${o}.${x.name.text}`; }
    if (ts.isElementAccessExpression(x)) {
      const o = chaveDe(semEmbrulho(x.expression)), k = textosDe(x.argumentExpression, consts);
      return o && k.length === 1 ? `${o}.${k[0]}` : null;
    }
    return null;
  };
  /** Mapa que rotula de verdade: do labels (import ou alias), objeto com chaves (ali mesmo, constante do arquivo ou de
   * outro módulo do projeto); `{}` e o que não é mapa (`((s) => s) as unknown as Record<…>`) devolvem o código (B12;
   * R1 da #150, B1). */
  const mapaSeguro = (e: ts.Expression | undefined): boolean => {
    const x = e && semEmbrulho(e);
    if (!x) return false;
    if (ts.isObjectLiteralExpression(x)) return x.properties.length > 0;
    if (ts.isIdentifier(x)) return mapaPorNome(x.text);
    return ts.isPropertyAccessExpression(x) && ts.isIdentifier(x.expression) && deLabels.has(x.expression.text);
  };
  /** Alias local de mapa (`const N = M`): N → M. */
  const aliasDeMapa = new Map<string, string>();
  visitar(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer) return;
    const origem = semEmbrulho(n.initializer);
    if (ts.isIdentifier(origem)) aliasDeMapa.set(n.name.text, origem.text);
  });
  // Nomes em análise: import circular (`a` importa M de `b`, que o importa de `a`) não é mapa — falha fechada.
  const emAnalise = new Set<string>();
  const mapaPorNome = (nome: string): boolean => {
    if (deLabels.has(nome) || mapasLocais.has(nome)) return true;
    if (emAnalise.has(nome)) return false;
    emAnalise.add(nome);
    try {
      const alias = aliasDeMapa.get(nome);
      if (alias !== undefined) return mapaPorNome(alias);
      const imp = importados.get(nome);
      if (!imp) return false;
      const i = imp.lastIndexOf("#"), outro = projeto.rastreador(imp.slice(0, i));
      return !!outro && outro.mapaPorNome(imp.slice(i + 1));
    } finally {
      emAnalise.delete(nome);
    }
  };
  const ehRotular = (alvo: ts.Expression) => (ts.isIdentifier(alvo) && ROTULADORES.has(alvo.text))
    || (ts.isPropertyAccessExpression(alvo) && ROTULADORES.has(alvo.name.text) && ts.isIdentifier(alvo.expression) && deLabels.has(alvo.expression.text));
  const rotularSeguro = (x: ts.CallExpression) => ehRotular(semEmbrulho(x.expression)) ? mapaSeguro(x.arguments[0]) : null;

  type Tem = (chave: string, no?: ts.Expression) => boolean;
  const cru = (e: ts.Expression, tem: Tem, direto: boolean): ts.Expression[] => {
    const x = semEmbrulho(e);
    const chave = chaveDe(x);
    // Nome que guarda o código, ou campo de enum — salvo se o checker diz que o valor é número/booleano: o `total`
    // desestruturado junto com a lista da página não é o código (R2 da #150, B1).
    if ((chave !== null && tem(chave, x)) || (direto && campoDireto(x))) return semTexto(x) ? [] : [x];
    const achados = descer(x, tem, direto);
    // Pelo tipo (C13): o que a descida não achou pelo nome, o checker acha pela união de literais de enum.
    return achados.length || !direto || !porTipo(x) ? achados : [x];
  };
  const descer = (x: ts.Expression, tem: Tem, direto: boolean): ts.Expression[] => {
    const c = (y: ts.Expression) => cru(y, tem, direto);
    if (ts.isConditionalExpression(x)) return [...c(x.whenTrue), ...c(x.whenFalse)];
    if (ts.isBinaryExpression(x)) {
      const op = x.operatorToken.kind;
      if (OPS_QUE_CARREGAM_TEXTO.has(op)) return [...c(x.left), ...c(x.right)];
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.CommaToken) return c(x.right);
      return [];
    }
    if (ts.isTemplateExpression(x)) return x.templateSpans.flatMap((s) => c(s.expression));
    if (ts.isTaggedTemplateExpression(x)) return ts.isTemplateExpression(x.template) ? x.template.templateSpans.flatMap((s) => c(s.expression)) : [];
    if (ts.isArrayLiteralExpression(x)) return x.elements.flatMap((el) => c(ts.isSpreadElement(el) ? el.expression : el));
    // await Promise.resolve(d.status) (R3 da #138, B12).
    if (ts.isAwaitExpression(x)) return c(x.expression);
    // [d.status][0], partes[i]: o elemento de uma lista que guarda o código é o código (B12). `MAPA[x]` só é rótulo se
    // MAPA é mapa de rótulo (do labels, alias dele ou local com chaves); qualquer outro `X[código]` — `((s) => s) as
    // unknown as Record<…>` — pode devolver o próprio código (R1 da #150, B1). A chave só conta se o resultado pode ser texto.
    if (ts.isElementAccessExpression(x)) return mapaSeguro(x.expression) ? [] : [...c(x.expression), ...(podeSerTexto(x) ? c(x.argumentExpression) : [])];
    if (ts.isCallExpression(x)) return chamada(x, tem, direto);
    // Objeto literal guarda os valores dele (método e `get` pelo que devolvem): `Reflect.get({ a: d.status }, "a")`,
    // `const o = { a: d.status }; Object.values(o)` (R2 da #150, B2).
    if (ts.isObjectLiteralExpression(x)) return valoresDoObjeto(x, c);
    // new X(…): falha fechada, os argumentos chegam ao objeto criado (`new Map([["a", d.status]]).get("a")`).
    if (ts.isNewExpression(x)) return argumentosDe(x.arguments ?? [], c);
    // Propriedade do resultado de chamada opaca (`Object.fromEntries([["a", d.status]]).a`) ou de nome que guarda esse
    // resultado (`const o = Object.assign({}, { a: d.status }); o.a`) — R2 da #150, B2.
    if (ts.isPropertyAccessExpression(x)) {
      const base = semEmbrulho(x.expression);
      return (chamadaOpaca(base) || (ts.isIdentifier(base) && opacos.has(base.text))) && podeSerTexto(x) ? c(base) : [];
    }
    return [];
  };
  /** Argumentos que chegam ao resultado; o que é função (callback de reduce, useMemo…) entra pelo que ela devolve (B12). */
  const argumentosDe = (args: readonly ts.Expression[], c: (y: ts.Expression) => ts.Expression[]): ts.Expression[] => args.flatMap((a) => {
    const f = semEmbrulho(ts.isSpreadElement(a) ? a.expression : a);
    return ts.isArrowFunction(f) || ts.isFunctionExpression(f) ? retornos(f).flatMap(c) : c(f);
  });
  const chamada = (x: ts.CallExpression, tem: Tem, direto: boolean): ts.Expression[] => {
    const c = (y: ts.Expression) => cru(y, tem, direto);
    const argumentos = () => argumentosDe(x.arguments, c);
    const alvo = semEmbrulho(x.expression);
    // (() => d.status)(): a função chamada na hora devolve o que o corpo devolve (R1 da #150, B1).
    if (ts.isArrowFunction(alvo) || ts.isFunctionExpression(alvo)) return [...retornos(alvo).flatMap(c), ...argumentos()];
    // Função de objeto global — Object.values/entries/fromEntries, Reflect.get, JSON.parse…, também por colchete ou
    // `globalThis.X` — devolve o que entrou pelos argumentos; `get`/`values` aqui não são do receptor (R1 da #150, B1;
    // R2, B2). Alias do membro (`const ov = Object.values`) cai na falha fechada do fim (função sem declaração).
    if (receptorGlobal(alvo)) return argumentos();
    // rotular(M, x) só rotula com mapa do labels (ou local com chaves); com `{}` devolve o próprio código (B12).
    const seguro = rotularSeguro(x);
    if (seguro !== null) return seguro ? [] : x.arguments.slice(1).flatMap(c);
    // useMemo(() => valor, deps) devolve o valor (as dependências não chegam ao resultado); useCallback/useEffect, nada.
    const gancho = ts.isIdentifier(alvo) ? alvo.text : ts.isPropertyAccessExpression(alvo) ? alvo.name.text : "";
    if (gancho === "useMemo") { const [f] = x.arguments; return f && (ts.isArrowFunction(f) || ts.isFunctionExpression(f)) ? retornos(f).flatMap(c) : []; }
    if (["useCallback", "useEffect", "useLayoutEffect"].includes(gancho)) return [];
    if (ts.isPropertyAccessExpression(alvo)) {
      const metodo = alvo.name.text, [fn] = x.arguments;
      if (METODOS_SEM_TEXTO.has(metodo)) return [];
      if (["map", "flatMap"].includes(metodo) && fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return retornos(fn).flatMap(c);
      // reduce: o resultado sai do callback e do valor inicial, não da lista.
      if (metodo === "reduce" || metodo === "reduceRight") return argumentos();
      if (METODOS_DO_RECEPTOR.has(metodo)) return c(alvo.expression);
      return [...c(alvo.expression), ...argumentos()];
    }
    // Função local que rotula não deixa passar; a que devolve o parâmetro deixa. Importada do projeto: analisada na
    // origem (R3 da #138, B15/G5); de fora do projeto: falha fechada, o código atravessa pelos argumentos.
    const soOsQueFluem = (passam: ReadonlySet<number>) => argumentosQueFluem(x, passam).flatMap((a) => {
      const f = semEmbrulho(ts.isSpreadElement(a) ? a.expression : a);
      if (ts.isArrowFunction(f) || ts.isFunctionExpression(f)) return retornos(f).flatMap(c);
      // Objeto passado a parâmetro desestruturado: os valores dele entram no helper (R1 da #150, B3).
      return ts.isObjectLiteralExpression(f) ? valoresDoObjeto(f, c) : c(f);
    });
    if (ts.isIdentifier(alvo) && funcoes.has(alvo.text)) return soOsQueFluem(fluem(alvo.text));
    if (ts.isIdentifier(alvo) && importados.has(alvo.text)) {
      const imp = importados.get(alvo.text)!, i = imp.lastIndexOf("#");
      const outro = projeto.rastreador(imp.slice(0, i)), nome = imp.slice(i + 1);
      if (outro && outro.funcoes.has(nome)) return soOsQueFluem(outro.fluem(nome));
    }
    return argumentos();
  };
  // Por PARÂMETRO (integração da #150): só o argumento cujo parâmetro chega ao retorno atravessa o helper —
  // `detalheEvento(ev.tipo, p)` devolve texto de `p`; `ev.tipo` só é comparado e não chega ao texto. Parâmetro
  // desestruturado (sem nome único) conta como passando (falha fechada).
  const fluemCache = new Map<string, ReadonlySet<number>>();
  const fluem = (nome: string): ReadonlySet<number> => {
    if (fluemCache.has(nome)) return fluemCache.get(nome)!;
    const fn = funcoes.get(nome)!;
    const todos = new Set(fn.parameters.map((_, i) => i));
    fluemCache.set(nome, todos); // recursão: falha fechada
    // O parâmetro flui se algum achado no retorno é ELE (pela raiz: `p`, `p.x`, `p.trim()`) — não basta o retorno ter
    // outro código (um parâmetro irmão tipado como enum não faz este fluir).
    const raiz = (x: ts.Expression): string | null => {
      const y = semEmbrulho(x);
      if (ts.isIdentifier(y)) return y.text;
      if (ts.isPropertyAccessExpression(y) || ts.isElementAccessExpression(y)) return raiz(y.expression);
      if (ts.isCallExpression(y) && ts.isPropertyAccessExpression(y.expression)) return raiz(y.expression.expression);
      return null;
    };
    const r = new Set(fn.parameters.flatMap((p, i) => {
      if (!ts.isIdentifier(p.name)) return [i];
      const nomeP = p.name.text;
      // Alias dentro do helper (`const v = s; return v;`) também leva o parâmetro ao retorno (R1 da #150, B1).
      const locais = fn.body && ts.isBlock(fn.body) ? fecharAliases(fn.body, new Set([nomeP]), false) : new Set([nomeP]);
      return retornos(fn).some((e) => crus(e, new Set([nomeP])).some((a) => raiz(a) === nomeP) || crus(e, locais, false).length > 0) ? [i] : [];
    }));
    // Parâmetro rest (`...xs`) que flui: todo argumento dali em diante flui (R1 da #150, B1).
    fn.parameters.forEach((p, i) => { if (p.dotDotDotToken && r.has(i)) for (let j = i; j < i + MAX_ARGUMENTOS_REST; j++) r.add(j); });
    fluemCache.set(nome, r);
    return r;
  };
  const atravessa = (nome: string): boolean => fluem(nome).size > 0;
  /** Os valores de um objeto literal (propriedade, abreviada, spread); outra expressão, ela mesma. */
  const valoresDoObjeto = (a: ts.Expression, c: (y: ts.Expression) => ts.Expression[]): ts.Expression[] => {
    const o = semEmbrulho(ts.isSpreadElement(a) ? a.expression : a);
    if (!ts.isObjectLiteralExpression(o)) return c(o);
    return o.properties.flatMap((p) => ts.isPropertyAssignment(p) ? c(p.initializer) : ts.isShorthandPropertyAssignment(p) ? c(p.name)
      : ts.isSpreadAssignment(p) ? c(p.expression) : ts.isMethodDeclaration(p) || ts.isGetAccessorDeclaration(p) ? retornos(p).flatMap(c) : []);
  };
  /** Com checker, o valor é só número/booleano/bigint/null/undefined? Então não é o código (R2 da #150, B1). */
  const semTexto = (x: ts.Expression) => {
    if (!checker) return false;
    const t = checker.getTypeAtLocation(x);
    return (t.isUnion() ? t.types : [t]).every((p) => !!(p.flags & TIPOS_SEM_TEXTO));
  };
  /** O resultado pode ser texto? Com checker, número/booleano/objeto não carregam a chave (`contagem[status]`). */
  const podeSerTexto = (x: ts.Expression) => {
    if (!checker) return true;
    const t = checker.getTypeAtLocation(x);
    return (t.isUnion() ? t.types : [t]).some((p) => !!(p.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter)));
  };
  /** Argumentos da chamada a um helper que chegam ao retorno dele (o resto só decide, não vira texto). */
  const argumentosQueFluem = (x: ts.CallExpression, passam: ReadonlySet<number>) => x.arguments.filter((a, i) => passam.has(i) || ts.isSpreadElement(a));
  /** Ponto fixo dos nomes que guardam o código sob `raiz`, a partir de `iniciais`. */
  /** Declarações de cada nome marcado por fecharAliases (por conjunto devolvido) — com checker, um identificador
   * só é alias se o símbolo dele vem de uma delas (integração da #150: o `motivo` de texto livre não herda a marca
   * do estado `[motivo] = useState<MotivoPerda>` do mesmo arquivo). Nome marcado sem declaração vale pelo nome. */
  const declaracoesDe = new WeakMap<ReadonlySet<string>, { porDecl: Map<string, Set<ts.Node>>; soPorNome: Set<string> }>();
  /** O tipo é união só de literais de texto, nenhum código de enum? (posição de tupla que guarda rótulo, não código) */
  const tipoSemCodigo = (no: ts.Node) => {
    if (!checker) return false;
    const tp = checker.getTypeAtLocation(no);
    const partes = tp.isUnion() ? tp.types : [tp];
    return partes.length > 0 && partes.every((p) => p.isStringLiteral() && !projeto.codigos.has(p.value));
  };
  const declsDoSimbolo = (no: ts.Node): readonly ts.Node[] => (checker && checker.getSymbolAtLocation(no)?.declarations) || [];
  const confere = (conjunto: ReadonlySet<string>, k: string, no?: ts.Expression) => {
    if (!checker || !no || !ts.isIdentifier(no)) return true;
    const info = declaracoesDe.get(conjunto);
    if (!info || info.soPorNome.has(k)) return true;
    const decls = info.porDecl.get(k);
    if (!decls) return true;
    const doNo = declsDoSimbolo(no);
    return !doNo.length || doNo.some((d) => decls.has(d));
  };
  const fecharAliases = (raiz: ts.Node, iniciais: ReadonlySet<string>, direto: boolean): Set<string> => {
    const nomes = new Set(iniciais);
    const porDecl = new Map<string, Set<ts.Node>>(), soPorNome = new Set<string>(iniciais);
    declaracoesDe.set(nomes, { porDecl, soPorNome });
    const tem = (k: string, no?: ts.Expression) => nomes.has(k) && confere(nomes, k, no);
    const guarda = (e: ts.Expression) => cru(e, tem, direto).length > 0;
    for (let mudou = true; mudou;) {
      mudou = false;
      const marcar = (nome: string | null, decl?: ts.Node | readonly ts.Node[]) => {
        if (!nome) return;
        const ds = decl === undefined ? [] : Array.isArray(decl) ? decl : [decl as ts.Node];
        if (!ds.length || !checker) { if (!soPorNome.has(nome)) { soPorNome.add(nome); mudou = true; } }
        else for (const d of ds) { const conj = porDecl.get(nome) ?? new Set<ts.Node>(); if (!conj.has(d)) { conj.add(d); porDecl.set(nome, conj); mudou = true; } }
        if (!nomes.has(nome)) { nomes.add(nome); mudou = true; }
      };
      /** Marca os nomes do padrão; `decl` é a declaração do nome simples. Em lista/tupla, a posição cujo tipo é só
       * rótulo (literais sem código) não guarda o código: `[valor, rotulo]` de `[["FALTA", "Falta"]]` marca só `valor`. */
      const marcarPadrao = (p: ts.BindingName, decl?: ts.Node) => {
        if (ts.isIdentifier(p)) marcar(p.text, decl ?? p.parent);
        else for (const el of p.elements) {
          if (ts.isOmittedExpression(el)) continue;
          if (ts.isArrayBindingPattern(p) && ts.isIdentifier(el.name) && tipoSemCodigo(el.name)) continue;
          marcarPadrao(el.name, el);
        }
      };
      visitar(raiz, (n) => {
        if (ts.isVariableDeclaration(n) && n.initializer) {
          const init = semEmbrulho(n.initializer);
          if (ts.isIdentifier(n.name) && guarda(n.initializer)) {
            marcar(n.name.text, n);
            // Resultado de chamada opaca: a propriedade dele também é o código (R2 da #150, B2).
            if (chamadaOpaca(n.initializer) && !opacos.has(n.name.text)) { opacos.add(n.name.text); mudou = true; }
          }
          // const [s] = [d.status] (R3 da #138, B12).
          if (ts.isArrayBindingPattern(n.name) && guarda(n.initializer)) marcarPadrao(n.name);
          // const v = { rot: d.status }: a propriedade do objeto local guarda o código (B12).
          if (ts.isIdentifier(n.name) && ts.isObjectLiteralExpression(init)) for (const p of init.properties) {
            if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && guarda(p.initializer)) marcar(`${n.name.text}.${p.name.text}`);
            if (ts.isShorthandPropertyAssignment(p) && guarda(p.name)) marcar(`${n.name.text}.${p.name.text}`);
          }
          // const { rot } = v, quando v.rot guarda o código.
          const base = chaveDe(init);
          if (ts.isObjectBindingPattern(n.name) && base) for (const el of n.name.elements) {
            const k = chaveDoElemento(el);
            if (k && nomes.has(`${base}.${k}`)) marcarPadrao(el.name);
          }
        }
        if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && guarda(n.right)) {
          const alvo = semEmbrulho(n.left);
          const destino = ts.isElementAccessExpression(alvo) ? semEmbrulho(alvo.expression) : alvo;
          marcar(chaveDe(destino), ts.isIdentifier(destino) ? declsDoSimbolo(destino) : undefined); // partes[i] = …; s = …; v.rot = …
          if (alvo === destino && ts.isIdentifier(destino) && chamadaOpaca(n.right) && !opacos.has(destino.text)) { opacos.add(destino.text); mudou = true; }
        }
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
          const metodo = n.expression.name.text, receptor = semEmbrulho(n.expression.expression);
          // partes.push(d.status): a lista passa a guardar o código (B12).
          if (Object.prototype.hasOwnProperty.call(METODOS_QUE_GUARDAM, metodo) && METODOS_QUE_GUARDAM[metodo](n.arguments).some(guarda)) marcar(chaveDe(receptor), ts.isIdentifier(receptor) ? declsDoSimbolo(receptor) : undefined);
          // xs.map((s) => …) sobre lista que guarda o código; Object.values(StatusTurma).map((v) => <option>{v}</option>).
          if (Object.prototype.hasOwnProperty.call(METODOS_COM_ITEM, metodo)) {
            const [fn] = n.arguments, indice = METODOS_COM_ITEM[metodo];
            const deEnum = direto && ts.isCallExpression(receptor) && /^Object\.(values|keys)$/.test(receptor.expression.getText(sf)) && !!receptor.arguments[0]
              && ts.isIdentifier(receptor.arguments[0]) && enumsImportados.has(receptor.arguments[0].text);
            if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && fn.parameters[indice] && (deEnum || guarda(receptor))) marcarPadrao(fn.parameters[indice].name);
          }
        }
        // for (const s of lista), quando a lista guarda o código.
        if (ts.isForOfStatement(n) && ts.isVariableDeclarationList(n.initializer) && guarda(n.expression)) for (const d of n.initializer.declarations) marcarPadrao(d.name);
        // const { situacao } = d / function B({ estado }): desestruturação de campo com nome de enum.
        if (direto && ts.isBindingElement(n) && ts.isIdentifier(n.name) && !n.dotDotDotToken && ts.isObjectBindingPattern(n.parent)) {
          const chave = chaveDoElemento(n);
          if (chave && nomeDeEnum(chave)) marcar(n.name.text, n);
        }
      });
    }
    return nomes;
  };
  let doArquivo: Set<string> | undefined;
  const aliases = () => {
    if (!doArquivo) { doArquivo = new Set(); doArquivo = fecharAliases(sf, VAZIO, true); }
    return doArquivo;
  };
  const crus = (e: ts.Expression, extra: ReadonlySet<string> = VAZIO, direto = true) => {
    if (!direto) return cru(e, (k) => extra.has(k), false);
    const a = aliases();
    return cru(e, (k, no) => (a.has(k) && confere(a, k, no)) || extra.has(k), true);
  };

  /** O componente da tag: função deste arquivo ou importada do projeto. Sem declaração (pacote, `X.Y`): null. */
  const componente = (tag: string): { r: Rastreador; nome: string } | null => {
    if (!/^[A-Za-z_$][\w$]*$/.test(tag)) return null;
    if (funcoes.has(tag)) return { r: eu, nome: tag };
    const imp = importados.get(tag);
    if (!imp) return null;
    const i = imp.lastIndexOf("#"), outro = projeto.rastreador(imp.slice(0, i)), nome = imp.slice(i + 1);
    return outro && outro.funcoes.has(nome) ? { r: outro, nome } : null;
  };
  /** O atributo `nome` de `tag` é texto lido? HTML: atributo de texto. Componente do projeto: ele leva a prop ao texto
   * (seguida por dentro dele). Componente sem declaração: toda prop, menos as de estado (R3 da #138, B11). */
  const textoEm = (tag: string, nome: string): boolean => {
    if (nome === "children") return true;
    if (nome === "key" || nome === "ref") return false;
    if (/^[a-z]/.test(tag) && !tag.includes(".")) return ATRIBUTOS_TEXTO.has(nome);
    const comp = componente(tag);
    return comp ? comp.r.imprimeProp(comp.nome, nome) : propDeTextoSemDeclaracao(nome);
  };
  const atributoDeTexto = (a: ts.JsxAttribute) => textoEm(a.parent.parent.tagName.getText(sf), a.name.getText(sf));
  const textosDoNo = (n: ts.Node): ts.Expression[] => {
    // { label: código } / { rotulo }: campo de texto de objeto (opção de <select>, item de lista) recebe o código —
    // também `label: value as string`, pelo tipo de antes do cast (R1 da #150, B1/B5).
    if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && CAMPOS_DE_TEXTO.has(n.name.text)) return [n.initializer];
    if (ts.isShorthandPropertyAssignment(n) && CAMPOS_DE_TEXTO.has(n.name.text)) return [n.name];
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) return [n.expression];
    if (!ts.isJsxAttribute(n) || !n.initializer || !ts.isJsxExpression(n.initializer) || !n.initializer.expression) return [];
    const valor = semEmbrulho(n.initializer.expression);
    // dangerouslySetInnerHTML={{ __html: d.status }}: o HTML é texto lido (B11).
    if (n.name.getText(sf) === "dangerouslySetInnerHTML") {
      return ts.isObjectLiteralExpression(valor) ? valor.properties.flatMap((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === "__html" ? [p.initializer] : []) : [valor];
    }
    return atributoDeTexto(n) ? [n.initializer.expression] : [];
  };
  const imprime = new Map<string, boolean>();
  const imprimeProp = (nome: string, prop: string): boolean => {
    const chave = `${nome}#${prop}`;
    if (imprime.has(chave)) return imprime.get(chave)!;
    imprime.set(chave, true); // recursão entre componentes: falha fechada
    const r = analisarProp(funcoes.get(nome), prop);
    imprime.set(chave, r);
    return r;
  };
  /** A prop chega ao texto dentro do componente? Desestruturada (`{ conteudo }`), por `props.conteudo`, por
   * `{...resto}`/`{...props}` repassado a outro elemento, ou por outro componente que a imprime. */
  const analisarProp = (fn: Funcao | undefined, prop: string): boolean => {
    if (!fn) return propDeTextoSemDeclaracao(prop);
    const [p0] = fn.parameters;
    if (!p0) return false;
    const sementes = new Set<string>(), objetos = new Set<string>();
    if (ts.isIdentifier(p0.name)) { sementes.add(`${p0.name.text}.${prop}`); objetos.add(p0.name.text); }
    else if (ts.isObjectBindingPattern(p0.name)) {
      const el = p0.name.elements.find((e) => !e.dotDotDotToken && chaveDoElemento(e) === prop);
      const resto = p0.name.elements.find((e) => !!e.dotDotDotToken);
      if (el) { if (!ts.isIdentifier(el.name)) return true; sementes.add(el.name.text); }
      else if (resto && ts.isIdentifier(resto.name)) { sementes.add(`${resto.name.text}.${prop}`); objetos.add(resto.name.text); }
      else return false;
    } else return true;
    if (!fn.body) return true;
    const nomes = fecharAliases(fn.body, sementes, false);
    let sim = false;
    visitar(fn.body, (n) => {
      if (sim) return;
      for (const e of textosDoNo(n)) if (crus(e, nomes, false).length) sim = true;
      if (ts.isJsxSpreadAttribute(n)) {
        const k = chaveDe(semEmbrulho(n.expression));
        if (k && objetos.has(k)) sim = textoEm(n.parent.parent.tagName.getText(sf), prop);
      }
    });
    return sim;
  };
  const eu: Rastreador = { sf, crus, campoDireto, consts, funcoes, atravessa, fluem, textosDoNo, atributoDeTexto, imprimeProp, rotularSeguro, mapasLocais, mapaPorNome };
  return eu;
}

export type EnumCru = { tipo: "sublinhado" | "caixa" | "texto"; trecho: string; linha: number };

/** Enum cru que um arquivo do projeto imprime ou transforma em "rótulo". */
export function enumsCrusDoProjeto(projeto: Projeto, arquivo: string): EnumCru[] {
  const r = projeto.rastreador(arquivo);
  if (!r) return [];
  const { sf, crus, campoDireto, consts } = r;
  const achados: EnumCru[] = [];
  const achar = (tipo: EnumCru["tipo"], no: ts.Node) => achados.push({ tipo, trecho: no.getText(sf).replace(/\s+/g, " ").slice(0, 90), linha: linhaDe(sf, no) });
  visitar(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = n.expression.name.text, [a, b] = n.arguments;
      // x.replaceAll("_", " "), x.replace(/_+/g, " "), x.replace(SEP, ESP), x.split("_") (código partido no "_")
      const sublinhado = (arg?: ts.Expression) => !!arg && (textosDe(arg, consts).includes("_") || (ts.isRegularExpressionLiteral(semEmbrulho(arg)) && regexDeSublinhado(semEmbrulho(arg).getText(sf))));
      const branco = (arg?: ts.Expression) => textosDe(arg, consts).some((t) => /^\s+$/.test(t));
      if ((metodo === "replaceAll" || metodo === "replace") && sublinhado(a) && branco(b)) achar("sublinhado", n);
      if (metodo === "split" && sublinhado(a)) achar("sublinhado", n);
      // x.status.toLowerCase(): o código em minúscula não é rótulo ("a agenda está cancelado")
      if (/^to(Locale)?(Lower|Upper)Case$/.test(metodo) && campoDireto(semConversao(n.expression.expression))) achar("caixa", n);
    }
    // Posições de texto: filho de JSX, atributo de texto, prop que o componente imprime, __html.
    for (const e of r.textosDoNo(n)) for (const campo of crus(e)) achar("texto", campo);
  });
  return achados;
}
/** Enum cru numa fonte avulsa (o resto do projeto vem do disco). */
export const enumsCrus = (fonte: string, arquivo = "x.tsx"): EnumCru[] => enumsCrusDoProjeto(projetoDeUmArquivo(fonte, arquivo), arquivo);

/**
 * Código de enum escrito como TEXTO na tela (revisão R2/R3 da #138, B10): `"PAGAMENTO_COMPROVADO"` no lugar de
 * "Pagamento comprovado". Procura, nas posições de texto (filho de JSX, texto solto do JSX, atributo e prop
 * de texto), literais que chegam ao texto — ramos de ternário, `??`/`||`/`+`, `&&` à direita, partes de
 * template, itens de lista, argumentos de função que não rotula — e acusa cada palavra com cara de código
 * (MAIÚSCULAS com "_"). Com `codigos`, só os códigos dessa lista; sem ela (`null`), qualquer código — também
 * os de domínio que não estão no schema (`PAGAMENTO_COMPROVADO` é situação da conciliação de migração).
 */
export function codigosEmTextoDoProjeto(projeto: Projeto, arquivo: string, codigos: ReadonlySet<string> | null): { codigo: string; linha: number }[] {
  const r = projeto.rastreador(arquivo);
  if (!r) return [];
  const sf = r.sf;
  const achados: { codigo: string; linha: number }[] = [];
  const palavras = (texto: string, no: ts.Node) => {
    for (const p of texto.match(/[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+/g) ?? []) if (!codigos || codigos.has(p)) achados.push({ codigo: p, linha: linhaDe(sf, no) });
  };
  const literais = (e: ts.Expression) => {
    const x = semEmbrulho(e);
    if (ts.isStringLiteralLike(x)) return palavras(x.text, x);
    if (ts.isTemplateExpression(x)) { palavras(x.head.text, x); for (const s of x.templateSpans) { literais(s.expression); palavras(s.literal.text, s); } return; }
    if (ts.isConditionalExpression(x)) { literais(x.whenTrue); literais(x.whenFalse); return; }
    if (ts.isBinaryExpression(x)) {
      const op = x.operatorToken.kind;
      if (OPS_QUE_CARREGAM_TEXTO.has(op)) { literais(x.left); literais(x.right); }
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) literais(x.right);
      return;
    }
    if (ts.isArrayLiteralExpression(x)) { for (const el of x.elements) literais(ts.isSpreadElement(el) ? el.expression : el); return; }
    if (ts.isCallExpression(x)) {
      const seguro = r.rotularSeguro(x);
      if (seguro) return;
      for (const a of seguro === false ? x.arguments.slice(1) : x.arguments) literais(a);
    }
  };
  visitar(sf, (n) => {
    if (ts.isJsxText(n)) palavras(n.text, n);
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && r.atributoDeTexto(n)) palavras(n.initializer.text, n);
    for (const e of r.textosDoNo(n)) literais(e);
  });
  return achados;
}
export const codigosEmTexto = (fonte: string, codigos: ReadonlySet<string> | null, arquivo = "x.tsx") =>
  codigosEmTextoDoProjeto(projetoDeUmArquivo(fonte, arquivo), arquivo, codigos);

/** Código que a tela mostra de propósito (não é enum a rotular). Cada um casa com exatamente um achado. */
const CODIGOS_EM_TEXTO: { arquivo: string; codigo: string; motivo: string }[] = [
  { arquivo: "src/app/(app)/configuracao/whatsapp/ComercialPainel.tsx", codigo: "ANTHROPIC_API_KEY", motivo: "nome da variável de ambiente que a Administração precisa configurar" },
];

/** Campos com nome de enum que já chegam como texto (o servidor rotulou) ou não são enum. Cada um casa com
 * exatamente `vezes` achados (1, se omitido). */
const TEXTO_JA_ROTULADO: { arquivo: string; trecho: string; motivo: string; vezes?: number }[] = [
  { arquivo: "src/app/(app)/academico/recuperacoes/page.tsx", trecho: "item.estado", motivo: "o servidor já devolve o texto (\"Sem nota\", \"Oficializada\"…), server/avaliacoes/recuperacao-consulta.ts" },
  { arquivo: "src/app/(app)/financeiro/acertos-taxa/[matriculaId]/[propostaId]/page.tsx", trecho: "c.tipo", motivo: "tipo de comissão já rotulado no servidor (\"Fixa\"/\"Percentual\"), server/contratos/aditivo-acerto-taxa-consulta.ts" },
  { arquivo: "src/app/(app)/secretaria/CondicoesEncerramento.tsx", trecho: "acerto.alcance", motivo: "frase montada por descreverAcerto (\"todas as cobranças da matrícula\"…)" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/TemplatesPainel.tsx", trecho: "t.categoria", motivo: "categoria do template na Meta (utility/marketing), texto livre e não enum do schema" },
  { arquivo: "src/app/(app)/diario/regularizacoes-gravacao/RegularizacoesGravacao.tsx", trecho: "p.destino", motivo: "frase montada pela página (\"Aula T-01 — …\" / \"Reposição M-1 — Ana\"), regularizacoes-gravacao/page.tsx" },
  { arquivo: "src/app/(app)/alunos/[id]/creditos/[creditoId]/DevolucaoCredito.tsx", trecho: "p.destino", motivo: "destino da devolução digitado pela pessoa (texto livre), server/financeiro/devolucao-credito.ts" },
  { arquivo: "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/CorrecoesConclusaoReposicao.tsx", trecho: "impacto.destino", vezes: 2, motivo: "código ou nome da turma de destino, resolvido no servidor (diario/correcao-reposicao-consulta.ts)" },
  // R3 da #138 (B11): a prop statusOrigem chega ao texto em StatusFormulario — no próprio arquivo e em quem o chama.
  { arquivo: "src/app/(app)/configuracao/migracao/[loteId]/EnsaioVinculoMigracao.tsx", trecho: "statusOrigem", vezes: 2, motivo: "situação no sistema de origem, texto do legado preservado (CorrespondenciaStatusMatriculaMigracao.statusOrigem é String); impressa na legenda de StatusFormulario" },
  { arquivo: "src/app/(app)/configuracao/migracao/[loteId]/page.tsx", trecho: "linha.origemVinculo?.statusOrigem", motivo: "o mesmo texto do legado (String no schema), repassado a EnsaioVinculoMigracao, que o imprime" },
];

describe("(i) enum cru na tela — AST e tipos", () => {
  const projeto = projetoDaTrava();
  const inicio = performance.now();
  const achados = fontes.flatMap(({ arquivo }) => enumsCrusDoProjeto(projeto, arquivo).map((a) => ({ arquivo, ...a })));
  const escritos = fontes.flatMap(({ arquivo }) => codigosEmTextoDoProjeto(projeto, arquivo, null).map((a) => ({ arquivo, ...a })));
  console.info(`[enums-rotulos] varredura das telas (nome + tipo) em ${Math.round(performance.now() - inicio)} ms`);

  it("nenhuma tela monta rótulo trocando \"_\" por espaço nem muda a caixa do código", () => {
    expect(achados.filter((a) => a.tipo !== "texto").map((a) => `${a.arquivo}:${a.linha} ${a.trecho}`)).toEqual([]);
  });

  it("nenhuma tela imprime enum direto no texto (rotular(MAPA, valor) ou MAPA[valor]) — por nome do campo ou por tipo", () => {
    const sobra = achados.filter((a) => a.tipo === "texto" && !TEXTO_JA_ROTULADO.some((e) => e.arquivo === a.arquivo && e.trecho === a.trecho));
    expect(sobra.map((a) => `${a.arquivo}:${a.linha} ${a.trecho}`)).toEqual([]);
  });

  it("cada exceção casa com exatamente os seus achados (exceção sem caso sai da lista)", () => {
    for (const e of TEXTO_JA_ROTULADO) {
      expect(achados.filter((a) => a.tipo === "texto" && a.arquivo === e.arquivo && a.trecho === e.trecho), `${e.arquivo} ${e.trecho}`).toHaveLength(e.vezes ?? 1);
    }
  });

  it("nenhuma tela escreve código de enum como texto (\"PAGAMENTO_COMPROVADO\" no lugar do rótulo)", () => {
    // Qualquer palavra com cara de código (MAIÚSCULAS com "_"), do schema ou de domínio, salvo as exceções.
    expect(escritos.filter((a) => !CODIGOS_EM_TEXTO.some((e) => e.arquivo === a.arquivo && e.codigo === a.codigo)).map((a) => `${a.arquivo}:${a.linha} ${a.codigo}`)).toEqual([]);
    for (const e of CODIGOS_EM_TEXTO) expect(escritos.filter((a) => a.arquivo === e.arquivo && a.codigo === e.codigo), `${e.arquivo} ${e.codigo}`).toHaveLength(1);
  });

  it("autoteste (R3 da #138, B10): código de enum em texto solto, literal, template, ternário e atributo", () => {
    const codigos = new Set(["PAGAMENTO_COMPROVADO", "EM_ANDAMENTO"]);
    const achar = (fonte: string) => codigosEmTexto(fonte, codigos).map((a) => a.codigo);
    expect(achar("const r = <p>Proposto: PAGAMENTO_COMPROVADO</p>;")).toEqual(["PAGAMENTO_COMPROVADO"]);
    expect(achar('const r = <p>{x ? "PAGAMENTO_COMPROVADO" : "—"} {`Situação: EM_ANDAMENTO`}</p>;')).toEqual(["PAGAMENTO_COMPROVADO", "EM_ANDAMENTO"]);
    expect(achar('const r = <p title="EM_ANDAMENTO" aria-label={"Estado " + "PAGAMENTO_COMPROVADO"} />;')).toEqual(["EM_ANDAMENTO", "PAGAMENTO_COMPROVADO"]);
    // rotular sem mapa do labels devolve o código (R3 da #138, B12).
    expect(achar('const r = <p>{rotular({}, "PAGAMENTO_COMPROVADO")}</p>;')).toEqual(["PAGAMENTO_COMPROVADO"]);
    // Não acusa: código em comparação, em valor/key/className, no argumento do rotular, ou que não é enum.
    expect(achar([
      'import { M } from "@/lib/labels";',
      'const r = <p className="EM_ANDAMENTO" key="PAGAMENTO_COMPROVADO">{s === "EM_ANDAMENTO" ? "Em andamento" : rotular(M, "PAGAMENTO_COMPROVADO")}</p>;',
      'const s = <><input value="EM_ANDAMENTO" /><p>OUTRO_CODIGO</p></>;',
    ].join("\n"))).toEqual([]);
  });

  it("autoteste: o detector pega as formas conhecidas em fontes virtuais", () => {
    const tipos = (fonte: string) => enumsCrus(fonte).map((a) => `${a.tipo}:${a.trecho}`);
    expect(tipos('const r = <p>{i.habilidade.replaceAll("_", " ")}</p>;')).toEqual(["texto:i.habilidade", 'sublinhado:i.habilidade.replaceAll("_", " ")']);
    expect(tipos('const r = s.replace(/_/g, " ");')).toEqual(['sublinhado:s.replace(/_/g, " ")']);
    expect(tipos("const r = `(${t.statusMeta.toLowerCase().replace(\"_\", \" \")})`;")).toEqual([
      'sublinhado:t.statusMeta.toLowerCase().replace("_", " ")', "caixa:t.statusMeta.toLowerCase()",
    ]);
    expect(tipos('const r = x.split("_").join(" ");')).toEqual(['sublinhado:x.split("_")']);
    expect(tipos("const r = <p>Estado: {i.status}.</p>;")).toEqual(["texto:i.status"]);
    expect(tipos("const r = <p>{d.encontro!.status}</p>;")).toEqual(["texto:d.encontro!.status"]);
    expect(tipos('const NOTA = { A: "Nota" }; const r = <p>{x ? p.situacao : "—"} {NOTA[d.status] ?? d.status}</p>;')).toEqual(["texto:p.situacao", "texto:d.status"]);
    expect(tipos("const r = <h3>{`Proposta ${p.estado}`}</h3>;")).toEqual(["texto:p.estado"]);
    expect(tipos("const r = <input aria-label={`Motivo ${p.tipo}`} />;")).toEqual(["texto:p.tipo"]);
    expect(tipos("const r = <p>A agenda está {a.encontroStatus.toLowerCase()}</p>;")).toEqual(["texto:a.encontroStatus", "caixa:a.encontroStatus.toLowerCase()"]);
    // Não acusa: rótulo do mapa, key/name/value, comparação, campo que não é enum, minúscula de rótulo.
    expect(tipos([
      'import { MAPA } from "@/lib/labels";',
      "const r = <li key={`${p.papel}:${p.etapa}`} data-x={p.status}>{rotular(MAPA, i.status)} {MAPA[i.status]} {p.nome}</li>;",
      "const s = <input name={`nota-${n.habilidade}`} value={c.tipo} />;",
      'const t = i.status === "PREVISTO" ? 1 : 2; const u = f.get(`${p.papel}_nome`);',
      "const v = <p>{rotular(MAPA, x.tipo).toLowerCase()} {busca.trim().toLowerCase()}</p>;",
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R2 da #138, B5): o código chega ao texto por qualquer expressão, atributo ou prop de texto", () => {
    const textos = (fonte: string) => enumsCrus(fonte).filter((a) => a.tipo === "texto").map((a) => a.trecho);
    const um = (jsx: string, extra = "") => textos(`${extra}\nconst r = ${jsx};`);
    expect(um("<p aria-label={d.status} title={d.tipo} />")).toEqual(["d.status", "d.tipo"]);
    expect(um('<p>{"" + d.status} {[d.status].join("")} {d.status.trim()}</p>')).toEqual(["d.status", "d.status", "d.status"]);
    expect(um("<p>{d.status.charAt(0) + d.status.slice(1).toLowerCase()}</p>")).toEqual(["d.status", "d.status"]);
    expect(um("<p>{cru(d.status)}</p>", "const cru = (s: string) => s;")).toEqual(["d.status"]);
    expect(um("<p>{s}</p>", 'let s = ""; s = d.status;')).toEqual(["s"]);
    expect(um("<p>{d[CAMPO]}</p>", 'const CAMPO = "status";')).toEqual(["d[CAMPO]"]);
    expect(um("<Etiqueta texto={d.status} />")).toEqual(["d.status"]);
    expect(um('<p>{xs.map((i) => { return i.status; }).join(", ")} {xs.map((i) => "" + i.tipo)}</p>')).toEqual(["i.status", "i.tipo"]);
    expect(um("<select>{Object.values(StatusTurma).map((v) => <option key={v}>{v}</option>)}</select>", 'import { StatusTurma } from "@prisma/client";')).toEqual(["v"]);
    expect(enumsCrus('const a = x.replaceAll("_", "\\u00a0"); const b = x.split("_").map((p) => p).join(" ");').map((a) => a.tipo)).toEqual(["sublinhado", "sublinhado"]);
    // Não acusa: rótulo, comparação, prop de estado de componente, value/key, helper que rotula, booleano.
    expect(textos([
      'import { MAPA } from "@/lib/labels";',
      "const rot = (v: string) => rotular(MAPA, v);",
      'const r = <p>{rotular(MAPA, d.status)} {d.status === "A" ? "Sim" : "Não"} {lista.includes(d.status) ? "Na lista" : "Fora"} {rot(d.tipo)}</p>;',
      "const s = <><StatusBadge status={d.status} /><input value={d.status} key={d.tipo} /></>;",
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R1 da #138, B1): alias, desestruturação, String(), colchete, campo composto, regex e constante", () => {
    const tipos = (fonte: string) => enumsCrus(fonte).map((a) => `${a.tipo}:${a.trecho}`);
    expect(tipos("const s = d.status; const r = <p>{s}</p>;")).toEqual(["texto:s"]);
    expect(tipos("const a = d.status; const b = a; const r = <p>{b}</p>;")).toEqual(["texto:b"]);
    expect(tipos("const { situacao } = d; const r = <p>{situacao}</p>;")).toEqual(["texto:situacao"]);
    expect(tipos("const { status: s } = d; const r = <p>{s}</p>;")).toEqual(["texto:s"]);
    expect(tipos("function B({ estado }: P) { return <p>{estado}</p>; }")).toEqual(["texto:estado"]);
    expect(tipos("const r = <p>{String(d.status)} {d.tipo.toString()}</p>;")).toEqual(["texto:d.status", "texto:d.tipo"]);
    expect(tipos("const r = <p>{`${d.status}`}</p>;")).toEqual(["texto:d.status"]);
    expect(tipos('const r = <p>{d["status"]}</p>;')).toEqual(['texto:d["status"]']);
    expect(tipos("const r = <p>{processo.estadoEnvio} {i.decisao} {f.participacaoAnterior} {o.ocorrenciaHistoricaTipo} {p.ambiente}</p>;")).toEqual([
      "texto:processo.estadoEnvio", "texto:i.decisao", "texto:f.participacaoAnterior", "texto:o.ocorrenciaHistoricaTipo", "texto:p.ambiente",
    ]);
    expect(tipos('const r = <p>{xs.map((i) => i.status).join(", ")} {ys.map((y) => y.tipo)}</p>;')).toEqual(["texto:i.status", "texto:y.tipo"]);
    expect(tipos('const r = h.habilidade.replace(/_+/g, " ");')).toEqual(['sublinhado:h.habilidade.replace(/_+/g, " ")']);
    expect(tipos('const r = x.replace(/[_]/g, " ");')).toEqual(['sublinhado:x.replace(/[_]/g, " ")']);
    expect(tipos('const SEP = "_", ESP = " "; const r = x.replaceAll(SEP, ESP);')).toEqual(["sublinhado:x.replaceAll(SEP, ESP)"]);
    // Não acusa: id/data/nome/texto de campo de enum, motivo da decisão, rótulo de produto, regex que não pega "_" sozinho.
    expect(tipos([
      "const r = <p>{d.statusId} {d.estadoEm} {d.tipoNome} {d.motivoDecisao} {d.decisaoId} {p.produtoDestino}</p>;",
      'const s = x.replace(/a_b/g, " ");',
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R3 da #138, B11): children, label, aria-valuetext/roledescription, __html e prop que o componente imprime", () => {
    const textos = (fonte: string) => enumsCrus(fonte).filter((a) => a.tipo === "texto").map((a) => a.trecho);
    expect(textos('const r = <><span children={d.status} /><option value="x" label={d.tipo} /></>;')).toEqual(["d.status", "d.tipo"]);
    expect(textos('const r = <div role="meter" aria-valuetext={d.status} aria-roledescription={d.situacao} />;')).toEqual(["d.status", "d.situacao"]);
    expect(textos("const r = <span dangerouslySetInnerHTML={{ __html: d.status }} />;")).toEqual(["d.status"]);
    // Componente do arquivo que leva a prop (de qualquer nome) ao texto: desestruturada, por props.x, por {...resto} e
    // por outro componente que a imprime.
    expect(textos([
      "function Celula({ conteudo }: { conteudo: string }) { return <span>{conteudo}</span>; }",
      "function Valor(props: { valor: string }) { return <b>{props.valor.trim()}</b>; }",
      "function Repasse({ classe, ...resto }: { classe: string; conteudo: string }) { return <Celula {...resto} />; }",
      "function Moldura({ texto }: { texto: string }) { return <Celula conteudo={texto} />; }",
      'const r = <><Celula conteudo={d.status} /><Valor valor={d.tipo} /><Repasse classe="x" conteudo={d.estado} /><Moldura texto={d.situacao} /></>;',
    ].join("\n"))).toEqual(["d.status", "d.tipo", "d.estado", "d.situacao"]);
    // Componente sem declaração (pacote): toda prop é texto, menos as de estado.
    expect(textos("const r = <Pill legenda={d.status} conteudo={d.tipo} tom={d.estado} variante={d.situacao} />;")).toEqual(["d.status", "d.tipo"]);
    // Não acusa: componente que rotula/compara a prop, key.
    expect(textos([
      'import { STATUS_X_LABEL, rotular } from "@/lib/labels";',
      'function Selo({ status, legenda }: { status: string; legenda: string }) { return <span className={status === "A" ? "a" : "b"}>{rotular(STATUS_X_LABEL, legenda)}</span>; }',
      "const r = <Selo status={d.status} legenda={d.tipo} key={d.estado} />;",
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R3 da #138, B12): filter/find, [x][0], reduce, push, [s] = […], propriedade de objeto, await e rotular sem mapa", () => {
    const textos = (fonte: string) => enumsCrus(fonte).filter((a) => a.tipo === "texto").map((a) => a.trecho);
    expect(textos('const r = <p>{[d.status].filter(Boolean).join("")} {[d.tipo].find(Boolean)} {[d.estado][0]}</p>;')).toEqual(["d.status", "d.tipo", "d.estado"]);
    expect(textos('const r = <p>{[d].reduce((a, x) => a + x.status, "")}</p>;')).toEqual(["x.status"]);
    expect(textos('const partes: string[] = []; partes.push(d.status); const r = <p>{partes.join(", ")}</p>;')).toEqual(["partes"]);
    expect(textos("const [s3] = [d.status]; const v3 = { rot: d.tipo }; const r = <p>{s3} {v3.rot}</p>;")).toEqual(["s3", "v3.rot"]);
    expect(textos("const lista = [d.status]; const r = <ul>{lista.map((s) => <li key={s}>{s}</li>)}</ul>;")).toEqual(["s"]);
    expect(textos("async function P() { return <p>{await Promise.resolve(d.status)}</p>; }")).toEqual(["d.status"]);
    expect(textos("const r = <p>{rotular({} as Record<string, string>, d.status)}</p>;")).toEqual(["d.status"]);
    // Não acusa: rotular com o mapa central, get de mapa de rótulos (devolve o valor, não a chave), tamanho da lista filtrada.
    expect(textos([
      'import { STATUS_X_LABEL, rotular } from "@/lib/labels";',
      'const r = <p>{rotular(STATUS_X_LABEL, d.status)} {ROTULOS.get(d.tipo)} {xs.filter((x) => x.status === "A").length}</p>;',
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R1 da #150, B1): rest, IIFE, alias no helper, Object.values/entries, X[código] sem mapa e campo label", () => {
    const textos = (fonte: string) => enumsCrus(fonte).filter((a) => a.tipo === "texto").map((a) => a.trecho);
    expect(textos('function junta(...xs: string[]) { return xs.join(" "); }\nconst r = <p>{junta("Situação", d.status)}</p>;')).toEqual(["d.status"]);
    expect(textos("const r = <p>{(() => d.status)()}</p>;")).toEqual(["d.status"]);
    expect(textos("function eco(s: string) { const v = s; return v; }\nconst r = <p>{eco(d.status)}</p>;")).toEqual(["d.status"]);
    expect(textos('const r = <p>{Object.values({ a: d.status }).join("")} {Object.entries({ b: d.tipo })[0][1]}</p>;')).toEqual(["d.status", "d.tipo"]);
    expect(textos("const r = <p>{(((x: string) => x) as unknown as Record<string, string>)[d.status]}</p>;")).toEqual(["d.status"]);
    expect(textos([
      'import { StatusTurma } from "@prisma/client";',
      "const opcoes = Object.values(StatusTurma).map((v) => ({ value: v, label: v as string }));",
      "const itens = [{ titulo: d.status }];",
    ].join("\n"))).toEqual(["v", "d.status"]);
    // Não acusa: X[código] com mapa (do labels, local, inline com chaves), helper que só compara o código, label rotulado.
    expect(textos([
      'import { STATUS_X_LABEL, rotular } from "@/lib/labels";',
      'const LOCAL = { A: "a" };',
      'function nota(s: string, texto: string) { return s === "A" ? texto : "—"; }',
      'const r = <p>{STATUS_X_LABEL[d.status]} {LOCAL[d.tipo]} {({ A: "a" })[d.estado]} {nota(d.situacao, "ok")}</p>;',
      "const o = [{ value: d.status, label: rotular(STATUS_X_LABEL, d.status) }];",
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R1 da #150, B3): spread de argumento, parâmetro desestruturado e useMemo seguem o código", () => {
    const textos = (fonte: string) => enumsCrus(fonte).filter((a) => a.tipo === "texto").map((a) => a.trecho);
    // `f` só devolve o 2º parâmetro: o spread na posição 0 chega a ele mesmo assim.
    expect(textos("function f(a: string, b: string) { return b; }\nconst r = <p>{f(...[d.tipo, d.status])}</p>;")).toEqual(["d.tipo", "d.status"]);
    expect(textos("function g({ s }: { s: string }) { return s; }\nconst r = <p>{g({ s: d.status })}</p>;")).toEqual(["d.status"]);
    expect(textos("const v = useMemo(() => d.status, [d.tipo]);\nconst r = <p>{v} {useMemo(() => d.estado, [d.situacao])}</p>;")).toEqual(["v", "d.estado"]);
  });

  it("autoteste (R2 da #150, B2): fromEntries, Reflect.get, Object[\"values\"], alias de Object.values, objeto em constante, new e propriedade de resultado opaco", () => {
    const textos = (fonte: string) => enumsCrus(fonte).filter((a) => a.tipo === "texto").map((a) => a.trecho);
    // V1–V4 e V8 da R2, cada um sozinho.
    expect(textos('const r = <p>{Object.fromEntries([["a", d.status]]).a}</p>;')).toEqual(["d.status"]);
    expect(textos('const r = <p>{Reflect.get({ a: d.status }, "a")}</p>;')).toEqual(["d.status"]);
    expect(textos('const r = <p>{Object["values"]({ a: d.status }).join("")}</p>;')).toEqual(["d.status"]);
    expect(textos('const ov = Object.values;\nconst r = <p>{ov({ a: d.status }).join("")}</p>;')).toEqual(["d.status"]);
    expect(textos('const r = <p>{(() => { const o = { a: d.status }; return Object.values(o).join(""); })()}</p>;')).toEqual(["o"]);
    // A mesma família: globalThis, alias do objeto e do membro, propriedade de resultado guardado, new, get de objeto.
    expect(textos('const r = <p>{globalThis.Reflect.get({ a: d.status }, "a")}</p>;')).toEqual(["d.status"]);
    expect(textos('const O = Object;\nconst r = <p>{O.values({ a: d.status }).join("")}</p>;')).toEqual(["d.status"]);
    expect(textos('const { fromEntries } = Object;\nconst r = <p>{fromEntries([["a", d.status]]).a}</p>;')).toEqual(["d.status"]);
    expect(textos("const o = Object.assign({}, { a: d.status });\nconst r = <p>{o.a}</p>;")).toEqual(["o"]);
    expect(textos('let o2 = {}; o2 = JSON.parse(JSON.stringify({ a: d.status }));\nconst r = <p>{o2.a}</p>;')).toEqual(["o2"]);
    expect(textos('const r = <p>{new Map([["a", d.status]]).get("a")}</p>;')).toEqual(["d.status"]);
    expect(textos('const r = <p>{Object["fromEntries"]([["a", d.status]]).a} {(0, Object.fromEntries)([["b", d.tipo]]).b}</p>;')).toEqual(["d.status", "d.tipo"]);
    expect(textos("const r = <p>{Object.values({ get a() { return d.status; } }).join(\"\")}</p>;")).toEqual(["d.status"]);
    // Falha fechada: função de fora do projeto que recebe objeto com o código devolve o código.
    expect(textos("const r = <p>{formatar({ valor: d.status })}</p>;")).toEqual(["d.status"]);
    // Não acusa: propriedade de resultado de método de receptor do projeto, resultado opaco sem código, propriedade de
    // objeto que guarda o código em OUTRO campo.
    expect(textos([
      "const lista = [{ status: d.status, nome: d.nome }];",
      "const o3 = { a: d.status, b: d.nome };",
      'const r = <p>{lista.find((i) => i.nome === "x")?.nome} {Object.fromEntries([["a", d.nome]]).a} {o3.b}</p>;',
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R2 da #150, B2): cada objeto global devolve o que entra pelos argumentos (lista fechada, conferida por cópia)", () => {
    const copia = ["Object", "Reflect", "JSON", "Array", "Promise", "Map", "Set"];
    expect([...NAMESPACES_GLOBAIS]).toEqual(copia);
    expect([...RAIZES_GLOBAIS]).toEqual(["globalThis", "window", "self"]);
    const textos = (fonte: string) => enumsCrus(fonte).filter((a) => a.tipo === "texto").map((a) => a.trecho);
    // `get`/`values` são "do receptor" em lista/Map; no objeto global, o argumento chega ao resultado.
    for (const g of copia) {
      expect(textos(`const r = <p>{${g}.get({ a: d.status }, "a")} {${g}.values({ b: d.tipo }).c}</p>;`), g).toEqual(["d.status", "d.tipo"]);
    }
    for (const raiz of ["globalThis", "window", "self"]) {
      expect(textos(`const r = <p>{${raiz}.Reflect.get({ a: d.status }, "a")}</p>;`), raiz).toEqual(["d.status"]);
    }
  });

  it("autoteste (R2 da #150, B1/B3): mapa importado de outro módulo do projeto — objeto literal, alias do labels ou alias local — rotula", () => {
    const projeto = projetoVirtual({
      "src/app/t/mapas.ts": [
        'import { STATUS_X_LABEL } from "@/lib/labels";',
        'export const LOCAL = { A: "a" };',
        // O caso real do B1: `export const nomesHabilidades = HABILIDADE_LABEL` (regras/[nivelId]/ResumoRegra.tsx).
        "export const DO_LABELS = STATUS_X_LABEL;",
        'import { LOCAL as BASE } from "./base";',
        "export const DE_OUTRO = BASE;",
        "export const FALSO = ((s: string) => s) as unknown as Record<string, string>;",
      ].join("\n"),
      "src/app/t/base.ts": 'export const LOCAL = { B: "b" };',
      // Import circular: nenhum dos dois é mapa — falha fechada.
      "src/app/t/ciclo-a.ts": 'import { B } from "./ciclo-b";\nexport const A = B;',
      "src/app/t/ciclo-b.ts": 'import { A } from "./ciclo-a";\nexport const B = A;',
      "src/app/t/page.tsx": [
        'import { LOCAL, DO_LABELS, DE_OUTRO, FALSO } from "./mapas";',
        'import { A } from "./ciclo-a";',
        "const r = <p>{LOCAL[d.status]} {DO_LABELS[d.tipo]} {DE_OUTRO[d.estado]} {FALSO[d.situacao]} {A[d.etapa]}</p>;",
      ].join("\n"),
    });
    expect(enumsCrusDoProjeto(projeto, "src/app/t/page.tsx").map((a) => a.trecho)).toEqual(["d.situacao", "d.etapa"]);
  });

  it("autoteste (R2 da #150, B1/B3): com o checker, número não é o código — total da página e contagem por código", () => {
    const projeto = projetoVirtual({
      "src/server/consulta.ts": [
        'import { PrismaClient, type MotivoY } from "@prisma/client";',
        "const prisma = new PrismaClient();",
        "export async function pagina({ motivo }: { motivo: MotivoY | null }) {",
        "  const where = motivo ? { motivo } : {};",
        "  const [itens, total] = await Promise.all([prisma.item.findMany({ where }), prisma.item.count({ where })]);",
        "  return { itens, total };",
        "}",
      ].join("\n"),
      "src/app/t/page.tsx": [
        'import type { MotivoY } from "@prisma/client";',
        'import { pagina } from "@/server/consulta";',
        "export default async function P({ m, contagem, rotulos }: { m: MotivoY; contagem: Record<MotivoY, number>; rotulos: Record<string, string> }) {",
        "  const [{ itens, total }, outro] = await Promise.all([pagina({ motivo: m }), Promise.resolve(m)]);",
        "  return <p>{total} {contagem[m]} {itens.length} {rotulos[m]} {outro}</p>;",
        "}",
      ].join("\n"),
    }, true);
    // `total` (number, do count) e `contagem[m]` (number) não acusam; `rotulos[m]` (Record de texto que não é mapa) e
    // `outro` (o próprio código, desestruturado do mesmo Promise.all) acusam.
    expect(enumsCrusDoProjeto(projeto, "src/app/t/page.tsx").map((a) => a.trecho)).toEqual(["m", "outro"]);
  });

  it("a varredura real usa o checker: Program nas telas, códigos do schema e o tipo de um campo real (R1 da #150, B3)", () => {
    const ficha = "src/app/(app)/alunos/[id]/FichaAluno.tsx";
    const r = projeto.rastreador(ficha)!;
    const checker = projeto.checkerDe(r.sf);
    expect(checker, "Program com checker na trava real").toBeDefined();
    expect(projeto.codigos.has("MASCULINO"), "códigos do schema (Genero)").toBe(true);
    // `aluno.genero` (Genero | null) é enum pelo TIPO — o nome `genero` não está na lista de nomes de enum.
    expect(nomeDeEnum("genero")).toBe(false);
    const generos: boolean[] = [];
    visitar(r.sf, (n) => { if (ts.isPropertyAccessExpression(n) && n.getText(r.sf) === "aluno.genero") generos.push(tipoDeEnum(checker!, checker!.getTypeAtLocation(n), projeto.codigos)); });
    expect(generos.length).toBeGreaterThan(0);
    expect(generos.every(Boolean)).toBe(true);
  });

  it("autoteste (R3 da #138, B15/G5): helper e componente importados são analisados na origem (leitor injetado)", () => {
    const projeto = projetoVirtual({
      "src/lib/ajuda.ts": [
        'import { STATUS_X_LABEL, rotular } from "@/lib/labels";',
        "export const cru = (s: string) => s.trim();",
        "export function rot(s: string) { return rotular(STATUS_X_LABEL, s); }",
      ].join("\n"),
      // `valor` é prop de estado na regra sem declaração; `legenda` é de texto — o resultado só sai certo se a trava
      // abre o componente importado.
      "src/components/Celula.tsx": "export default function Celula({ valor }: { valor: string }) { return <span>{valor}</span>; }",
      "src/components/Selo.tsx": 'import { STATUS_X_LABEL, rotular } from "@/lib/labels";\nexport function Selo({ legenda }: { legenda: string }) { return <i>{rotular(STATUS_X_LABEL, legenda)}</i>; }',
      "src/app/t/page.tsx": [
        'import { cru, rot } from "@/lib/ajuda";',
        'import Celula from "@/components/Celula";',
        'import { Selo } from "../../components/Selo";',
        "const r = <><p>{cru(d.status)} {rot(d.tipo)}</p><Celula valor={d.estado} /><Selo legenda={d.situacao} /></>;",
      ].join("\n"),
    });
    expect(enumsCrusDoProjeto(projeto, "src/app/t/page.tsx").map((a) => a.trecho)).toEqual(["d.status", "d.estado"]);
  });

  it("autoteste (C13 da #138): com o checker, o TIPO acusa enum cru de campo com nome qualquer — também pelo client do Prisma", () => {
    const projeto = projetoVirtual({
      "src/server/consulta.ts": [
        'import { PrismaClient, type MotivoY } from "@prisma/client";',
        "const prisma = new PrismaClient();",
        "export async function consultar() { return prisma.item.findMany({ include: { turma: true } }); }",
        "export type Linha = { motivo: MotivoY; nota: string; motivos: MotivoY[] };",
      ].join("\n"),
      "src/app/t/page.tsx": [
        'import { useState } from "react";',
        'import { consultar, type Linha } from "@/server/consulta";',
        'import { MOTIVO_Y_LABEL, rotular } from "@/lib/labels";',
        "export default async function Pagina() {",
        "  const itens = await consultar();",
        "  return <ul>{itens.map((i) => <li key={i.id}>{i.motivo} {i.turma?.fase} {rotular(MOTIVO_Y_LABEL, i.motivo)} {i.nota}</li>)}</ul>;",
        "}",
        "export function Cartao({ d }: { d: Linha }) {",
        "  const [filtro] = useState(d.motivo);",
        '  return <p title={d.motivos.join(", ")}>{filtro} {[d.motivo][0]} {d.nota.trim()}</p>;',
        "}",
      ].join("\n"),
    }, true);
    expect(enumsCrusDoProjeto(projeto, "src/app/t/page.tsx").map((a) => a.trecho)).toEqual(["i.motivo", "i.turma?.fase", "d.motivos", "filtro", "d.motivo"]);
    // Sem checker, os mesmos nomes passam: o que acusa acima é o tipo, não o nome.
    expect(enumsCrusDoProjeto(projetoVirtual({ "src/app/t/page.tsx": "const r = <p>{i.motivo} {i.turma?.fase}</p>;" }), "src/app/t/page.tsx")).toEqual([]);
  });

  it("autoteste (integração da #150): com o checker, alias pela declaração, posição de tupla pelo tipo e fluxo por parâmetro", () => {
    const projeto = projetoVirtual({
      "src/app/t/page.tsx": [
        'import { useState } from "react";',
        'import type { MotivoY } from "@prisma/client";',
        // Dois `motivo` no mesmo arquivo: o estado guarda o código; o local de outra função é texto livre.
        "export function Estado() { const [motivo] = useState<MotivoY>(\"RECUSA\"); return <p>{motivo}</p>; }",
        "export function Livre({ p }: { p: Record<string, unknown> }) { const motivo = typeof p.motivo === \"string\" ? p.motivo : null; return <p>{motivo}</p>; }",
        // Tupla [código, rótulo]: só a posição do código guarda o código.
        'const tipos = [["SEM_CONTATO", "Sem contato"], ["RECUSA", "Recusa"]] as const;',
        "export function Opcoes() { return <select>{tipos.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</select>; }",
        "export function Cru() { return <p>{tipos.map(([valor]) => valor).join(\", \")}</p>; }",
        // Helper: só o argumento cujo parâmetro chega ao retorno atravessa; `tipo` só decide.
        'function detalhe(tipo: MotivoY, nota: string, eco: MotivoY) { return tipo === "RECUSA" ? nota : `${nota} ${eco}`; }',
        "export function Detalhe({ m }: { m: MotivoY }) { return <p>{detalhe(m, \"ok\", \"RECUSA\")} {detalhe(\"RECUSA\", \"ok\", m)}</p>; }",
      ].join("\n"),
    }, true);
    const trechos = enumsCrusDoProjeto(projeto, "src/app/t/page.tsx").map((a) => `${a.linha}:${a.trecho}`);
    // Linha 3: o `motivo` do estado; linha 4 (texto livre) não. Linha 6: `rotulo` não; linha 7: `valor` sim.
    // Linha 9: no 1º `detalhe`, `m` vai no parâmetro que só decide; no 2º, no que chega ao texto.
    expect(trechos).toEqual(["3:motivo", "7:valor", "9:m"]);
    expect(trechos.filter((x) => x.startsWith("4:") || x.startsWith("6:"))).toEqual([]);
    expect(trechos.filter((x) => x.startsWith("9:"))).toEqual(["9:m"]);
  });

  it("autoteste: o client virtual do Prisma traz enums, modelos, relações e delegados", () => {
    const d = clientePrismaVirtual(SCHEMA_DE_TESTE);
    expect(d).toContain('const MotivoY: { readonly SEM_CONTATO: "SEM_CONTATO"; readonly RECUSA: "RECUSA" };');
    expect(d).toContain("export type Item = { id: string; motivo: $Enums.MotivoY; nota: string; turmaId: string | null };");
    expect(d).toContain("type $Linha_Item = Item & { turma: $Linha_Turma | null };");
    expect(d).toContain("type $Linha_Turma = Turma & { itens: $Linha_Item[] };");
    expect(d).toContain("  item: $Delegado<$Linha_Item>;");
    expect(d).toContain("count(a?: any): Promise<number>;");
    // Sem groupBy/aggregate, a função que os usa vira `any` e contamina o Promise.all inteiro da tela: o `total`
    // de financeiro/(painel)/comissoes/page.tsx saía `any` e era acusado (integração da R2 da #150).
    expect(d).toContain("groupBy(a?: any): Promise<any[]>; aggregate(a?: any): Promise<any>;");
  });
});

// ---------------------------------------------------------------------------------------------------
// (i) enum cru na tela — por renderização: cada tela com cada valor dos seus enums
// ---------------------------------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  avisos: vi.fn(), envios: vi.fn(), preferencia: vi.fn(), cancelamento: vi.fn(), quantidade: vi.fn(), segundas: vi.fn(),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn(async () => ({ id: "u" })) }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/comunicacoes-agenda/consultas", () => ({ consultarAvisosAlteracaoAgenda: mocks.avisos }));
vi.mock("@/app/(app)/secretaria/avisos-agenda/ReconferirPendencia", () => ({ ReconferirPendencia: () => null }));
vi.mock("@/server/portal-aluno/fila-envios", () => ({ consultarFilaEnviosPortalAluno: mocks.envios }));
vi.mock("@/app/(app)/secretaria/envios-portal/ConciliacaoEnvio", () => ({ ConciliacaoEnvio: () => null }));
vi.mock("@/server/avaliacoes/recuperacao-agenda-cancelamento", () => ({ consultarCancelamentoAgendaRecuperacao: mocks.cancelamento }));
vi.mock("@/app/(app)/academico/avaliacoes/Identificacao", () => ({ IdentificacaoAvaliacao: () => null }));
vi.mock("@/app/(app)/academico/recuperacoes/reservas/[reservaId]/cancelamento/Formularios", () => ({ Propor: () => null, Decidir: () => null }));
vi.mock("@/server/agenda/modalidade-quantidade-consulta", () => ({ consultarPropostaQuantidadeAulasModalidade: mocks.quantidade }));
vi.mock("@/app/(app)/academico/modalidades/[id]/quantidade/propostas/[propostaId]/DecidirQuantidadeAulas", () => ({ DecidirQuantidadeAulas: () => null }));
vi.mock("@/server/avaliacoes/segunda-chamada-docente", () => ({ listarSegundasChamadasDocente: mocks.segundas }));

import AvisosAgendaPage from "@/app/(app)/secretaria/avisos-agenda/page";
import EnviosPortalPage from "@/app/(app)/secretaria/envios-portal/page";
import CancelamentoRecuperacaoPage from "@/app/(app)/academico/recuperacoes/reservas/[reservaId]/cancelamento/page";
import PropostaQuantidadePage from "@/app/(app)/academico/modalidades/[id]/quantidade/propostas/[propostaId]/page";
import MinhasSegundasChamadasPage from "@/app/(app)/academico/segundas-chamadas/minhas/page";

const instante = new Date("2026-10-01T03:30:00.000Z");
type Campos = Record<string, string>;
type Tela = { renderizar: (c: Campos) => Promise<string>; enums: { campo: string; valores: readonly string[]; mapa: Readonly<Record<string, string>>; fixo: string }[] };

const TELAS: Record<string, Tela> = {
  "/secretaria/avisos-agenda": {
    renderizar: async (c) => {
      mocks.avisos.mockResolvedValue({ ok: true, dado: {
        itens: [{ id: "a", alunoNome: "Ana", canal: c.canal, situacao: c.situacao, atualizadoEm: instante }],
        pendencias: [{ id: "p", matriculaId: "m", matriculaCodigo: "M-1", alunoNome: "Ana", motivo: c.motivo, situacao: "PENDENTE", criadoEm: instante }],
        proximoCursor: null, proximoCursorPendencia: null,
      } });
      return renderToStaticMarkup(await AvisosAgendaPage({ searchParams: Promise.resolve({}) }));
    },
    enums: [
      { campo: "canal", valores: Object.values(CanalAvisoAlteracaoAgenda), mapa: L.CANAL_AVISO_ALTERACAO_AGENDA_LABEL, fixo: "EMAIL" },
      { campo: "situacao", valores: Object.values(SituacaoAvisoAlteracaoAgenda), mapa: L.SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL, fixo: "PREPARADO" },
      { campo: "motivo", valores: Object.values(MotivoPendenciaAvisoAgenda), mapa: L.MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL, fixo: "CONTATO_INDISPONIVEL" },
    ],
  },
  "/secretaria/envios-portal": {
    renderizar: async (c) => {
      mocks.envios.mockResolvedValue({ ok: true, dado: { proximoCursor: null, itens: [
        { id: "e", alunoNome: "Ana", finalidade: c.finalidade, situacao: c.situacao, criadoEm: instante, atualizadoEm: instante, conciliacao: null },
      ] } });
      return renderToStaticMarkup(await EnviosPortalPage({ searchParams: Promise.resolve({}) }));
    },
    enums: [
      { campo: "finalidade", valores: Object.values(FinalidadeTokenPortalAluno), mapa: L.FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL, fixo: "CONVITE" },
      { campo: "situacao", valores: Object.values(SituacaoEnvioPortalAluno), mapa: L.SITUACAO_ENVIO_PORTAL_ALUNO_LABEL, fixo: "PREPARADO" },
    ],
  },
  "cancelamento da recuperação pela escola": {
    renderizar: async (c) => {
      mocks.cancelamento.mockResolvedValue({ ok: true, dado: {
        identificacao: {}, estadoConferido: "a".repeat(64), podePropor: false, proximoAntesId: null, propostas: [],
        atual: { reservaId: "r", matriculaId: "m", cancelamentoId: null, itens: [{ id: "i", habilidade: c.habilidade, realizacaoId: null, inicio: "2026-01-01T02:30:00Z", fim: "2026-01-01T03:30:00Z", status: c.status, fusoOrigem: "UTC" }] },
      } });
      return renderToStaticMarkup(await CancelamentoRecuperacaoPage({ params: Promise.resolve({ reservaId: "r" }), searchParams: Promise.resolve({}) }));
    },
    enums: [
      { campo: "habilidade", valores: HABILIDADES, mapa: L.HABILIDADE_LABEL, fixo: "LEITURA" },
      { campo: "status", valores: Object.values(StatusEncontroAgenda), mapa: L.STATUS_ENCONTRO_LABEL, fixo: "PREVISTO" },
    ],
  },
  "revisão da quantidade de aulas": {
    renderizar: async (c) => {
      mocks.quantidade.mockResolvedValue({ ok: true, dado: {
        id: "p", modalidadeId: "m", modalidade: { nome: "Inglês" }, versao: 2, quantidadeAnterior: 2, quantidadeNova: 3, situacao: c.situacao,
        motivo: "Revisão", preparador: { nome: "Secretaria" }, decisao: null, aplicadaEm: null,
        impactos: [{ id: "i", turmaId: "t", turma: { codigo: "T-01" }, quantidadeAnterior: 2, quantidadeNova: 3, alcance: c.alcance, excecoesQ37: [], snapshot: {} }],
      } });
      return renderToStaticMarkup(await PropostaQuantidadePage({ params: Promise.resolve({ id: "m", propostaId: "p" }) }));
    },
    enums: [
      { campo: "situacao", valores: Object.values(SituacaoPropostaQuantidadeAulas), mapa: L.SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL, fixo: "APLICADA" },
      { campo: "alcance", valores: Object.values(AlcanceImpactoQuantidadeAulas), mapa: L.ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL, fixo: "AUMENTO_NAO_INICIADA" },
    ],
  },
  "/academico/segundas-chamadas/minhas": {
    renderizar: async (c) => {
      mocks.segundas.mockResolvedValue({ ok: true, dado: { proximoId: null, itens: [{
        reservaId: "r", codigoAvaliacao: "AV", inicio: "2026-01-01T02:30:00.000Z", fim: "2026-01-01T03:30:00.000Z", fusoOrigem: "UTC",
        status: c.status, aluno: "Ana", matriculaCodigo: "M", turma: "T", realizacao: null, podeRealizar: false,
      }] } });
      return renderToStaticMarkup(await MinhasSegundasChamadasPage({ searchParams: Promise.resolve({}) }));
    },
    enums: [{ campo: "status", valores: Object.values(StatusReservaSegundaChamada), mapa: L.STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL, fixo: "RESERVADA" }],
  },
};

/** Só o texto lido (sem tags nem atributos). */
const texto = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&");
const ocorrencias = (t: string, trecho: string) => t.split(trecho).length - 1;
const codigoCru = (t: string, valor: string) => new RegExp(`(^|[^A-Za-z0-9_])${valor}([^A-Za-z0-9_]|$)`).test(t);

describe("(i) enum cru na tela — renderização com cada valor", () => {
  beforeEach(() => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
  });

  for (const [tela, { renderizar, enums }] of Object.entries(TELAS)) {
    for (const { campo, valores, mapa } of enums) {
      it(`${tela} · ${campo}: cada valor aparece pelo rótulo do mapa central, nunca pelo código`, async () => {
        const fixos = Object.fromEntries(enums.map((e) => [e.campo, e.fixo]));
        // Linha de base com valor desconhecido: o rótulo testado tem de aparecer A MAIS, por causa do valor.
        const base = texto(await renderizar({ ...fixos, [campo]: "VALOR_DESCONHECIDO" }));
        for (const valor of valores) {
          const t = texto(await renderizar({ ...fixos, [campo]: valor }));
          expect(codigoCru(t, valor), `${tela} · ${campo}=${valor} imprimiu o código`).toBe(false);
          expect(ocorrencias(t, mapa[valor]) - ocorrencias(base, mapa[valor]), `${tela} · ${campo}=${valor} → "${mapa[valor]}"`).toBeGreaterThanOrEqual(1);
        }
      });
    }
  }

  it("autoteste: o detector de código cru no texto não confunde rótulo com código", () => {
    expect(codigoCru(texto("<p>Situação: RESERVADA.</p>"), "RESERVADA")).toBe(true);
    expect(codigoCru(texto('<p data-v="RESERVADA">Situação: Reservada.</p>'), "RESERVADA")).toBe(false);
    expect(codigoCru(texto("<p>LIBERADA_CANCELAMENTO_ESCOLA</p>"), "LIBERADA")).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------
// (ii) mapa de rótulo de enum só em src/lib/labels.ts
// ---------------------------------------------------------------------------------------------------

export type MapaLocal = { nome: string; enums: string[]; linha: number };
/** Chaves que guardam o código numa lista de opções (`[{ valor: "ATIVA", rotulo: "Ativa" }]`). */
const CHAVES_DE_CODIGO = new Set(["valor", "value", "codigo", "chave", "key", "id", "opcao"]);

/**
 * Mapas de rótulo de enum numa fonte — o mapa ad-hoc — em qualquer forma que associe código a texto
 * (revisões R2/R3 da #138, B6/B13): objeto literal (chave simples, entre aspas, computada ou abreviada, mesmo de uma
 * chave só, mesmo com outros pares que não são código → texto), `new Map`/`Object.fromEntries` de pares, `Map.set` e
 * atribuição (`r.ATIVA = "Ativa"`) em série, lista de opções (`[{ valor: "ATIVA", rotulo: "Ativa" }, …]`), `switch`
 * e `if`/`return` em série que devolvem texto, cadeia de ternários (com `!==`, sob guarda, ou comparando com
 * `Enum.MEMBRO`) ou série de `&&` sobre o mesmo sujeito, e reabertura do mapa central — spread ou `Object.assign`
 * (também por alias) com texto próprio, ou "override" de um valor antes do `rotular`. As chaves precisam ser códigos
 * de enum (do schema ou dos mapas de labels.ts); o mapa pode misturar enums.
 */
export function mapasDeRotulo(fonte: string, enums: Map<string, string[]>, arquivo = "x.tsx"): MapaLocal[] {
  const sf = arvore(fonte, arquivo);
  const mapas: MapaLocal[] = [];
  const consts = constantesDeTexto(sf);
  // Nomes que vêm de src/lib/labels.ts (import nomeado ou namespace), e os aliases locais deles.
  const deLabels = new Set<string>(), aliasesCentrais = new Set<string>();
  for (const d of sf.statements) {
    if (!ts.isImportDeclaration(d) || !ts.isStringLiteral(d.moduleSpecifier) || !/(^|\/)labels$/.test(d.moduleSpecifier.text)) continue;
    const b = d.importClause?.namedBindings;
    if (b && ts.isNamedImports(b)) for (const e of b.elements) deLabels.add(e.name.text);
    if (b && ts.isNamespaceImport(b)) deLabels.add(b.name.text);
  }
  const ehMapaCentral = (e: ts.Expression): boolean => {
    const x = semEmbrulho(e);
    if (ts.isIdentifier(x)) return deLabels.has(x.text) || aliasesCentrais.has(x.text) || /_LABEL$/.test(x.text);
    return ts.isPropertyAccessExpression(x) && (/_LABEL$/.test(x.name.text) || (ts.isIdentifier(x.expression) && deLabels.has(x.expression.text)));
  };
  for (let mudou = true; mudou;) {
    mudou = false;
    visitar(sf, (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ehMapaCentral(n.initializer) && !aliasesCentrais.has(n.name.text)) { aliasesCentrais.add(n.name.text); mudou = true; }
    });
  }
  const nomeDoLiteral = (n: ts.Node) => {
    // Nome da constante só quando o literal É o valor dela (parênteses, as/satisfies, Object.freeze);
    // literal dentro de JSX ou de expressão maior é "inline".
    let no: ts.Node = n.parent;
    while (no && (ts.isParenthesizedExpression(no) || ts.isAsExpression(no) || ts.isSatisfiesExpression(no)
      || (ts.isCallExpression(no) && no.expression.getText(sf) === "Object.freeze"))) no = no.parent;
    if (no && ts.isVariableDeclaration(no) && ts.isIdentifier(no.name)) return no.name.text;
    // Literal solto dentro de função com nome: o nome dela (estável para a exceção); fora de função, a linha.
    for (let f: ts.Node | undefined = n.parent; f; f = f.parent) {
      if (ts.isFunctionDeclaration(f) && f.name) return `(literal em ${f.name.text})`;
      if ((ts.isArrowFunction(f) || ts.isFunctionExpression(f)) && ts.isVariableDeclaration(f.parent) && ts.isIdentifier(f.parent.name)) return `(literal em ${f.parent.name.text})`;
    }
    return `(literal na linha ${linhaDe(sf, n)})`;
  };
  /** O texto do valor: literal (também sob `String()`), constante de texto do arquivo (um só valor possível) ou texto
   * montado só de literais (`"Conclu" + "ída"`, R3 da #138, B13). */
  const valorDeTexto = (e: ts.Expression): string | null => {
    const x = semConversao(e);
    if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const a = valorDeTexto(x.left), b = valorDeTexto(x.right);
      return a !== null && b !== null ? a + b : null;
    }
    if (ts.isTemplateExpression(x)) {
      let t = x.head.text;
      for (const s of x.templateSpans) { const v = valorDeTexto(s.expression); if (v === null) return null; t += v + s.literal.text; }
      return t;
    }
    const v = textosDe(x, consts);
    return v.length === 1 ? v[0] : null;
  };
  // Texto de gente: tem letra, não é só código, não é classe CSS nem só identificador (`"TurmaAberta"`, `"alunoOrigemId"`:
  // nome de evento ou de campo).
  const ehRotulo = (valores: string[]) => valores.some((v) => /[A-Za-zÀ-ú]/.test(v)) && !valores.every((v) => CODIGO.test(v)) && !valores.some((v) => CLASSE.test(v))
    && !valores.every((v) => /^[A-Za-z][A-Za-z0-9]*$/.test(v) && /[a-z][A-Z]/.test(v));
  /** O código de uma chave: identificador, texto, `[ "ATIVA" ]`, `[StatusX.ATIVA]` ou constante do arquivo. */
  const codigoDeChave = (k: ts.PropertyName | ts.Expression): string | null => {
    if (ts.isComputedPropertyName(k)) return codigoDeChave(k.expression);
    if (ts.isIdentifier(k) && ts.isPropertyName(k) && !ts.isExpression(k.parent as ts.Node)) return k.text;
    const x = ts.isIdentifier(k) || ts.isStringLiteralLike(k) ? k : semEmbrulho(k as ts.Expression);
    if (ts.isStringLiteralLike(x)) return x.text;
    if (ts.isPropertyAccessExpression(x) && CODIGO.test(x.name.text)) return x.name.text;
    if (ts.isIdentifier(x)) { const v = consts.get(x.text) ?? []; return v.length === 1 ? v[0] : x.text; }
    return null;
  };
  const donosDe = (chaves: string[]) => {
    const unico = [...enums].filter(([, valores]) => chaves.every((c) => valores.includes(c))).map(([nome]) => nome);
    if (unico.length) return unico;
    // Mapa misto (tipo + desfecho…): cada chave é código de algum enum.
    if (chaves.length < 2 || !chaves.every((c) => [...enums].some(([, v]) => v.includes(c)))) return [];
    return [...new Set(chaves.map((c) => [...enums].find(([, v]) => v.includes(c))![0]))];
  };
  type Par = { chave: string | null; valor: string | null };
  const registrar = (n: ts.Node, nome: string, pares: Par[] | null, minimo = 1) => {
    if (!pares) return;
    // Par não reconhecido (valor calculado, spread local, chave que não é código) não desfaz o mapa: os pares
    // código → texto que sobram ainda são mapa (R3 da #138, B13).
    const validos = pares.filter((p): p is { chave: string; valor: string } => p.chave !== null && p.valor !== null && CODIGO.test(p.chave));
    if (validos.length < minimo || !ehRotulo(validos.map((p) => p.valor))) return;
    const donos = donosDe(validos.map((p) => p.chave));
    if (donos.length) mapas.push({ nome, enums: donos, linha: linhaDe(sf, n) });
  };
  const paresDeEntradas = (e: ts.Expression | undefined): Par[] | null => {
    const x = e && semEmbrulho(e);
    if (!x || !ts.isArrayLiteralExpression(x)) return null;
    return x.elements.map((el) => {
      const par = semEmbrulho(el as ts.Expression);
      return ts.isArrayLiteralExpression(par) && par.elements.length === 2 ? { chave: codigoDeChave(par.elements[0]), valor: valorDeTexto(par.elements[1]) } : { chave: null, valor: null };
    });
  };
  /** Código no lado "literal" de uma comparação: texto ("ATIVA") ou membro de enum (`StatusTurma.ATIVA`, R3 da #138, B13). */
  const codigoLiteral = (e: ts.Expression): string | null => {
    const x = semEmbrulho(e);
    if (ts.isStringLiteralLike(x)) return CODIGO.test(x.text) ? x.text : null;
    return ts.isPropertyAccessExpression(x) && CODIGO.test(x.name.text) && /^[A-Z$]/.test(x.expression.getText(sf)) ? x.name.text : null;
  };
  /** `s === "ATIVA"`, `"ATIVA" == s`, `s === StatusX.ATIVA`, `s !== "ATIVA"` (negada), sob guarda (`ok && s === "ATIVA"`). */
  type Comparacao = { sujeito: string; codigo: string; negada: boolean };
  const comparacao = (c0: ts.Expression): Comparacao | null => {
    const c = semEmbrulho(c0);
    if (!ts.isBinaryExpression(c)) return null;
    const op = c.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return comparacao(c.right) ?? comparacao(c.left);
    const iguais = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken], diferentes = [ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken];
    if (!iguais.includes(op) && !diferentes.includes(op)) return null;
    const direita = codigoLiteral(c.right);
    const [lado, codigo] = direita !== null ? [c.left, direita] : [c.right, codigoLiteral(c.left)];
    if (codigo === null) return null;
    return { sujeito: semConversao(lado).getText(sf), codigo, negada: diferentes.includes(op) };
  };
  /** A folha rotula o próprio sujeito pelo mapa central? (`rotular(MAPA, s)` / `MAPA[s]`) */
  const rotulaSujeito = (e: ts.Expression, sujeito: string) => {
    const x = semEmbrulho(e);
    if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && x.expression.text === "rotular") return x.arguments[1] !== undefined && semConversao(x.arguments[1]).getText(sf) === sujeito;
    return ts.isElementAccessExpression(x) && semConversao(x.argumentExpression).getText(sf) === sujeito;
  };
  /** O texto que um ramo de `if`/`case` devolve ou atribui (`return "Ativa"`, `r = "Ativa"`, `{ return "Ativa"; }`). */
  const valorDoRamo = (st: ts.Statement): string | null => {
    if (ts.isReturnStatement(st) && st.expression) return valorDeTexto(st.expression);
    if (ts.isExpressionStatement(st) && ts.isBinaryExpression(st.expression) && st.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) return valorDeTexto(st.expression.right);
    if (ts.isBlock(st) && st.statements.length === 1) return valorDoRamo(st.statements[0]);
    return null;
  };
  /** `Map.set`/atribuição em série, por alvo (agrupadas no fim). */
  const seriesSet = new Map<string, { no: ts.Node; pares: Par[] }>(), seriesAtribuicao = new Map<string, { no: ts.Node; pares: Par[] }>();
  const juntar = (grupo: typeof seriesSet, alvo: string, no: ts.Node, par: Par) => {
    const s = grupo.get(alvo) ?? { no, pares: [] };
    s.pares.push(par);
    grupo.set(alvo, s);
  };
  visitar(sf, (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      // { ...STATUS_X_LABEL, CODIGO: "Outra redação" }: espalha o mapa central (ou alias dele) e sobrescreve rótulo.
      const espalhados = n.properties.filter((p): p is ts.SpreadAssignment => ts.isSpreadAssignment(p) && ehMapaCentral(p.expression));
      if (espalhados.length) {
        const proprios = n.properties.filter(ts.isPropertyAssignment);
        if (proprios.some((p) => valorDeTexto(p.initializer) !== null)) mapas.push({ nome: nomeDoLiteral(n), enums: espalhados.map((p) => `...${p.expression.getText(sf)}`), linha: linhaDe(sf, n) });
        return;
      }
      // O objeto de sobrescrita dentro de Object.assign(…, MAPA_CENTRAL, { … }) já conta no achado do assign.
      const pai = semPai(n);
      if (ts.isCallExpression(pai) && pai.expression.getText(sf) === "Object.assign" && pai.arguments.some(ehMapaCentral)) return;
      registrar(n, nomeDoLiteral(n), n.properties.map((p): Par => ts.isPropertyAssignment(p) ? { chave: codigoDeChave(p.name), valor: valorDeTexto(p.initializer) }
        : ts.isShorthandPropertyAssignment(p) ? { chave: p.name.text, valor: valorDeTexto(p.name) } : { chave: null, valor: null }));
      return;
    }
    // Object.assign({}, STATUS_X_LABEL, { ATIVA: "Em vigor" })
    if (ts.isCallExpression(n) && n.expression.getText(sf) === "Object.assign") {
      const central = n.arguments.find(ehMapaCentral);
      const comTexto = n.arguments.some((a) => ts.isObjectLiteralExpression(semEmbrulho(a)) && (semEmbrulho(a) as ts.ObjectLiteralExpression).properties.some((p) => ts.isPropertyAssignment(p) && valorDeTexto(p.initializer) !== null));
      if (central && comTexto) mapas.push({ nome: nomeDoLiteral(n), enums: [`Object.assign(${central.getText(sf)})`], linha: linhaDe(sf, n) });
      return;
    }
    // new Map([["ATIVA", "Ativa"], …]) / Object.fromEntries([["ATIVA", "Ativa"], …])
    if ((ts.isNewExpression(n) && n.expression.getText(sf) === "Map") || (ts.isCallExpression(n) && n.expression.getText(sf) === "Object.fromEntries")) {
      registrar(n, nomeDoLiteral(n), paresDeEntradas(n.arguments?.[0]));
      return;
    }
    // m.set("ATIVA", "Ativa") e new Map().set(…).set(…), agrupados pelo mapa (R3 da #138, B13).
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "set" && n.arguments.length === 2) {
      let base: ts.Expression = n.expression.expression;
      while (ts.isCallExpression(base) && ts.isPropertyAccessExpression(base.expression) && base.expression.name.text === "set") base = base.expression.expression;
      juntar(seriesSet, semEmbrulho(base).getText(sf), n, { chave: codigoDeChave(n.arguments[0]), valor: valorDeTexto(n.arguments[1]) });
    }
    // r.ATIVA = "Ativa" / r["ATIVA"] = "Ativa", agrupados pelo objeto (B13).
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const alvo = semEmbrulho(n.left);
      if (ts.isPropertyAccessExpression(alvo) || ts.isElementAccessExpression(alvo)) {
        const chave = ts.isPropertyAccessExpression(alvo) ? alvo.name.text : codigoDeChave(alvo.argumentExpression);
        juntar(seriesAtribuicao, alvo.expression.getText(sf), n, { chave, valor: valorDeTexto(n.right) });
      }
    }
    // [["ATIVA", "Ativa"], …] (também `as const`): lista de pares código → texto (R1 da #150, B2). Dentro de
    // new Map(…)/Object.fromEntries(…) já conta no achado da chamada.
    if (ts.isArrayLiteralExpression(n) && n.elements.length > 0 && n.elements.every((el) => { const p = semEmbrulho(el); return ts.isArrayLiteralExpression(p) && p.elements.length === 2; })) {
      let dono: ts.Node = n.parent;
      while (dono && (ts.isParenthesizedExpression(dono) || ts.isAsExpression(dono) || ts.isSatisfiesExpression(dono))) dono = dono.parent;
      const naChamada = (ts.isNewExpression(dono) && dono.expression.getText(sf) === "Map") || (ts.isCallExpression(dono) && dono.expression.getText(sf) === "Object.fromEntries");
      if (!naChamada) registrar(n, nomeDoLiteral(n), paresDeEntradas(n));
    }
    // [{ valor: "ATIVA", rotulo: "Ativa" }, …]: lista de opções de <select> (B13). Cada item: o código na chave de valor
    // (`valor`, `value`, `codigo`…) e um texto. Lista de ações (`{ label: "Pausar", alvo: "PAUSADA" }`) não é rótulo.
    if (ts.isArrayLiteralExpression(n) && n.elements.length >= 2 && n.elements.every((el) => !ts.isSpreadElement(el) && ts.isObjectLiteralExpression(semEmbrulho(el)))) {
      registrar(n, nomeDoLiteral(n), n.elements.map((el): Par => {
        const props = (semEmbrulho(el as ts.Expression) as ts.ObjectLiteralExpression).properties.filter(ts.isPropertyAssignment);
        const codigos = props.filter((p) => (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && CHAVES_DE_CODIGO.has(p.name.text))
          .map((p) => codigoLiteral(p.initializer)).filter((c): c is string => c !== null);
        const textos = props.map((p) => valorDeTexto(p.initializer)).filter((v): v is string => v !== null && !CODIGO.test(v) && !CLASSE.test(v) && /[A-Za-zÀ-ú]/.test(v));
        return codigos.length === 1 && textos.length ? { chave: codigos[0], valor: textos[0] } : { chave: null, valor: null };
      }), 2);
    }
    // if (s === "ATIVA") return "Ativa"; if (s === "PAUSADA") return "Pausada"; … — também com else if (B13).
    if (ts.isBlock(n) || ts.isSourceFile(n) || ts.isCaseClause(n) || ts.isModuleBlock(n)) {
      const porSujeito = new Map<string, Par[]>();
      const seguir = (st: ts.Statement) => {
        if (ts.isBlock(st) && st.statements.length === 1) return seguir(st.statements[0]);
        if (!ts.isIfStatement(st)) return;
        // Só comparação pura: `if (!erro && s === "A") erro = "…"` é guarda com mensagem, não mapa.
        const cond = semEmbrulho(st.expression);
        const c = ts.isBinaryExpression(cond) && cond.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken ? comparacao(cond) : null;
        if (c && !c.negada) porSujeito.set(c.sujeito, [...(porSujeito.get(c.sujeito) ?? []), { chave: c.codigo, valor: valorDoRamo(st.thenStatement) }]);
        if (st.elseStatement) seguir(st.elseStatement);
      };
      for (const st of n.statements) seguir(st);
      for (const [sujeito, pares] of porSujeito) registrar(n, `if ${sujeito}`, pares, 2);
    }
    // switch (s) { case "ATIVA": return "Ativa"; … }
    if (ts.isSwitchStatement(n)) {
      const pares: Par[] = n.caseBlock.clauses.filter(ts.isCaseClause).map((c) => {
        let valor: string | null = null;
        for (const st of c.statements) { valor = valorDoRamo(st); if (valor !== null) break; }
        return { chave: codigoDeChave(c.expression), valor };
      });
      registrar(n, `switch ${semEmbrulho(n.expression).getText(sf)}`, pares, 2);
      return;
    }
    // Ternários: cadeia sobre o MESMO sujeito, com todas as folhas texto de rótulo (duas ou mais comparações),
    // ou "override" de um valor antes do mapa central (`s === "ATIVA" ? "Em vigor" : rotular(MAPA, s)`).
    // Cabeça da cadeia: sem ternário acima, ou com um ternário acima cuja condição não é comparação de código
    // (`i.status ? (i.status === "A" ? … : …) : "—"` — a guarda de existência não esconde o mapa; R3 da #138, B7).
    const acima = semPai(n);
    if (ts.isConditionalExpression(n) && (!ts.isConditionalExpression(acima) || !comparacao(acima.condition))) {
      const codigos: string[] = [], folhasTexto: (string | null)[] = [], folhasNos: ts.Expression[] = [], sujeitos = new Set<string>();
      let ok = true;
      const percorrer = (e: ts.Expression) => {
        const x = semEmbrulho(e);
        if (!ts.isConditionalExpression(x)) { folhasTexto.push(valorDeTexto(x)); folhasNos.push(x); return; }
        const c = comparacao(x.condition);
        if (!c) { ok = false; return; }
        codigos.push(c.codigo); sujeitos.add(c.sujeito);
        const [sim, nao] = c.negada ? [x.whenFalse, x.whenTrue] : [x.whenTrue, x.whenFalse];
        percorrer(sim); percorrer(nao);
      };
      percorrer(n);
      if (!ok || sujeitos.size !== 1) return;
      const sujeito = [...sujeitos][0];
      const override = folhasNos.some((f) => rotulaSujeito(f, sujeito)) && folhasTexto.some((v) => v !== null && /[A-Za-zÀ-ú]/.test(v));
      if (override) { mapas.push({ nome: `override ${sujeito}`, enums: donosDe(codigos).length ? donosDe(codigos) : ["(mapa central)"], linha: linhaDe(sf, n) }); return; }
      if (codigos.length < 2 || folhasTexto.some((v) => v === null) || !ehRotulo(folhasTexto as string[])) return;
      const donos = donosDe(codigos);
      if (donos.length) mapas.push({ nome: `ternário ${sujeito}`, enums: donos, linha: linhaDe(sf, n) });
      return;
    }
    // Série de && entre irmãos do JSX: {s === "ATIVA" && "Ativa"}{s === "PAUSADA" && "Pausada"}
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      const porSujeito = new Map<string, Par[]>();
      for (const filho of n.children) {
        if (!ts.isJsxExpression(filho) || !filho.expression) continue;
        const x = semEmbrulho(filho.expression);
        if (!ts.isBinaryExpression(x) || x.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) continue;
        const c = comparacao(x.left);
        if (!c || c.negada) continue;
        porSujeito.set(c.sujeito, [...(porSujeito.get(c.sujeito) ?? []), { chave: c.codigo, valor: valorDeTexto(x.right) }]);
      }
      for (const [sujeito, pares] of porSujeito) registrar(n, `série && ${sujeito}`, pares, 2);
    }
  });
  for (const [alvo, s] of seriesSet) registrar(s.no, `Map.set ${alvo}`, s.pares);
  for (const [alvo, s] of seriesAtribuicao) registrar(s.no, `atribuição ${alvo}`, s.pares);
  return mapas;
}
/** Pai sem parênteses (para saber se o ternário é ramo de outro). */
const semPai = (n: ts.Node): ts.Node => { let p = n.parent; while (p && ts.isParenthesizedExpression(p)) p = p.parent; return p; };

/** Mapas que ficam na tela: frases do fluxo (próximo passo, confirmação, dica), não o nome do valor. */
const MAPAS_DE_TELA: { arquivo: string; nome: string; motivo: string }[] = [
  { arquivo: "src/app/(app)/academico/MudancasAcademicasPainel.tsx", nome: "nomesStatus", motivo: "fila pedagógica: o texto diz o próximo passo (\"Aprovada · aguardando execução\")" },
  { arquivo: "src/app/(app)/academico/equivalencias/page.tsx", nome: "nomesEstado", motivo: "frases do fluxo de equivalência (\"Autorizada para execução\", \"Transferência efetivada\")" },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/MovimentacoesPainel.tsx", nome: "status", motivo: "fila de pausa/retomada: o texto diz o próximo passo (\"Aprovada; aplicação pendente\")" },
  { arquivo: "src/app/(app)/academico/correcoes/revisoes/[casoId]/page.tsx", nome: "acoesResolucao", motivo: "frase do histórico no particípio (\"Cancelamento da solicitação registrado\")" },
  { arquivo: "src/app/(app)/academico/correcoes/revisoes/[casoId]/ResolucaoRevisaoProgressao.tsx", nome: "rotulosAcao", motivo: "opção de ação no infinitivo (\"Registrar o cancelamento da solicitação\")" },
  { arquivo: "src/app/(app)/academico/correcoes/revisoes/[casoId]/ResolucaoRevisaoProgressao.tsx", nome: "efeitoAcao", motivo: "explicação do efeito de cada ação, não rótulo" },
  { arquivo: "src/app/(app)/configuracao/paises/PaisesPainel.tsx", nome: "CONFIRMACAO_STATUS", motivo: "mensagem de confirmação da transição (\"País ativado.\")" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx", nome: "ESTADO_HINT", motivo: "dica do efeito de cada estado da política" },
  { arquivo: "src/app/(app)/diario/reposicoes/ReposicoesEquipe.tsx", nome: "rotuloParticipacaoOrigem", motivo: "frase sobre a aula de origem (\"falta na aula de origem\")" },
  { arquivo: "src/app/(app)/inbox/InboxCliente.tsx", nome: "NOTA_POR_STATUS", motivo: "mensagem de resultado do envio (\"Mensagem enviada.\")" },
  { arquivo: "src/app/(app)/inbox/InboxCliente.tsx", nome: "ORIGEM_LABEL", motivo: "fragmento minúsculo ao lado da hora da mensagem; envio humano fica sem marca (\"\")" },
  { arquivo: "src/app/(app)/matriculas/[id]/preparacao/page.tsx", nome: "tipos", motivo: "rotula também o regime da preparação, com a duração da hora (\"Hora particular (60 minutos)\")" },
  // Ternários (revisão R1 da #138, B2): os que eram só rótulo foram para labels.ts; ficam as frases do fluxo.
  { arquivo: "src/app/(app)/financeiro/RetomadasPainel.tsx", nome: "ternário p.status", motivo: "fila de retomada: \"Aguardando aprovação\" diz quem age (o Financeiro aprova)" },
  { arquivo: "src/app/(app)/secretaria/CondicoesEncerramento.tsx", nome: "ternário v.status", motivo: "versão das condições de encerramento: \"Aguardando aprovação\" diz quem age" },
  { arquivo: "src/app/(app)/matriculas/[id]/condicoes-horas/CondicoesHoras.tsx", nome: "ternário v.status", motivo: "versão das condições de horas aguarda REVISÃO da gestão (\"Aguardando revisão\")" },
  { arquivo: "src/app/(app)/matriculas/[id]/continuidade-mensal/CondicoesContinuidadeMensal.tsx", nome: "ternário versao.status", motivo: "versão das condições de continuidade aguarda REVISÃO da gestão (\"Aguardando revisão\")" },
  { arquivo: "src/app/(app)/matriculas/[id]/compensacoes/[cobrancaId]/CompensacaoCobertura.tsx", nome: "ternário proposta.status", motivo: "frase do direito à compensação (\"Direito aprovado\", \"Proposta rejeitada\")" },
  { arquivo: "src/app/(app)/academico/equivalencias/[propostaId]/page.tsx", nome: "ternário proposta.estado", motivo: "frases do fluxo de equivalência (\"Autorizada para execução\"), as mesmas de nomesEstado na lista" },
  { arquivo: "src/app/(app)/academico/recuperacoes/AgendaPublicada.tsx", nome: "ternário agenda.status", motivo: "frase do encontro publicado (\"Realização registrada\", \"Encontro previsto\")" },
  { arquivo: "src/app/(app)/academico/correcoes/page.tsx", nome: "ternário i.tipo", motivo: "texto do link de ação por destino (\"Conferir histórico da aula\")" },
  { arquivo: "src/app/(app)/diario/encontros/[id]/correcao/CorrecaoAula.tsx", nome: "ternário reposicao.agendaParticular.statusBeneficio", motivo: "fragmento minúsculo no meio da frase do benefício (\"benefício reservado\", \"isenção excepcional registrada\")" },
  { arquivo: "src/app/(app)/diario/encontros/[id]/OcorrenciaParticular.tsx", nome: "nomes", motivo: "opção do informe docente, na voz do professor (\"Aluno faltou\", \"Cancelada pela escola\")" },
  { arquivo: "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/SegundaChamadaPainel.tsx", nome: "override item.reserva.status", motivo: "frase explicativa das reservas consumidas/liberadas (\"consumida por falta; encontro não realizado\"); as demais vêm do mapa central" },
  { arquivo: "src/app/(app)/financeiro/AcessoAulasPainel.tsx", nome: "ternário m.status", motivo: "frase do acesso às aulas sob a guarda da liberação (\"Contrato pausado\", \"Contrato não ativo…\")" },
  { arquivo: "src/app/(app)/leads/[id]/FichaLead.tsx", nome: "ternário lead.temperatura", motivo: "faixa de prioridade derivada da temperatura (Alta/Média/Baixa, doc 09), não o nome da temperatura" },
];
/** Mapas fora das telas (src/lib, src/server) que não são rótulo do valor: mensagens, frases de documento, regras. */
const MAPAS_DE_DOMINIO: { arquivo: string; nome: string; motivo: string }[] = [
  { arquivo: "src/server/matricula/desistencia-documental.ts", nome: "(literal em descricaoEstado)", motivo: "fragmento minúsculo no meio da frase do servidor (\"processo com envio incerto\"), não o nome do estado" },
  { arquivo: "src/server/portal-aluno/envio-resend.ts", nome: "ternário mensagem.finalidade", motivo: "assunto do e-mail por finalidade (\"Seu acesso ao portal da escola\"), frase e não o nome da finalidade" },
  { arquivo: "src/server/whatsapp/drivers/evolution.ts", nome: "MEDIATYPE", motivo: "valor técnico do payload da Evolution API (\"image\", \"video\"), não rótulo" },
  { arquivo: "src/server/whatsapp/drivers/meta-cloud.ts", nome: "CAMPO_MIDIA", motivo: "campo técnico do payload da Cloud API da Meta (\"image\", \"audio\"), não rótulo" },
];

describe("(ii) mapa de rótulo de enum só em src/lib/labels.ts", () => {
  // Enums do schema e os domínios dos mapas de labels.ts (ambiente da assinatura, desfecho de horas…).
  const enumsEMapas = new Map([...ENUMS, ...Object.entries(L).filter(([, v]) => ehMapaDeTexto(v)).map(([k, v]) => [`labels.${k}`, Object.keys(v as object)] as [string, string[]])]);
  const mapas = [...fontes, ...fontesDominio].flatMap(({ arquivo, conteudo }) => mapasDeRotulo(conteudo, enumsEMapas, arquivo).map((m) => ({ arquivo, ...m })));
  const EXCECOES = [...MAPAS_DE_TELA, ...MAPAS_DE_DOMINIO];

  it("nenhum arquivo fora de labels.ts define mapa de rótulo de enum fora das exceções (telas, src/lib e src/server)", () => {
    const fora = mapas.filter((m) => !EXCECOES.some((e) => e.arquivo === m.arquivo && e.nome === m.nome));
    expect(fora.map((m) => `${m.arquivo}:${m.linha} ${m.nome} (${m.enums.join("|")})`)).toEqual([]);
  });

  it("cada exceção casa com exatamente um mapa (exceção sem caso sai da lista)", () => {
    for (const e of EXCECOES) expect(mapas.filter((m) => m.arquivo === e.arquivo && m.nome === e.nome), `${e.arquivo}#${e.nome}`).toHaveLength(1);
  });

  it("a varredura cobre telas, src/lib (menos labels.ts) e src/server (R3 da #138, B13)", () => {
    expect(fontesDominio.some((f) => f.arquivo.startsWith("src/server/"))).toBe(true);
    expect(fontesDominio.some((f) => f.arquivo.startsWith("src/lib/"))).toBe(true);
    expect(fontesDominio.some((f) => f.arquivo === "src/lib/labels.ts")).toBe(false);
  });

  it("autoteste: o detector pega mapa tipado, sem tipo, inline e com aspas na chave; ignora de-para, classes e chave fora de enum", () => {
    const enums = new Map([["StatusX", ["ATIVA", "PAUSADA", "ENCERRADA"]], ["Habilidade", ["FALA", "LEITURA"]]]);
    const nomes = (fonte: string) => mapasDeRotulo(fonte, enums).map((m) => `${m.nome}:${m.enums.join("|")}`);
    expect(nomes('const r: Record<StatusX, string> = { ATIVA: "Ativa", PAUSADA: "Pausada", ENCERRADA: "Encerrada" };')).toEqual(["r:StatusX"]);
    expect(nomes('const nomes = { FALA: "Fala", LEITURA: "Leitura" };')).toEqual(["nomes:Habilidade"]);
    expect(nomes('const x = <p>{({ ATIVA: "Ativa", PAUSADA: "Pausada" })[s]}</p>;')).toEqual(["(literal na linha 1):StatusX"]);
    expect(nomes('const r = { "ATIVA": "ativa", "PAUSADA": "pausada" } satisfies Record<string, string>;')).toEqual(["r:StatusX"]);
    expect(nomes('const de = { ATIVA: "ATIVACAO", PAUSADA: "PAUSA" };')).toEqual([]);
    expect(nomes('const cls = { ATIVA: "bg-green-100 text-green-700", PAUSADA: "bg-amber-100" };')).toEqual([]);
    expect(nomes('const m = { ATIVA: "Ativa", OUTRA: "Outra" };')).toEqual([]);
    expect(nomes('const m = { ATIVA: { label: "Ativa" }, PAUSADA: { label: "Pausada" } };')).toEqual([]);
  });

  it("autoteste (R1 da #138, B2): spread do mapa central, valor por constante e mapa em ternário", () => {
    const enums = new Map([["StatusX", ["ATIVA", "PAUSADA", "ENCERRADA"]]]);
    const nomes = (fonte: string) => mapasDeRotulo(fonte, enums).map((m) => `${m.nome}:${m.enums.join("|")}`);
    expect(nomes('import { STATUS_X_LABEL } from "@/lib/labels"; const m = { ...STATUS_X_LABEL, ATIVA: "Em vigor" };')).toEqual(["m:...STATUS_X_LABEL"]);
    expect(nomes('import * as L from "@/lib/labels"; const m = { ...L.ROTULOS, PAUSADA: "Parada" };')).toEqual(["m:...L.ROTULOS"]);
    expect(nomes('const A = "Ativa", P = "Pausada"; const m = { ATIVA: A, PAUSADA: P };')).toEqual(["m:StatusX"]);
    expect(nomes('const r = <p>{s === "ATIVA" ? "Ativa" : s === "PAUSADA" ? "Pausada" : "Encerrada"}</p>;')).toEqual(["ternário s:StatusX"]);
    expect(nomes('const r = <p>{(d.status === "ATIVA") ? "Ativa" : (d.status === "PAUSADA" ? "Pausada" : "Encerrada")}</p>;')).toEqual(["ternário d.status:StatusX"]);
    // Não acusa: sim/não (uma comparação), sujeitos diferentes, classes, folha que não é texto, spread sem sobrescrever.
    expect(nomes([
      'const a = s === "ATIVA" ? "Ativa" : "Inativa";',
      'const b = s === "ATIVA" ? "Ativa" : t === "PAUSADA" ? "Pausada" : "Encerrada";',
      'const c = s === "ATIVA" ? "bg-green-50" : s === "PAUSADA" ? "bg-amber-50" : "bg-gray-50";',
      'const d = s === "ATIVA" ? rotulo : s === "PAUSADA" ? "Pausada" : "Encerrada";',
      'import { X_LABEL } from "@/lib/labels"; const e = { ...X_LABEL };',
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R2 da #138, B6): mapa misto, de uma chave, por API, por alias, switch, && e override", () => {
    const enums = new Map([["StatusX", ["ATIVA", "PAUSADA", "ENCERRADA"]], ["TipoY", ["FALTA", "REALIZADA"]]]);
    const nomes = (fonte: string) => mapasDeRotulo(fonte, enums).map((m) => m.nome);
    expect(nomes('const misto = { ATIVA: "Ativa", FALTA: "Falta" };')).toEqual(["misto"]);
    expect(nomes('const um = { ATIVA: "Em vigor" };')).toEqual(["um"]);
    expect(nomes('const c = { [StatusX.ATIVA]: "Ativa", ["PAUSADA"]: "Pausada" };')).toEqual(["c"]);
    expect(nomes('const s = { ATIVA: String("Ativa"), PAUSADA: "Pausada" };')).toEqual(["s"]);
    expect(nomes('import { STATUS_X_LABEL } from "@/lib/labels"; const base = STATUS_X_LABEL; const m = { ...base, ATIVA: "Em vigor" };')).toEqual(["m"]);
    expect(nomes('import { STATUS_X_LABEL } from "@/lib/labels"; const m = Object.assign({}, STATUS_X_LABEL, { ATIVA: "Em vigor" });')).toEqual(["m"]);
    expect(nomes('const mp = new Map([["ATIVA", "Ativa"], ["PAUSADA", "Pausada"]]); const fe = Object.fromEntries([["ATIVA", "Ativa"]]);')).toEqual(["mp", "fe"]);
    expect(nomes('function r(s: string) { switch (s) { case "ATIVA": return "Ativa"; case "PAUSADA": return "Pausada"; default: return "—"; } }')).toEqual(["switch s"]);
    expect(nomes('const t = s !== "ATIVA" ? (s === "PAUSADA" ? "Pausada" : "Encerrada") : "Ativa";')).toEqual(["ternário s"]);
    expect(nomes('const g = ok && s === "ATIVA" ? "Ativa" : ok && s === "PAUSADA" ? "Pausada" : "—";')).toEqual(["ternário s"]);
    expect(nomes('const j = <p>{s === "ATIVA" && "Ativa"}{s === "PAUSADA" && "Pausada"}</p>;')).toEqual(["série && s"]);
    expect(nomes('const o = s === "ATIVA" ? "Em vigor" : rotular(STATUS_X_LABEL, s);')).toEqual(["override s"]);
    // R3 da #138 (B7): a guarda de existência por cima não esconde o mapa.
    expect(nomes('const v = s ? (s === "ATIVA" ? "Ativa" : s === "PAUSADA" ? "Pausada" : "Encerrada") : "—";')).toEqual(["ternário s"]);
    // Não acusa: um && só, condição booleana, chave fora de enum, valor não texto.
    expect(nomes([
      'const a = <p>{s === "ATIVA" && "Ativa"}</p>;',
      'const b = ok ? "Sim" : "Não";',
      'const c = { OUTRA: "Outra" };',
      'const d = { ATIVA: 1, PAUSADA: 2 };',
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R3 da #138, B13): Enum.MEMBRO, if/return, lista de opções, par não reconhecido, Map.set e atribuição", () => {
    const enums = new Map([["StatusX", ["ATIVA", "PAUSADA", "ENCERRADA"]]]);
    const nomes = (fonte: string) => mapasDeRotulo(fonte, enums).map((m) => m.nome);
    expect(nomes('const t = s === StatusX.ATIVA ? "Ativa" : s === StatusX.PAUSADA ? "Pausada" : "Encerrada";')).toEqual(["ternário s"]);
    expect(nomes('const o = s === StatusX.ATIVA ? "Em vigor" : rotular(STATUS_X_LABEL, s);')).toEqual(["override s"]);
    expect(nomes('function f(s: string) { if (s === "ATIVA") return "Ativa"; if (s === "PAUSADA") return "Pausada"; return "Encerrada"; }')).toEqual(["if s"]);
    expect(nomes('function g(s: string) { if (s === "ATIVA") { return "Ativa"; } else if (s === StatusX.PAUSADA) return "Pausada"; else return "—"; }')).toEqual(["if s"]);
    expect(nomes('const opcoes = [{ valor: "ATIVA", rotulo: "Ativa" }, { valor: StatusX.PAUSADA, rotulo: "Pausada" }];')).toEqual(["opcoes"]);
    expect(nomes('const PAUSADA = "Pausada"; const a = { ATIVA: "Ativa", ENCERRADA: "Encer" + "rada" }; const b = { ...extra, PAUSADA: "Pausada" }; const c = { PAUSADA, ATIVA: 1 };')).toEqual(["a", "b", "c"]);
    expect(nomes('const m = new Map<string, string>(); m.set("ATIVA", "Ativa"); m.set("PAUSADA", "Pausada"); const r: Record<string, string> = {}; r.ATIVA = "Ativa"; r["PAUSADA"] = "Pausada";')).toEqual(["Map.set m", "atribuição r"]);
    expect(nomes('function d(s: string) { return ({ ATIVA: "ativa", PAUSADA: "pausada" } as const)[s]; }')).toEqual(["(literal em d)"]);
    // Não acusa: um if só, lista sem código, lista de ações, URLSearchParams.set, atribuição de campo comum, nome de evento.
    expect(nomes([
      'function h(s: string) { if (s === "ATIVA") return "Ativa"; return "—"; }',
      'const l = [{ href: "/a", rotulo: "A" }, { href: "/b", rotulo: "B" }];',
      'const acoes = [{ label: "Pausar", alvo: StatusX.PAUSADA }, { label: "Encerrar", alvo: StatusX.ENCERRADA }];',
      'p.set("status", "ATIVA"); x.nome = "Ana";',
      'const EVENTO = { ATIVA: "ContaAtivada", PAUSADA: "ContaPausada" };',
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R1 da #150, B2): lista de pares [código, texto] é mapa de rótulo, também `as const` e de um par", () => {
    const enums = new Map([["StatusX", ["ATIVA", "PAUSADA", "ENCERRADA"]]]);
    const nomes = (fonte: string) => mapasDeRotulo(fonte, enums).map((m) => m.nome);
    expect(nomes('const rotulosTurma = [["ATIVA", "Ativa"], ["PAUSADA", "Pausada"]] as const;')).toEqual(["rotulosTurma"]);
    expect(nomes('const PARES = [["ATIVA", "Ativa"]] as const;\nconst r = <p>{PARES.map(([v, t]) => (v === s ? t : "")).join("")}</p>;')).toEqual(["PARES"]);
    // Dentro de new Map/fromEntries conta uma vez só (no achado da chamada). Não acusa: pares sem texto, chave fora de enum.
    expect(nomes('const m = new Map([["ATIVA", "Ativa"]] as const);')).toEqual(["m"]);
    expect(nomes('const a = [["ATIVA", campo.valor], ["PAUSADA", outro]] as const; const b = [["OUTRA", "Outra"]];')).toEqual([]);
  });

  it("os mapas que as telas tinham soltos continuam fora delas (movidos para labels.ts)", () => {
    const fonte = (arquivo: string) => fontes.find((f) => f.arquivo === arquivo)?.conteudo ?? "";
    const MOVIDOS: [arquivo: string, trecho: string][] = [
      ["src/app/(app)/financeiro/FinanceiroPainel.tsx", "TIPO_APROVACAO_LABEL[a.tipo]"],
      ["src/app/(app)/configuracao/catalogo/PrecosPainel.tsx", "TIPO_COBRANCA_LABEL[p.tipoCobranca]"],
      ["src/app/(app)/configuracao/catalogo/ModalidadesPainel.tsx", "SEGMENTO_LABEL[m.segmento]"],
      ["src/components/CopilotoSugestoes.tsx", "rotular(ETAPA_LABEL, String(p.etapa))"],
      ["src/app/(app)/secretaria/avisos-agenda/page.tsx", "rotular(CANAL_AVISO_ALTERACAO_AGENDA_LABEL, i.canal)"],
      ["src/app/(app)/academico/segundas-chamadas/agendas/page.tsx", "const rotulosReserva = STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL;"],
      ["src/app/(app)/academico/avaliacoes/[alocacaoId]/page.tsx", "HABILIDADE_LABEL[h.habilidade]"],
    ];
    expect(MOVIDOS.filter(([arquivo, trecho]) => !fonte(arquivo).includes(trecho))).toEqual([]);
    // "Comunicação oral" era a redação divergente de FALA em três telas; o mapa central usa "Fala".
    expect(fontes.filter((f) => f.conteudo.includes("Comunicação oral")).map((f) => f.arquivo)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// (iii) labels.ts: lista fechada de exports; mapas novos cobrem o enum inteiro, em texto de gente
// ---------------------------------------------------------------------------------------------------

/** Siglas que ficam em maiúscula dentro de um rótulo. */
const SIGLAS = new Set(["PIX", "B2B", "CPF", "CNPJ", "PDF", "IA", "UTC", "ID", "API", "ERP"]);
/** Nomes próprios e marcas que mantêm a maiúscula no meio do rótulo. */
const NOMES_PROPRIOS = new Set(["WhatsApp", "Meta", "Q10"]);
export const palavrasEmCaixaAlta = (rotulo: string) => rotulo.split(/[^A-Za-zÀ-ÿ0-9]+/).filter((p) => /^[A-ZÀ-Þ]{2,}$/.test(p) && !SIGLAS.has(p));
/** Palavras depois da primeira com maiúscula inicial (Title Case) ou caixa misturada, fora de siglas e nomes próprios. */
export const foraDeSentenceCase = (rotulo: string) => rotulo.split(/[^A-Za-zÀ-ÿ0-9]+/).filter(Boolean).filter((p, i) => !SIGLAS.has(p) && !NOMES_PROPRIOS.has(p)
  && ((i > 0 && /^[A-ZÀ-Þ]/.test(p)) || /[a-zà-ÿ][A-ZÀ-Þ]/.test(p) || /^[A-ZÀ-Þ]{2,}[a-zà-ÿ]/.test(p)));
/** Rótulo é nome: termina sem pontuação — qualquer `\p{P}` ("…", "‥", ")"; R3 da #138, B14) — salvo o parêntese que
 * fecha um aberto ("Simulada (ensaio)"). */
const PONTUACAO_FINAL = /\p{P}$/u;
const parentesesFechados = (r: string) => {
  let abertos = 0;
  for (const ch of r) { if (ch === "(" || ch === "[") abertos++; if (ch === ")" || ch === "]") abertos--; if (abertos < 0) return false; }
  return abertos === 0;
};
/** Espaço (também NBSP e separadores Unicode) nas pontas; caractere invisível ou de controle (`\p{C}`: ZWSP, soft hyphen…). */
const BORDA_EM_BRANCO = /^[\s\p{Z}]|[\s\p{Z}]$/u;
const INVISIVEL = /\p{C}/u;

/**
 * Problemas de formato de um rótulo — a MESMA função serve ao laço dos mapas e ao autoteste (R3 da #138, B15/G9).
 * Rótulo é texto de gente: não vazio, não repete o código, tem minúscula, sem palavra em CAIXA ALTA fora das siglas,
 * sem pontuação final, sem espaço nas pontas nem caractere invisível, em sentence case, sem "_", com maiúscula inicial.
 */
export function problemasDeFormato(rotulo: unknown, codigo?: string): string[] {
  if (typeof rotulo !== "string") return ["não é texto"];
  if (!rotulo.trim()) return ["vazio"];
  const p: string[] = [];
  if (rotulo === codigo) p.push("repete o código");
  if (!/[a-zà-ÿ]/.test(rotulo)) p.push("sem minúscula");
  if (palavrasEmCaixaAlta(rotulo).length) p.push("palavra em CAIXA ALTA");
  if (PONTUACAO_FINAL.test(rotulo) && !(/[)\]]$/.test(rotulo) && parentesesFechados(rotulo))) p.push("pontuação final");
  if (BORDA_EM_BRANCO.test(rotulo)) p.push("espaço nas pontas");
  if (INVISIVEL.test(rotulo)) p.push("caractere invisível");
  if (foraDeSentenceCase(rotulo).length) p.push("fora de sentence case");
  if (rotulo.includes("_")) p.push('com "_"');
  if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(rotulo)) p.push("sem maiúscula inicial");
  return p;
}
/** Problemas de um mapa novo de labels.ts: chaves ≠ valores do domínio, valor que não é texto de gente, não congelado. */
export function problemasDoMapa(mapa: unknown, valores: readonly string[]): string[] {
  if (!mapa || typeof mapa !== "object") return ["não é mapa"];
  const p: string[] = [];
  const chaves = Object.keys(mapa).sort(), esperadas = [...valores].sort();
  if (chaves.join("|") !== esperadas.join("|")) p.push(`chaves [${chaves.join(", ")}] ≠ valores [${esperadas.join(", ")}]`);
  for (const [valor, rotulo] of Object.entries(mapa)) for (const f of problemasDeFormato(rotulo, valor)) p.push(`${valor}: ${f}`);
  if (!Object.isFrozen(mapa)) p.push("não congelado");
  return p;
}

/** Nomes exportados em tempo de execução por uma fonte (const/let/function/class/enum, `export { }`, `export default`,
 * `export *`); tipos não contam. */
export function exportadosEmExecucao(fonte: string, arquivo = "x.ts"): string[] {
  const sf = arvore(fonte, arquivo), nomes = new Set<string>();
  const tem = (st: ts.Node, k: ts.SyntaxKind) => ts.canHaveModifiers(st) && !!ts.getModifiers(st)?.some((m) => m.kind === k);
  const doPadrao = (p: ts.BindingName) => { if (ts.isIdentifier(p)) nomes.add(p.text); else for (const el of p.elements) if (!ts.isOmittedExpression(el)) doPadrao(el.name); };
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st) && tem(st, ts.SyntaxKind.ExportKeyword)) for (const d of st.declarationList.declarations) doPadrao(d.name);
    if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) && tem(st, ts.SyntaxKind.ExportKeyword)) nomes.add(tem(st, ts.SyntaxKind.DefaultKeyword) || !st.name ? "default" : st.name.text);
    if (ts.isExportDeclaration(st) && !st.isTypeOnly) {
      if (st.exportClause && ts.isNamedExports(st.exportClause)) { for (const e of st.exportClause.elements) if (!e.isTypeOnly) nomes.add(e.name.text); }
      else nomes.add("*");
    }
    if (ts.isExportAssignment(st)) nomes.add("default");
  }
  return [...nomes].sort();
}
/**
 * Mapas internos de uma fonte (objeto com chave de código e QUALQUER valor, ou `new Map`/`Object.fromEntries`) e os
 * usos que não são spread num mapa exportado — mapa interno servido por função escaparia da lista fechada
 * (R2/R3 da #138, B7/B14).
 */
export function mapasInternos(fonte: string, arquivo = "x.ts"): { internos: string[]; usosIndevidos: string[] } {
  const sf = arvore(fonte, arquivo);
  const exportado = (st: ts.Node) => ts.canHaveModifiers(st) && !!ts.getModifiers(st)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const mapaInterno = (e: ts.Expression): boolean => {
    const x = semEmbrulho(e);
    if (ts.isCallExpression(x) && x.expression.getText(sf) === "Object.freeze" && x.arguments[0]) return mapaInterno(x.arguments[0]);
    if ((ts.isNewExpression(x) && x.expression.getText(sf) === "Map") || (ts.isCallExpression(x) && x.expression.getText(sf) === "Object.fromEntries")) return true;
    return ts.isObjectLiteralExpression(x) && x.properties.some((p) => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))
      && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && CODIGO.test(p.name.text));
  };
  const internos = new Set<string>();
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st) || exportado(st)) continue;
    for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer && mapaInterno(d.initializer)) internos.add(d.name.text);
  }
  const usosIndevidos: string[] = [];
  visitar(sf, (n) => {
    if (!ts.isIdentifier(n) || !internos.has(n.text) || (ts.isVariableDeclaration(n.parent) && n.parent.name === n) || ts.isTypeQueryNode(n.parent)) return;
    let st: ts.Node = n;
    while (st.parent && !ts.isSourceFile(st.parent)) st = st.parent;
    if (!(ts.isSpreadAssignment(n.parent) && ts.isVariableStatement(st) && exportado(st))) usosIndevidos.push(`${n.text}:${linhaDe(sf, n)}`);
  });
  return { internos: [...internos].sort(), usosIndevidos };
}

/** Mapas de labels.ts anteriores à E5 (fora do laço de formato). */
const ANTIGOS = ["ETAPA_LABEL", "TEMPERATURA_LABEL", "SEGMENTO_LABEL", "MOTIVO_PERDA_LABEL", "STATUS_MATRICULA_LABEL", "STATUS_COBRANCA_LABEL",
  "STATUS_COMISSAO_LABEL", "STATUS_ALUNO_LABEL", "TIPO_COBRANCA_LABEL", "FORMA_PAGAMENTO_LABEL", "GENERO_LABEL", "ESCOLARIDADE_LABEL",
  "SITUACAO_RELATO_MATERIAL_REPOSICAO_LABEL", "STATUS_ENCONTRO_LABEL"];
const MAPAS_NOVOS: [nome: string, mapa: Readonly<Record<string, string>>, valores: readonly string[]][] = [
  ["HABILIDADE_LABEL", L.HABILIDADE_LABEL, HABILIDADES],
  ["STATUS_TURMA_LABEL", L.STATUS_TURMA_LABEL, Object.values(StatusTurma)],
  ["STATUS_MUDANCA_ACADEMICA_LABEL", L.STATUS_MUDANCA_ACADEMICA_LABEL, Object.values(StatusMudancaAcademica)],
  ["STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL", L.STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL, Object.values(StatusReservaSegundaChamada)],
  ["SITUACAO_NOTA_SEGUNDA_CHAMADA_LABEL", L.SITUACAO_NOTA_SEGUNDA_CHAMADA_LABEL, ["OFICIALIZADA", "REJEITADA", "SUBMETIDA", "RASCUNHO"]],
  ["SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL", L.SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL, Object.values(SituacaoPropostaQuantidadeAulas)],
  ["ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL", L.ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL, Object.values(AlcanceImpactoQuantidadeAulas)],
  ["PARTICIPACAO_AULA_LABEL", L.PARTICIPACAO_AULA_LABEL, Object.values(ParticipacaoAula)],
  ["FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL", L.FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL, Object.values(FinalidadeTokenPortalAluno)],
  ["SITUACAO_ENVIO_PORTAL_ALUNO_LABEL", L.SITUACAO_ENVIO_PORTAL_ALUNO_LABEL, Object.values(SituacaoEnvioPortalAluno)],
  ["SITUACAO_TROCA_EMAIL_PORTAL_ALUNO_LABEL", L.SITUACAO_TROCA_EMAIL_PORTAL_ALUNO_LABEL, Object.values(SituacaoTrocaEmailPortalAluno)],
  ["CANAL_AVISO_ALTERACAO_AGENDA_LABEL", L.CANAL_AVISO_ALTERACAO_AGENDA_LABEL, Object.values(CanalAvisoAlteracaoAgenda)],
  ["SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL", L.SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL, Object.values(SituacaoAvisoAlteracaoAgenda)],
  ["MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL", L.MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL, Object.values(MotivoPendenciaAvisoAgenda)],
  ["STATUS_RESERVA_VAGA_LABEL", L.STATUS_RESERVA_VAGA_LABEL, Object.values(StatusReservaVaga)],
  ["STATUS_CORRECAO_CADASTRO_LABEL", L.STATUS_CORRECAO_CADASTRO_LABEL, Object.values(StatusCorrecaoCadastro)],
  ["TIPO_PAGADOR_LABEL", L.TIPO_PAGADOR_LABEL, PagadorEntradaFinanceiraHistoricaSchema.shape.tipo.options],
  ["STATUS_SOLICITACAO_ENCERRAMENTO_LABEL", L.STATUS_SOLICITACAO_ENCERRAMENTO_LABEL, Object.values(StatusSolicitacaoEncerramento)],
  ["ESTADO_DIA_COMPENSACAO_LABEL", L.ESTADO_DIA_COMPENSACAO_LABEL, Object.values(EstadoDiaCompensacao)],
  ["ESTADO_ENVIO_ASSINATURA_LABEL", L.ESTADO_ENVIO_ASSINATURA_LABEL, Object.values(EstadoEnvioAssinatura)],
  ["TIPO_MOVIMENTACAO_LABEL", L.TIPO_MOVIMENTACAO_LABEL, Object.values(TipoMovimentacao)],
  ["RESULTADO_ENSAIO_VINCULO_MIGRACAO_LABEL", L.RESULTADO_ENSAIO_VINCULO_MIGRACAO_LABEL, Object.values(ResultadoEnsaioVinculoMigracao)],
  ["ESTADO_LINHA_PREPARACAO_MIGRACAO_LABEL", L.ESTADO_LINHA_PREPARACAO_MIGRACAO_LABEL, Object.values(EstadoLinhaPreparacaoMigracao)],
  ["SITUACAO_APLICACAO_CADASTRO_MIGRACAO_LABEL", L.SITUACAO_APLICACAO_CADASTRO_MIGRACAO_LABEL, Object.values(SituacaoAplicacaoCadastroMigracao)],
  ["CATEGORIA_DOCUMENTO_LABEL", L.CATEGORIA_DOCUMENTO_LABEL, Object.values(CategoriaDocumento)],
  ["STATUS_FATURA_B2B_LABEL", L.STATUS_FATURA_B2B_LABEL, Object.values(StatusFaturaB2B)],
  ["TIPO_SUGESTAO_IA_LABEL", L.TIPO_SUGESTAO_IA_LABEL, Object.values(TipoSugestaoIA)],
  ["STATUS_TEMPLATE_LABEL", L.STATUS_TEMPLATE_LABEL, Object.values(StatusTemplate)],
  ["TIPO_MENSAGEM_LABEL", L.TIPO_MENSAGEM_LABEL, Object.values(TipoMensagem)],
  ["STATUS_INTENCAO_LABEL", L.STATUS_INTENCAO_LABEL, Object.values(StatusIntencao)],
  ["TIPO_APROVACAO_LABEL", L.TIPO_APROVACAO_LABEL, Object.values(TipoAprovacao)],
  ["VIGENCIA_LABEL", L.VIGENCIA_LABEL, Object.values(Vigencia)],
  ["TIPO_AJUSTE_LABEL", L.TIPO_AJUSTE_LABEL, Object.values(TipoAjuste)],
  ["TIPO_DESTINACAO_RECEBIMENTO_LABEL", L.TIPO_DESTINACAO_RECEBIMENTO_LABEL, Object.values(TipoDestinacaoRecebimento)],
  ["ESTADO_PROPOSTA_DECIDIDA_LABEL", L.ESTADO_PROPOSTA_DECIDIDA_LABEL, ["PENDENTE", "APROVADA", "REJEITADA", "APLICADA"]],
  ["STATUS_PROPOSTA_ACERTO_TAXA_ADITIVO_LABEL", L.STATUS_PROPOSTA_ACERTO_TAXA_ADITIVO_LABEL, Object.values(StatusPropostaAcertoTaxaAditivo)],
  ["STATUS_PROPOSTA_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL", L.STATUS_PROPOSTA_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL, Object.values(StatusPropostaConciliacaoFinanceiraMigracao)],
  ["STATUS_PROPOSTA_ENTRADA_FINANCEIRA_HISTORICA_MIGRACAO_LABEL", L.STATUS_PROPOSTA_ENTRADA_FINANCEIRA_HISTORICA_MIGRACAO_LABEL, Object.values(StatusPropostaEntradaFinanceiraHistoricaMigracao)],
  ["STATUS_PROPOSTA_PRESENCA_HISTORICA_MIGRACAO_LABEL", L.STATUS_PROPOSTA_PRESENCA_HISTORICA_MIGRACAO_LABEL, Object.values(StatusPropostaPresencaHistoricaMigracao)],
  ["STATUS_CONJUNTO_IMPACTOS_TAXA_ADITIVO_LABEL", L.STATUS_CONJUNTO_IMPACTOS_TAXA_ADITIVO_LABEL, Object.values(StatusConjuntoImpactosTaxaAditivo)],
  ["STATUS_CONJUNTO_IMPACTOS_COBERTURA_ADITIVO_LABEL", L.STATUS_CONJUNTO_IMPACTOS_COBERTURA_ADITIVO_LABEL, Object.values(StatusConjuntoImpactosCoberturaAditivo)],
  ["DECISAO_IMPACTO_TAXA_ADITIVO_LABEL", L.DECISAO_IMPACTO_TAXA_ADITIVO_LABEL, Object.values(DecisaoImpactoTaxaAditivo)],
  ["CLASSIFICACAO_IMPACTO_COBERTURA_ADITIVO_LABEL", L.CLASSIFICACAO_IMPACTO_COBERTURA_ADITIVO_LABEL, Object.values(ClassificacaoImpactoCoberturaAditivo)],
  ["MODALIDADE_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL", L.MODALIDADE_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL, Object.values(ModalidadeConciliacaoFinanceiraMigracao)],
  ["ESTADO_RESERVA_DEVOLUCAO_CREDITO_LABEL", L.ESTADO_RESERVA_DEVOLUCAO_CREDITO_LABEL, Object.values(EstadoReservaDevolucaoCredito)],
  ["ESTADO_RECONFERENCIA_DELTA_DESISTENCIA_LABEL", L.ESTADO_RECONFERENCIA_DELTA_DESISTENCIA_LABEL, Object.values(EstadoReconferenciaDeltaDesistencia)],
  ["UNIDADE_PERMUTA_SERVICO_LABEL", L.UNIDADE_PERMUTA_SERVICO_LABEL, Object.values(UnidadePermutaServico)],
  // Revisão R1 da #138 (B2/B4): mapas que viviam em ternário ou faltavam.
  ["STATUS_PAGAMENTO_INFORMADO_LABEL", L.STATUS_PAGAMENTO_INFORMADO_LABEL, Object.values(StatusPagamentoInformado)],
  ["AMBIENTE_ASSINATURA_LABEL", L.AMBIENTE_ASSINATURA_LABEL, ["SANDBOX", "PRODUCAO"]],
  ["TIPO_OCORRENCIA_HORAS_LABEL", L.TIPO_OCORRENCIA_HORAS_LABEL, OcorrenciaHorasSchema.innerType().shape.ocorrencia.options.map((o) => o.shape.tipo.value)],
  ["DESFECHO_OCORRENCIA_HORAS_LABEL", L.DESFECHO_OCORRENCIA_HORAS_LABEL, SaldoCompraHorasSchema.innerType().shape.reservas.element.shape.desfecho.options.filter((d) => d !== "PENDENTE")],
  ["TIPO_COBRANCA_ENTRADA_LABEL", L.TIPO_COBRANCA_ENTRADA_LABEL, ["MATRICULA", "MENSALIDADE", "HORA_PARTICULAR"]],
  ["REFERENCIA_COBERTURA_MENSAL_LABEL", L.REFERENCIA_COBERTURA_MENSAL_LABEL, Object.values(ReferenciaCoberturaMensal)],
  ["FINALIDADE_NUMERO_LABEL", L.FINALIDADE_NUMERO_LABEL, Object.values(FinalidadeNumero)],
  ["FORMA_AGENDA_OFERTA_LABEL", L.FORMA_AGENDA_OFERTA_LABEL, Object.values(FormaAgendaOferta)],
  // R3 da #138 (B13): o mapa por extenso que vivia em server/whatsapp/cron-gestao.ts.
  ["ETAPA_EXTENSO_LABEL", L.ETAPA_EXTENSO_LABEL, Object.values(EtapaLead)],
  // Veio de src/lib/roles.ts (R3 da #138, B13; R1 da #150, B4: conferido como os novos); roles.ts só o reexporta.
  ["PAPEL_LABEL", L.PAPEL_LABEL, Object.values(Papel)],
];
/** Lista fechada do que labels.ts exporta em tempo de execução (R3 da #138, B14): `rotular`, as classes de temperatura,
 * os mapas antigos e os mapas novos. Função exportada (`rotuloTurma` com ternário) ou mapa novo fora da lista falha. */
const EXPORTS_DE_LABELS = ["rotular", "TEMPERATURA_CLS", ...ANTIGOS, ...MAPAS_NOVOS.map(([nome]) => nome)].sort();

describe("(iii) labels.ts: exports e mapas novos", () => {
  for (const [nome, mapa, valores] of MAPAS_NOVOS) {
    it(`${nome}: chaves = valores do enum; rótulo em texto de gente; congelado`, () => {
      expect(problemasDoMapa(mapa, valores), nome).toEqual([]);
    });
  }

  it("labels.ts só exporta rotular e os mapas listados (lista fechada — R3 da #138, B14)", () => {
    expect(exportadosEmExecucao(readFileSync("src/lib/labels.ts", "utf-8"), "src/lib/labels.ts")).toEqual(EXPORTS_DE_LABELS);
    expect(Object.keys(L).filter((k) => k !== "__esModule").sort()).toEqual(EXPORTS_DE_LABELS);
  });

  it("todo mapa de texto novo de labels.ts está nesta lista, com ou sem _LABEL (mapa novo sem trava não passa)", () => {
    // Todo mapa de texto exportado, com ou sem o sufixo _LABEL (revisão R1 da #138: `ROTULOS_TURMA` passava).
    const exportados = Object.entries(L).filter(([k, v]) => ehMapaDeTexto(v) && !ANTIGOS.includes(k)).map(([k]) => k);
    expect(exportados.filter((k) => !MAPAS_NOVOS.some(([nome]) => nome === k))).toEqual([]);
  });

  it("mapa interno de labels.ts só serve de base, por spread, a mapa exportado (revisões R2/R3 da #138, B7/B14)", () => {
    const { internos, usosIndevidos } = mapasInternos(readFileSync("src/lib/labels.ts", "utf-8"), "src/lib/labels.ts");
    expect(internos).toEqual(["CONJUNTO_IMPACTOS", "PROPOSTA_DECIDIDA"]);
    expect(usosIndevidos).toEqual([]);
  });

  it("autoteste (R3 da #138, B14/B15): a função de formato pega cada disfarce — a mesma do laço dos mapas", () => {
    const tem = (rotulo: unknown, problema: string, codigo?: string) => expect(problemasDeFormato(rotulo, codigo), JSON.stringify(rotulo)).toContain(problema);
    tem("Concluída…", "pontuação final");
    tem("Concluída‥", "pontuação final");
    tem("Concluída)", "pontuação final");
    tem("Concluída.", "pontuação final");
    tem("Concluída\u200b", "caractere invisível");
    tem("Conclu\u00adída", "caractere invisível");
    tem("Concluída ", "espaço nas pontas");
    tem("Concluída\u00a0", "espaço nas pontas");
    tem("Em Andamento", "fora de sentence case");
    tem("Em ANDAMENTo", "fora de sentence case");
    tem("EM ANDAMENTO", "palavra em CAIXA ALTA");
    tem("EM ANDAMENTO", "sem minúscula");
    tem("Em_andamento", 'com "_"');
    tem("concluída", "sem maiúscula inicial");
    tem("CONCLUIDA", "repete o código", "CONCLUIDA");
    expect(problemasDeFormato("")).toEqual(["vazio"]);
    expect(problemasDeFormato(1)).toEqual(["não é texto"]);
    // Passam: rótulo limpo, parêntese que fecha um aberto, siglas e nomes próprios.
    for (const ok of ["Concluída", "Simulada (ensaio)", "Na fila (aguardando janela)", "Envio pelo WhatsApp via API", "Concluída via API, com PIX"]) expect(problemasDeFormato(ok), ok).toEqual([]);
  });

  it("autoteste (R3 da #138, B14): mapa com valor não texto, função exportada e mapa interno servido por função", () => {
    expect(problemasDoMapa({ PLANEJADA: "PLANEJADA", ABERTA: "EM_ABERTO", ordem: 1 }, ["PLANEJADA", "ABERTA"])).toEqual([
      "chaves [ABERTA, PLANEJADA, ordem] ≠ valores [ABERTA, PLANEJADA]",
      "PLANEJADA: repete o código", "PLANEJADA: sem minúscula", "PLANEJADA: palavra em CAIXA ALTA",
      "ABERTA: sem minúscula", "ABERTA: palavra em CAIXA ALTA", "ABERTA: fora de sentence case", 'ABERTA: com "_"',
      "ordem: não é texto", "não congelado",
    ]);
    expect(exportadosEmExecucao([
      'export function rotuloTurma(s: string) { return s === "PLANEJADA" ? "PLANEJADA" : "—"; }',
      "export type T = 1;",
      "export const A = 1, B = 2;",
      "const c = 3;",
      "export { c as D };",
      "export type { T as U };",
    ].join("\n"))).toEqual(["A", "B", "D", "rotuloTurma"]);
    expect(mapasInternos([
      'const M = { PLANEJADA: String("PLANEJADA") };',
      "export const f = (s: string) => M[s];",
      'const N = new Map([["PLANEJADA", "Planejada"]]);',
      "export function g(s: string) { return N.get(s); }",
      'const B = { ABERTA: "Aberta" } as const;',
      "export const X = Object.freeze({ ...B });",
    ].join("\n"))).toEqual({ internos: ["B", "M", "N"], usosIndevidos: ["M:2", "N:4"] });
  });

  it("autoteste (R1 da #138, B3): caixa alta disfarçada com pontuação ou acento; siglas passam", () => {
    expect(palavrasEmCaixaAlta("EM ANDAMENTO.")).toEqual(["EM", "ANDAMENTO"]);
    expect(palavrasEmCaixaAlta("CONCLUÍDA")).toEqual(["CONCLUÍDA"]);
    expect(palavrasEmCaixaAlta("Concluída via API, com PIX")).toEqual([]);
    expect(foraDeSentenceCase("Em Andamento")).toEqual(["Andamento"]);
    expect(foraDeSentenceCase("Em ANDAMENTo")).toEqual(["ANDAMENTo"]);
    expect(foraDeSentenceCase("Envio pelo WhatsApp via API")).toEqual([]);
  });

  it("rotular devolve o rótulo e, para valor sem rótulo, o próprio valor (nunca frase inventada)", () => {
    expect(L.rotular(L.HABILIDADE_LABEL, "COMPREENSAO_ORAL")).toBe("Compreensão oral");
    // Valor vindo do banco fora do enum atual (registro antigo): tipado como string, não como literal.
    const valorAntigo: string = "VALOR_ANTIGO";
    expect(L.rotular(L.STATUS_RESERVA_VAGA_LABEL, valorAntigo)).toBe("VALOR_ANTIGO");
  });

  it("autoteste: o leitor de enums do schema separa nome e valores, ignorando comentários", () => {
    const enums = enumsDoSchema("enum StatusX {\n  ATIVA // comentário\n  PAUSADA\n}\n\nmodel M {\n  id String\n}\nenum Outro {\n  A_B\n}\n");
    expect([...enums]).toEqual([["StatusX", ["ATIVA", "PAUSADA"]], ["Outro", ["A_B"]]]);
    expect(ENUMS.get("StatusEncontroAgenda")).toEqual(Object.values(StatusEncontroAgenda));
  });
});
