import { Genero, Escolaridade } from "@prisma/client";
import { GENERO_LABEL, ESCOLARIDADE_LABEL } from "@/lib/labels";
import { PAISES_ISO, CODIGOS_ISO } from "@/lib/paises-iso";

export interface ColunaImportacao {
  key: string;
  header: string;
  obrig?: boolean;
}

export const COLUNAS_IMPORTACAO: ColunaImportacao[] = [
  { key: "primeiroNome", header: "Nome", obrig: true },
  { key: "sobrenome", header: "Sobrenome" },
  { key: "nomePreferido", header: "Nome preferido" },
  { key: "nascimento", header: "Data de nascimento (AAAA-MM-DD)" },
  { key: "genero", header: "Gênero" },
  { key: "pais", header: "País", obrig: true },
  { key: "tipoDocumento", header: "Tipo de documento" },
  { key: "documento", header: "Número do documento" },
  { key: "documentoPaisEmissor", header: "País emissor" },
  { key: "nacionalidade", header: "Nacionalidade" },
  { key: "segundaNacionalidade", header: "Segunda nacionalidade" },
  { key: "email", header: "E-mail" },
  { key: "telefone", header: "Telefone" },
  { key: "whatsapp", header: "WhatsApp (sim/não)" },
  { key: "aceitaComunicacoes", header: "Recebe comunicações (sim/não)" },
  { key: "paisResidencia", header: "País de residência" },
  { key: "cep", header: "CEP / Código postal" },
  { key: "rua", header: "Rua" },
  { key: "numero", header: "Número" },
  { key: "complemento", header: "Complemento" },
  { key: "bairro", header: "Bairro / Distrito" },
  { key: "cidade", header: "Cidade" },
  { key: "regiao", header: "Região / Estado / Província" },
  { key: "escolaridade", header: "Escolaridade" },
  { key: "idiomaNativo", header: "Idioma nativo" },
  { key: "fuso", header: "Fuso horário" },
  { key: "observacoes", header: "Observações" },
];

export const VALORES_GENERO = Object.values(GENERO_LABEL);
export const VALORES_ESCOLARIDADE = Object.values(ESCOLARIDADE_LABEL);
export const VALORES_SIM_NAO = ["Sim", "Não"];
export const VALORES_PAISES_ISO_NOMES = PAISES_ISO.map((p) => p.nome);

export const DROPDOWNS_IMPORTACAO: { key: string; lista: "genero" | "escolaridade" | "simNao" | "pais" | "tipoDocumento" | "iso" }[] = [
  { key: "genero", lista: "genero" },
  { key: "escolaridade", lista: "escolaridade" },
  { key: "whatsapp", lista: "simNao" },
  { key: "aceitaComunicacoes", lista: "simNao" },
  { key: "pais", lista: "pais" },
  { key: "tipoDocumento", lista: "tipoDocumento" },
  { key: "nacionalidade", lista: "iso" },
  { key: "segundaNacionalidade", lista: "iso" },
  { key: "paisResidencia", lista: "iso" },
  { key: "documentoPaisEmissor", lista: "iso" },
];

export const EXEMPLO_LINHA: Record<string, string> = {
  primeiroNome: "María",
  sobrenome: "González Rojas",
  nomePreferido: "Mari",
  nascimento: "1998-04-12",
  genero: "Feminino",
  pais: "Costa Rica",
  tipoDocumento: "Cédula",
  documento: "1-2345-6789",
  documentoPaisEmissor: "Costa Rica",
  nacionalidade: "Costa Rica",
  segundaNacionalidade: "",
  email: "maria.gonzalez@exemplo.com",
  telefone: "+50688887777",
  whatsapp: "sim",
  aceitaComunicacoes: "sim",
  paisResidencia: "Costa Rica",
  cep: "10101",
  rua: "Av. Central",
  numero: "123",
  complemento: "Apto 4",
  bairro: "Carmen",
  cidade: "San José",
  regiao: "San José",
  escolaridade: "Superior completo",
  idiomaNativo: "Espanhol",
  fuso: "America/Costa_Rica",
  observacoes: "",
};

export function normalizarChave(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function chaveDoCabecalho(header: unknown): string | null {
  const alvo = normalizarChave(header).replace(/\s*\*+\s*$/, "").trim();
  if (!alvo) return null;
  const col = COLUNAS_IMPORTACAO.find((c) => {
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

const GENERO_POR_LABEL = new Map(
  Object.entries(GENERO_LABEL).map(([k, v]) => [normalizarChave(v), k as Genero]),
);
export function resolverGenero(v: unknown): Genero | null {
  const s = normalizarChave(v);
  if (!s) return null;
  if (s === "m" || s === "masculino") return Genero.MASCULINO;
  if (s === "f" || s === "feminino") return Genero.FEMININO;
  if (s.includes("nao informar") || s.includes("nao informado")) return Genero.NAO_INFORMADO;
  return GENERO_POR_LABEL.get(s) ?? null;
}

const ESCOLARIDADE_POR_LABEL = new Map(
  Object.entries(ESCOLARIDADE_LABEL).map(([k, v]) => [normalizarChave(v), k as Escolaridade]),
);
export function resolverEscolaridade(v: unknown): Escolaridade | null {
  const s = normalizarChave(v);
  if (!s) return null;
  return ESCOLARIDADE_POR_LABEL.get(s) ?? null;
}

const ISO_POR_NOME = new Map(PAISES_ISO.map((p) => [normalizarChave(p.nome), p.codigo]));
export function resolverISO(v: unknown): string | null {
  const bruto = String(v ?? "").trim();
  if (!bruto) return null;
  const cod = bruto.toUpperCase();
  if (CODIGOS_ISO.has(cod)) return cod;
  return ISO_POR_NOME.get(normalizarChave(bruto)) ?? null;
}

export function resolverData(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const s = String(v ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}
