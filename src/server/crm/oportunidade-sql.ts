import { Prisma } from "@prisma/client";

/**
 * Tradução para SQL do `where` de Oportunidade (tabela "Lead") usado pelo funil e pela carteira (B19, #196 C3 e
 * #198 C2). Essas telas montam o filtro uma vez, em Prisma (escopo comercial + filtros da URL), e a parte que o
 * Prisma não ordena nem filtra sozinho (o último Evento de cada oportunidade, as mensagens) roda em SQL cru com
 * esta tradução. Só cobre as formas que essas telas usam; qualquer outra forma é RECUSADA com erro, nunca
 * ignorada, para que um filtro novo (ou um escopo novo) não suma em silêncio da consulta.
 *
 * A semântica segue a do Prisma no Postgres: `contains` com `mode: "insensitive"` vira `ILIKE '%valor%'` sem
 * escapar `%` e `_` (o Prisma também não escapa), `in: []` não casa nada, `OR: []` é falso e `AND: []` verdadeiro.
 */

const COLUNAS_TEXTO = new Set(["id", "vendedorDonoId", "nome", "codigo"]);
const COLUNAS_ENUM: Record<string, string> = { etapa: "EtapaLead", temperatura: "Temperatura", origemCanal: "OrigemCanal" };
const COLUNAS_BOOLEANAS = new Set(["b2b"]);
/** Colunas NOT NULL: só nelas o `not` do Prisma é um simples `<>` (nas que aceitam nulo ele também deixaria o nulo de fora). */
const COLUNAS_NAO_NULAS = new Set(["id", "nome", "etapa", "temperatura", "b2b"]);
const BUSCAVEIS = new Set(["nome", "codigo"]);

const VERDADEIRO = Prisma.sql`TRUE`;
const FALSO = Prisma.sql`FALSE`;

function naoSuportado(o: string): never {
  throw new Error(`Filtro de oportunidade não suportado na consulta em SQL: ${o}.`);
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);

function juntar(partes: Prisma.Sql[], operador: "AND" | "OR"): Prisma.Sql {
  if (partes.length === 0) return operador === "AND" ? VERDADEIRO : FALSO;
  if (partes.length === 1) return partes[0];
  return Prisma.sql`(${Prisma.join(partes.map((p) => Prisma.sql`(${p})`), ` ${operador} `)})`;
}

function valorDaColuna(campo: string, valor: unknown): Prisma.Sql {
  const tipo = COLUNAS_ENUM[campo];
  if (tipo) {
    if (typeof valor !== "string") naoSuportado(`${campo} com valor não textual`);
    return Prisma.sql`CAST(${valor} AS ${Prisma.raw(`"${tipo}"`)})`;
  }
  if (COLUNAS_BOOLEANAS.has(campo)) {
    if (typeof valor !== "boolean") naoSuportado(`${campo} com valor não booleano`);
    return Prisma.sql`${valor}`;
  }
  if (typeof valor !== "string") naoSuportado(`${campo} com valor não textual`);
  return Prisma.sql`${valor}`;
}

function condicaoDaColuna(alias: string, campo: string, filtro: unknown): Prisma.Sql {
  const coluna = Prisma.raw(`${alias}."${campo}"`);
  if (filtro === null) return Prisma.sql`${coluna} IS NULL`;
  if (!ehObjeto(filtro)) return Prisma.sql`${coluna} = ${valorDaColuna(campo, filtro)}`;
  const chaves = Object.keys(filtro);
  if (chaves.length === 1 && chaves[0] === "in" && Array.isArray(filtro.in)) {
    if (filtro.in.length === 0) return FALSO;
    return Prisma.sql`${coluna} IN (${Prisma.join(filtro.in.map((v) => valorDaColuna(campo, v)), ",")})`;
  }
  if (chaves.length === 1 && chaves[0] === "not" && COLUNAS_NAO_NULAS.has(campo) && filtro.not !== null && !ehObjeto(filtro.not)) {
    return Prisma.sql`${coluna} <> ${valorDaColuna(campo, filtro.not)}`;
  }
  if (
    BUSCAVEIS.has(campo) &&
    chaves.length === 2 &&
    typeof filtro.contains === "string" &&
    filtro.mode === "insensitive"
  ) {
    return Prisma.sql`${coluna} ILIKE ${`%${filtro.contains}%`}`;
  }
  return naoSuportado(`${campo} ${JSON.stringify(filtro)}`);
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function condicaoDeRelacao(alias: string, campo: string, filtro: unknown): Prisma.Sql {
  // Tag da pessoa titular: { pessoa: { is: { tags: { some: { tagId } } } } }.
  if (campo === "pessoa" && ehObjeto(filtro) && ehObjeto(filtro.is) && Object.keys(filtro).length === 1) {
    const is = filtro.is;
    const some = ehObjeto(is.tags) && Object.keys(is).length === 1 && Object.keys(is.tags).length === 1 ? is.tags.some : undefined;
    if (ehObjeto(some) && Object.keys(some).length === 1 && typeof some.tagId === "string") {
      return Prisma.sql`EXISTS (SELECT 1 FROM "PessoaTag" pt WHERE pt."pessoaId" = ${Prisma.raw(`${alias}."pessoaId"`)} AND pt."tagId" = ${some.tagId})`;
    }
  }
  // Turma ativa da matrícula: { matricula: { is: { alocacoes: { some: { ativa: true } } } } }.
  if (campo === "matricula" && igual(filtro, { is: { alocacoes: { some: { ativa: true } } } })) {
    return Prisma.sql`EXISTS (SELECT 1 FROM "Matricula" mt JOIN "AlocacaoTurma" al ON al."matriculaId" = mt."id" WHERE mt."leadId" = ${Prisma.raw(`${alias}."id"`)} AND al."ativa" = TRUE)`;
  }
  return naoSuportado(`${campo} ${JSON.stringify(filtro)}`);
}

/** Condição SQL equivalente ao `where` do Prisma, sobre a tabela "Lead" com o apelido `alias`. */
export function whereOportunidadeEmSql(where: Prisma.OportunidadeWhereInput, alias = "o"): Prisma.Sql {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) naoSuportado(`apelido ${alias}`);
  const partes: Prisma.Sql[] = [];
  for (const [campo, filtro] of Object.entries(where)) {
    if (filtro === undefined) continue;
    if (campo === "AND") {
      const lista = (Array.isArray(filtro) ? filtro : [filtro]) as Prisma.OportunidadeWhereInput[];
      partes.push(juntar(lista.map((w) => whereOportunidadeEmSql(w, alias)), "AND"));
    } else if (campo === "OR") {
      if (!Array.isArray(filtro)) naoSuportado("OR fora de lista");
      partes.push(juntar((filtro as Prisma.OportunidadeWhereInput[]).map((w) => whereOportunidadeEmSql(w, alias)), "OR"));
    } else if (COLUNAS_TEXTO.has(campo) || campo in COLUNAS_ENUM || COLUNAS_BOOLEANAS.has(campo)) {
      partes.push(condicaoDaColuna(alias, campo, filtro));
    } else if (campo === "pessoa" || campo === "matricula") {
      partes.push(condicaoDeRelacao(alias, campo, filtro));
    } else {
      naoSuportado(campo);
    }
  }
  return juntar(partes, "AND");
}
