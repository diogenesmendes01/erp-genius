// Importação de TURMAS por planilha (XLSX) — recurso ADMIN (doc 12: evento `TurmaImportada`).
// Espelha a importação de alunos. Validações por linha: modalidade/nível existentes, nº de
// dias casando com a frequência da modalidade, horários HH:MM (fim > início) e período
// (início → fim). Funções PURAS e testáveis; a criação no banco fica na rota.

export interface ColunaImportacaoTurma {
  key: string;
  header: string;
  obrig?: boolean;
}

export const COLUNAS_IMPORTACAO_TURMA: ColunaImportacaoTurma[] = [
  { key: "nome", header: "Nome da turma" },
  { key: "modalidade", header: "Modalidade", obrig: true },
  { key: "nivel", header: "Nível", obrig: true },
  { key: "professor", header: "Professor" },
  { key: "diasSemana", header: "Dias da semana (ex.: Seg, Qua, Sex)", obrig: true },
  { key: "horarioInicio", header: "Horário de início (HH:MM)", obrig: true },
  { key: "horarioFim", header: "Horário de fim (HH:MM)", obrig: true },
  { key: "dataInicio", header: "Data de início (AAAA-MM-DD)", obrig: true },
  { key: "dataFim", header: "Data de fim (AAAA-MM-DD)", obrig: true },
  { key: "capacidade", header: "Capacidade" },
  { key: "rolling", header: "Rolling Pré A1 (sim/não)" },
];

/** Linha de exemplo do modelo (orienta o admin). */
export const EXEMPLO_LINHA_TURMA: Record<string, string> = {
  nome: "Intensiva manhã",
  modalidade: "Intensiva",
  nivel: "Português A1",
  professor: "",
  diasSemana: "Seg, Qua, Sex",
  horarioInicio: "19:00",
  horarioFim: "21:00",
  dataInicio: "2026-08-01",
  dataFim: "2026-09-15",
  capacidade: "16",
  rolling: "Não",
};

/** Quais colunas viram dropdown no modelo e de qual lista (resolvida na geração do XLSX). */
export const DROPDOWNS_TURMA: { key: string; lista: "modalidade" | "nivel" | "professor" | "simNao" }[] = [
  { key: "modalidade", lista: "modalidade" },
  { key: "nivel", lista: "nivel" },
  { key: "professor", lista: "professor" },
  { key: "rolling", lista: "simNao" },
];

export const VALORES_SIM_NAO = ["Sim", "Não"];

/** Normaliza para comparação: minúsculas, sem acento, espaços nas pontas removidos. */
export function normalizarChave(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Cabeçalho da planilha → chave interna (null se desconhecido). */
export function chaveDoCabecalhoTurma(header: unknown): string | null {
  // Remove o sufixo " *" (marca de obrigatório que o modelo gera) antes de comparar —
  // senão o próprio modelo baixado não casaria na reimportação.
  const alvo = normalizarChave(header).replace(/\s*\*+\s*$/, "").trim();
  if (!alvo) return null;
  const col = COLUNAS_IMPORTACAO_TURMA.find((c) => {
    const h = normalizarChave(c.header);
    // h === alvo: cabeçalho cheio do modelo. h.startsWith(alvo): admin digitou forma abreviada
    // (ex.: "Data de início" para a coluna "Data de início (AAAA-MM-DD)").
    return h === alvo || h.startsWith(alvo);
  });
  return col?.key ?? null;
}

const SIM = new Set(["sim", "s", "yes", "y", "true", "1", "x", "verdadeiro"]);
/** "sim"/"não" → boolean. Vazio → undefined (usa default). */
export function resolverBool(v: unknown): boolean | undefined {
  const s = normalizarChave(v);
  if (!s) return undefined;
  return SIM.has(s);
}

/** Data "AAAA-MM-DD" (ou Date) → Date no meio-dia local. Null se vazio/invalida. */
export function resolverData(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const s = String(v ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

// Abreviação normalizada (3 letras) → nº do dia (0=Dom … 6=Sáb). Cobre abreviações e
// nomes completos: domingo→dom, segunda→seg, terça→ter, quarta→qua, quinta→qui, sexta→sex, sábado→sab.
const DIA_POR_PREFIXO: Record<string, number> = {
  dom: 0,
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
};

/**
 * Um token → nº do dia (0=Dom … 6=Sáb), ou null.
 * Aceita nome/abreviação (Seg, Segunda, Sáb) e ordinal BR COM marcador (2ª/4ª/6ª = Seg/Qua/Sex;
 * 1ª = Dom · 7ª = Sáb). NÃO aceita dígito CRU ("2") — é ambíguo entre a convenção JS (0=Dom) e a
 * BR (2ª-feira = Segunda), então exigimos o marcador ordinal ou o nome.
 */
function diaDeToken(tk: string): number | null {
  const ord = /^([1-7])(ª|º|a|o)$/.exec(tk);
  if (ord) {
    const n = Number(ord[1]);
    return n === 1 ? 0 : n - 1;
  }
  const d = DIA_POR_PREFIXO[tk.slice(0, 3)];
  return d === undefined ? null : d;
}

/**
 * "Seg, Qua, Sex" / "segunda/quarta/sexta" / "Seg-Qua-Sex" / "2ª,4ª,6ª" → [1,3,5].
 * Suporta FAIXA "Segunda a Sexta" / "Seg até Sex" → [1,2,3,4,5]. Separadores: , ; / | . - · espaço.
 * Tokens não reconhecidos são ignorados (a checagem de contagem na rota pega o resultado vazio/errado).
 */
export function resolverDiasSemana(texto: unknown): number[] {
  const s = normalizarChave(texto);
  if (!s) return [];
  const tokens = s.split(/[\s,;/|.·-]+/).filter(Boolean);
  const dias = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk === "a" || tk === "ate") {
      // Faixa: expande do dia anterior ao próximo (inclusive).
      const prev = diaDeToken(tokens[i - 1] ?? "");
      const next = diaDeToken(tokens[i + 1] ?? "");
      if (prev !== null && next !== null) {
        for (let d = Math.min(prev, next); d <= Math.max(prev, next); d++) dias.add(d);
      }
      continue;
    }
    if (tk === "e" || tk === "feira" || tk === "feiras") continue; // conectores
    const d = diaDeToken(tk);
    if (d !== null) dias.add(d);
  }
  return [...dias].sort((a, b) => a - b);
}

// Compara ignorando hífen/espaço: "Semi-intensiva" == "Semi intensiva".
const chaveSolta = (s: unknown) => normalizarChave(s).replace(/[\s-]+/g, "");

/** Resolve uma modalidade por nome, tolerando hífen × espaço (lista vinda do banco). */
export function resolverModalidade<T extends { nome: string }>(texto: unknown, modalidades: T[]): T | null {
  const alvo = chaveSolta(texto);
  if (!alvo) return null;
  return modalidades.find((m) => chaveSolta(m.nome) === alvo) ?? null;
}

/**
 * Resolve um nível por rótulo completo ("Português A1") — sempre preferido — ou por código nu
 * ("A1") APENAS quando não for ambíguo. O `codigo` não é único entre idiomas (Português A1,
 * Inglês A1…); por isso código nu ambíguo retorna null (força usar o rótulo completo) em vez de
 * casar o primeiro idioma silenciosamente.
 */
export function resolverNivel<T extends { codigo: string; idioma: { nome: string } }>(
  texto: unknown,
  niveis: T[],
): T | null {
  const alvo = normalizarChave(texto);
  if (!alvo) return null;
  const porRotulo = niveis.find((n) => normalizarChave(`${n.idioma.nome} ${n.codigo}`) === alvo);
  if (porRotulo) return porRotulo;
  const porCodigo = niveis.filter((n) => normalizarChave(n.codigo) === alvo);
  return porCodigo.length === 1 ? porCodigo[0] : null;
}

/** Resolve um professor por nome ou e-mail (lista vinda do banco). Vazio → null (opcional). */
export function resolverProfessor<T extends { nome: string; email?: string }>(
  texto: unknown,
  professores: T[],
): T | null {
  const alvo = normalizarChave(texto);
  if (!alvo) return null;
  return (
    professores.find(
      (p) => normalizarChave(p.nome) === alvo || (p.email && normalizarChave(p.email) === alvo),
    ) ?? null
  );
}
