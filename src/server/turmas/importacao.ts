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
  { key: "dataFim", header: "Data final de referência (AAAA-MM-DD, opcional)" },
  { key: "capacidade", header: "Capacidade" },
  { key: "rolling", header: "Rolling Pré A1 (sim/não)" },
];

export const EXEMPLO_LINHA_TURMA: Record<string, string> = {
  nome: "Intensiva manhã",
  modalidade: "Intensiva",
  nivel: "Português A1",
  professor: "",
  diasSemana: "Seg, Qua, Sex",
  horarioInicio: "19:00",
  horarioFim: "21:00",
  dataInicio: "2026-08-01",
  dataFim: "",
  capacidade: "16",
  rolling: "Não",
};

export const DROPDOWNS_TURMA: { key: string; lista: "modalidade" | "nivel" | "professor" | "simNao" }[] = [
  { key: "modalidade", lista: "modalidade" },
  { key: "nivel", lista: "nivel" },
  { key: "professor", lista: "professor" },
  { key: "rolling", lista: "simNao" },
];

export const VALORES_SIM_NAO = ["Sim", "Não"];

export function normalizarChave(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function chaveDoCabecalhoTurma(header: unknown): string | null {
  const alvo = normalizarChave(header).replace(/\s*\*+\s*$/, "").trim();
  if (!alvo) return null;
  const col = COLUNAS_IMPORTACAO_TURMA.find((c) => {
    const h = normalizarChave(c.header);
    return h === alvo || h.startsWith(alvo);
  });
  return col?.key ?? null;
}

const SIM = new Set(["sim", "s", "yes", "y", "true", "1", "x", "verdadeiro"]);
export function resolverBool(v: unknown): boolean | undefined {
  const s = normalizarChave(v);
  if (!s) return undefined;
  return SIM.has(s);
}

export function resolverData(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const s = String(v ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

const DIA_POR_PREFIXO: Record<string, number> = {
  dom: 0,
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
};

function diaDeToken(tk: string): number | null {
  const ord = /^([1-7])(ª|º|a|o)$/.exec(tk);
  if (ord) {
    const n = Number(ord[1]);
    return n === 1 ? 0 : n - 1;
  }
  const d = DIA_POR_PREFIXO[tk.slice(0, 3)];
  return d === undefined ? null : d;
}

export function resolverDiasSemana(texto: unknown): number[] {
  const s = normalizarChave(texto);
  if (!s) return [];
  const tokens = s.split(/[\s,;/|.·-]+/).filter(Boolean);
  const dias = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk === "a" || tk === "ate") {
      const prev = diaDeToken(tokens[i - 1] ?? "");
      const next = diaDeToken(tokens[i + 1] ?? "");
      if (prev !== null && next !== null) {
        for (let d = Math.min(prev, next); d <= Math.max(prev, next); d++) dias.add(d);
      }
      continue;
    }
    if (tk === "e" || tk === "feira" || tk === "feiras") continue;
    const d = diaDeToken(tk);
    if (d !== null) dias.add(d);
  }
  return [...dias].sort((a, b) => a - b);
}

const chaveSolta = (s: unknown) => normalizarChave(s).replace(/[\s-]+/g, "");

export function resolverModalidade<T extends { nome: string }>(texto: unknown, modalidades: T[]): T | null {
  const alvo = chaveSolta(texto);
  if (!alvo) return null;
  return modalidades.find((m) => chaveSolta(m.nome) === alvo) ?? null;
}

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
