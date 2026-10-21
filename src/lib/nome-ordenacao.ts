// Ordenação de nomes com acento (D1, #141). O Postgres de produção (`postgres:16-alpine`) usa
// `datlocprovider=c`, sem ICU nem `unaccent`: "Álvaro" ia para depois de "Zé". A saída aprovada é
// uma coluna normalizada, GERADA pelo banco (`GENERATED ALWAYS AS … STORED`) nas tabelas das listas
// de nome (Aluno, Pessoa e Empresa — as duas últimas formam a lista de Contatos). Nenhum ponto da
// aplicação grava a coluna: o banco recalcula a cada INSERT/UPDATE, inclusive em SQL cru.
//
// A expressão usa só `translate`, `regexp_replace` e `btrim`, que não dependem de locale: as letras
// A–Z viram minúsculas pelo próprio `translate` (sem `lower()`, cujo resultado fora do ASCII varia
// entre glibc e musl). Este módulo é a fonte única do mapa: a migration copia o SQL gerado aqui e a
// trava `nome-ordenacao.test.ts` confere a cópia; `normalizarParaOrdenacao` é o espelho em TS.

/** Letra base (já minúscula) → variantes com acento, maiúsculas e minúsculas. */
const VARIANTES: ReadonlyArray<readonly [string, string]> = [
  ["a", "ÁÀÂÃÄÅĀĂĄáàâãäåāăą"],
  ["c", "ÇĆĈĊČçćĉċč"],
  ["d", "ĎĐďđ"],
  ["e", "ÉÈÊËĒĔĖĘĚéèêëēĕėęě"],
  ["g", "ĜĞĠĢĝğġģ"],
  ["h", "ĤĦĥħ"],
  ["i", "ÍÌÎÏĨĪĬĮİíìîïĩīĭįı"],
  ["j", "Ĵĵ"],
  ["k", "Ķķ"],
  ["l", "ĹĻĽĿŁĺļľŀł"],
  ["n", "ÑŃŅŇñńņň"],
  ["o", "ÓÒÔÕÖØŌŎŐóòôõöøōŏő"],
  ["r", "ŔŖŘŕŗř"],
  ["s", "ŚŜŞŠȘśŝşšș"],
  ["t", "ŢŤŦȚţťŧț"],
  ["u", "ÚÙÛÜŨŪŬŮŰŲúùûüũūŭůűų"],
  ["w", "Ŵŵ"],
  ["y", "ÝŸŶýÿŷ"],
  ["z", "ŹŻŽźżž"],
];

const MAIUSCULAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ESPACO_DURO = " ";
/** Diacríticos combinantes (U+0300–U+036F): texto em NFD ("A" + acento solto). Ficam no fim de `ORIGEM`, sem par em `DESTINO`, e por isso o `translate` os apaga. */
const COMBINANTES = Array.from({ length: 0x70 }, (_, i) => String.fromCharCode(0x300 + i)).join("");

/** 1º argumento do `translate`: cada caractere vira o da mesma posição em `DESTINO_ORDENACAO`; os que sobram (combinantes) somem. */
export const ORIGEM_ORDENACAO =
  VARIANTES.map(([, v]) => v).join("") + MAIUSCULAS + ESPACO_DURO + COMBINANTES;
/** 2º argumento do `translate`. */
export const DESTINO_ORDENACAO =
  VARIANTES.map(([base, v]) => base.repeat([...v].length)).join("") + MAIUSCULAS.toLowerCase() + " ";

/** A expressão SQL da coluna gerada, aplicada a `entradaSql` (uma coluna ou concatenação). */
export function expressaoOrdenacaoSql(entradaSql: string): string {
  return `btrim(regexp_replace(translate(${entradaSql}, '${ORIGEM_ORDENACAO}', '${DESTINO_ORDENACAO}'), '[[:space:]]+', ' ', 'g'))`;
}

const MAPA = new Map<string, string>();
{
  const origem = [...ORIGEM_ORDENACAO];
  const destino = [...DESTINO_ORDENACAO];
  origem.forEach((c, i) => MAPA.set(c, destino[i] ?? ""));
}

/**
 * Espelho em TS da coluna gerada: minúsculas sem acento, espaços repetidos colapsados, sem espaço
 * nas pontas. Fora do mapa, o caractere fica como está (igual ao banco).
 */
export function normalizarParaOrdenacao(nome: string): string {
  let saida = "";
  for (const c of nome) saida += MAPA.get(c) ?? c;
  // `[[:space:]]` no Postgres: espaço, \t, \n, \v, \f e \r.
  return saida.replace(/[ \t\n\v\f\r]+/g, " ").replace(/^ | $/g, "");
}
