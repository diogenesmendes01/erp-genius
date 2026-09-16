export type CelulaPlanilha = string | number | null;
export type CabecalhoPlanilha = { id: string; rotulo: string };
export type AbaPlanilha = { nome: string; cabecalhos: CabecalhoPlanilha[]; linhas: { numero: number; valores: Record<string, CelulaPlanilha> }[] };
export const CAMPOS_MIGRACAO = ["aluno.id", "aluno.nome", "aluno.email", "aluno.documento", "aluno.pais", "aluno.fuso", "turma.id", "turma.codigo", "turma.nome", "matricula.id", "matricula.situacao", "matricula.inicio", "matricula.fim", "matricula.produtoOrigem", "matricula.moeda", "matricula.pais", "alocacao.inicio", "alocacao.fim", "financeiro.id", "financeiro.tipo", "financeiro.valor", "financeiro.moeda", "financeiro.situacao", "consentimentoOrigem", "presencaOrigem"] as const;
export type CampoMigracao = typeof CAMPOS_MIGRACAO[number];
export type MapeamentoMigracao = Partial<Record<CampoMigracao, string>>;

function celula(texto: string): CelulaPlanilha { const limpo = texto.trim(); return limpo ? limpo : null; }
/** CSV RFC4180: aspas, vírgulas e quebras de linha dentro da célula. */
export function detectarDelimitadorCsv(conteudo: string) { const cabecalho = conteudo.split(/\r?\n/, 1)[0] ?? ""; return (cabecalho.match(/;/g)?.length ?? 0) > (cabecalho.match(/,/g)?.length ?? 0) ? ";" : ","; }
export function lerCsvPreparacao(conteudo: string, nome = "CSV", delimitador = detectarDelimitadorCsv(conteudo)): AbaPlanilha {
  const registros: string[][] = [[]]; let valor = "", aspas = false;
  for (let i = 0; i < conteudo.length; i++) { const caractere = conteudo[i]!;
    if (aspas && caractere === '"' && conteudo[i + 1] === '"') { valor += '"'; i++; continue; }
    if (caractere === '"') { aspas = !aspas; continue; }
    if (!aspas && caractere === delimitador) { registros.at(-1)!.push(valor); valor = ""; continue; }
    if (!aspas && (caractere === "\n" || caractere === "\r")) { if (caractere === "\r" && conteudo[i + 1] === "\n") i++; registros.at(-1)!.push(valor); valor = ""; registros.push([]); continue; }
    valor += caractere;
  }
  if (aspas) throw new Error("CSV possui aspas sem fechamento.");
  registros.at(-1)!.push(valor);
  const original = registros.shift() ?? []; const totalColunas = Math.max(original.length, ...registros.map((registro) => registro.length)); const usados = new Set<string>();
  const cabecalhos = Array.from({ length: totalColunas }, (_, indice) => { const base = (original[indice] ?? "").trim() || `Coluna ${indice + 1}`; let rotulo = base, ocorrencia = 2; while (usados.has(rotulo)) rotulo = `${base} (${ocorrencia++})`; usados.add(rotulo); return { id: `c${indice + 1}`, rotulo }; });
  return { nome, cabecalhos, linhas: registros.map((registro, indice) => ({ numero: indice + 2, valores: Object.fromEntries(cabecalhos.map((cabecalho, coluna) => [cabecalho.id, celula(registro[coluna] ?? "")])) })).filter((linha) => Object.values(linha.valores).some((valor) => valor !== null)) };
}

export function linhasMapeadasPreparacao(aba: AbaPlanilha, mapeamento: MapeamentoMigracao, tipoEntrada: "CADASTRO" | "VINCULO_MATRICULA" | "FINANCEIRO_HISTORICO" | "HISTORICO_PRESENCA") {
  const valor = (linha: AbaPlanilha["linhas"][number], campo: CampoMigracao) => { const coluna = mapeamento[campo]; return coluna ? linha.valores[coluna] ?? null : null; };
  const bloco = (linha: AbaPlanilha["linhas"][number], prefixo: "aluno" | "turma" | "matricula" | "financeiro", campos: string[]) => Object.fromEntries(campos.map((campo) => [campo, valor(linha, `${prefixo}.${campo}` as CampoMigracao)]));
  return aba.linhas.map((linha) => ({ linhaOrigem: `${aba.nome}!${linha.numero}`, tipoEntrada,
    aluno: bloco(linha, "aluno", ["id", "nome", "email", "documento", "pais", "fuso"]), turma: bloco(linha, "turma", ["id", "codigo", "nome"]), matricula: bloco(linha, "matricula", ["id", "situacao", "inicio", "fim", "produtoOrigem", "moeda", "pais"]), alocacao: bloco(linha, "alocacao" as never, ["inicio", "fim"]), financeiro: bloco(linha, "financeiro", ["id", "tipo", "valor", "moeda", "situacao"]),
    consentimentoOrigem: valor(linha, "consentimentoOrigem"), presencaOrigem: valor(linha, "presencaOrigem"),
    // Toda coluna, inclusive não mapeada e cabeçalho duplicado, continua na fotografia.
    dadosAdicionais: Object.fromEntries(aba.cabecalhos.map((cabecalho) => [cabecalho.rotulo, linha.valores[cabecalho.id] ?? null])),
  }));
}
