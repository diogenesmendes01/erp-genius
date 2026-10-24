import { normalizarParaOrdenacao } from "./nome-ordenacao";
/** Texto público e coordenadas UTF16; IDs só via metadados opcionais, nunca HTML no texto. */
export interface TokenMencao { usuarioId: string; inicio: number; fim: number }
export interface PessoaMencao { id: string; nome: string }
export interface CandidatoMencao extends PessoaMencao { descricao: string }
const alias = (v: string) => normalizarParaOrdenacao(v);
const letra = (v: string) => /^[\p{L}\p{N}_]/u.test(v);
const limiteUtf16 = (v: string, n: number) => !(n > 0 && n < v.length && /[\uD800-\uDBFF]/.test(v[n - 1]) && /[\uDC00-\uDFFF]/.test(v[n]));

/** Metadados usam a NOTA NORMALIZADA, não a posição no texto bruto do textarea. */
export function normalizarNotaComMencoes(texto: string, mencoes?: readonly TokenMencao[]): { nota: string; mencoes?: TokenMencao[] } {
  // Sem o campo novo: preservar exatamente trim/hash/payload de #166, inclusive CRLF legado.
  if (mencoes === undefined) return { nota: texto.trim() };
  const nota = texto.replace(/\r\n?/g, "\n").trim();
  if (!Array.isArray(mencoes) || mencoes.length > 50) throw new Error("Menções inválidas.");
  const tokens = mencoes.map(t => {
    if (!t || typeof t.usuarioId !== "string" || !t.usuarioId || t.usuarioId.length > 200 || !Number.isInteger(t.inicio) || !Number.isInteger(t.fim)
      || t.inicio < 0 || t.fim <= t.inicio || t.fim > nota.length || !limiteUtf16(nota, t.inicio) || !limiteUtf16(nota, t.fim)
      || nota[t.inicio] !== "@" || (t.inicio > 0 && /[\p{L}\p{N}_@.]/u.test(nota[t.inicio - 1])) || letra(nota.slice(t.fim, t.fim + 2))) throw new Error("Menções inválidas.");
    return { usuarioId: t.usuarioId, inicio: t.inicio, fim: t.fim };
  }).sort((a, b) => a.inicio - b.inicio || a.fim - b.fim || a.usuarioId.localeCompare(b.usuarioId));
  if (tokens.some((t, i) => i > 0 && t.inicio < tokens[i - 1].fim)) throw new Error("Menções sobrepostas.");
  return { nota, mencoes: tokens };
}

/** Entrada da UI é bruta; o comando é uma cópia canônica nas coordenadas já normalizadas. */
export function comandoDaNota(texto: string, tokens: readonly TokenMencao[]): { nota: string; mencoes?: TokenMencao[] } {
  if (!tokens.length) return normalizarNotaComMencoes(texto);
  const semCr = texto.replace(/\r\n?/g, "\n");
  const corte = semCr.length - semCr.trimStart().length;
  const posicao = (n: number) => texto.slice(0, n).replace(/\r\n?/g, "\n").length - corte;
  return normalizarNotaComMencoes(texto, tokens.map(t => ({ usuarioId: t.usuarioId, inicio: posicao(t.inicio), fim: posicao(t.fim) })));
}

/** Grupos lexicais por ocorrencia, do alias mais longo ao mais curto.
 * Conserva TODOS os membros, sem decidir identidade ou permissao. O produtor
 * verifica ACL do grupo inteiro antes de decidir se precisa do proximo alias.
 * Recebe texto livre com os tokens por ID ja mascarados pelo produtor.
 */
export function gruposLexicaisMencao<T extends PessoaMencao>(textoLivre: string, pessoas: readonly T[]): T[][][] {
  const mapa = new Map<string, T[]>();
  for (const p of pessoas) for (const nome of new Set([alias(p.nome), alias(p.nome.split(/\s+/)[0])])) {
    if (!nome) continue;
    const grupo = mapa.get(nome) ?? []; grupo.push(p); mapa.set(nome, grupo);
  }
  const nomes = [...mapa.keys()].sort((a, b) => b.length - a.length);
  const normal = alias(textoLivre);
  return [...normal.matchAll(/(?<![\p{L}\p{N}_@.])@/gu)].map(inicio => {
    const resto = normal.slice(inicio.index + 1);
    return nomes.filter(nome => resto.startsWith(nome) && !letra(resto.slice(nome.length, nome.length + 2)))
      .map(nome => mapa.get(nome)!);
  });
}

/** Autor/ACL são filtrados pelo servidor; aqui só identidades explicitamente fornecidas. */
export function extrairMencoes(texto: string, pessoas: readonly PessoaMencao[], tokens: readonly TokenMencao[] = [], textoLivre = true): string[] {
  const validos = normalizarNotaComMencoes(texto, tokens).mencoes!;
  const ids = new Set<string>();
  for (const t of validos) {
    const p = pessoas.find(p => p.id === t.usuarioId);
    // Destinatário revogado/inativo é removido pelo produtor, sem transformar a nota em erro.
    if (!p) continue;
    const nome = alias(texto.slice(t.inicio + 1, t.fim));
    if (nome !== alias(p.nome)) throw new Error("A menção não corresponde à pessoa selecionada.");
    ids.add(p.id);
  }
  if (!textoLivre) return [...ids];
  // Retirar trechos selecionados evita casar o primeiro nome de um homônimo no mesmo token.
  let livre = texto;
  for (const t of [...validos].reverse()) livre = livre.slice(0, t.inicio) + " ".repeat(t.fim - t.inicio) + livre.slice(t.fim);
  const mapa = new Map<string, Set<string>>();
  for (const p of pessoas) for (const nome of new Set([alias(p.nome), alias(p.nome.split(/\s+/)[0])])) {
    if (!nome) continue;
    const grupo = mapa.get(nome) ?? new Set<string>(); grupo.add(p.id); mapa.set(nome, grupo);
  }
  const nomes = [...mapa.keys()].sort((a, b) => b.length - a.length);
  const normal = alias(livre);
  for (const inicio of normal.matchAll(/(?<![\p{L}\p{N}_@.])@/gu)) {
    const resto = normal.slice(inicio.index + 1);
    const nome = nomes.find(n => resto.startsWith(n) && !letra(resto.slice(n.length, n.length + 2)));
    if (nome && mapa.get(nome)!.size === 1) ids.add([...mapa.get(nome)!][0]);
  }
  return [...ids];
}

/** Uma edição antes/dentro invalida; não remapear identidade de homônimo por suposição. */
export function tokensAposEdicao(antes: string, depois: string, tokens: readonly TokenMencao[]): TokenMencao[] {
  if (antes === depois) return tokens.map(t => ({ ...t }));
  let inicio = 0;
  while (inicio < antes.length && inicio < depois.length && antes[inicio] === depois[inicio]) inicio++;
  return tokens.filter(t => inicio >= t.fim && !(inicio === t.fim && letra(depois.slice(inicio, inicio + 2)))).map(t => ({ ...t }));
}
export function consultaMencaoNoCursor(texto: string, cursor: number): { inicio: number; fim: number; busca: string } | null {
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > texto.length) return null;
  const m = texto.slice(0, cursor).match(/(?:^|[^\p{L}\p{N}_@.])(@[\p{L}\p{M}][\p{L}\p{M} -]{0,59})$/u);
  return m ? { inicio: cursor - m[1].length, fim: cursor, busca: m[1].slice(1) } : null;
}
