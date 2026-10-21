import { z } from "zod";
import { CODIGOS_ISO } from "@/lib/paises-iso";
import { instanteDaGrade } from "@/server/agenda/grade";

// Validação compartilhada frontend ↔ backend (ver docs/04 §3 e docs/13).
// Política de rigor (doc 04): TELEFONE e E-MAIL bloqueiam; DOCUMENTO avisa mas salva
// (marcado como "não validado"), porque há exceções legítimas e base a migrar.

/** Telefone em formato internacional E.164 (ex.: +5511999998888). Bloqueia se inválido. */
export const telefoneE164 = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Telefone deve estar em formato internacional (E.164), ex.: +5511999998888");

export const emailSchema = z.string().email("E-mail inválido");

// ------------------------------------------------------------
// Datas "date-only" (doc 13). <input type="date"> envia "YYYY-MM-DD".
// z.coerce.date() interpretaria isso como MEIA-NOITE UTC; ao renderizar num fuso
// negativo (ex.: America/Sao_Paulo -03), o dia exibido recuaria 1. Para o dia
// digitado bater com o exibido, ancoramos a data no MEIO-DIA DA ESCOLA (ref. #247):
// antes era o meio-dia do relógio do servidor, que em produção roda em UTC (09h em
// Brasília). Os dados antigos continuam legíveis: `diaCivilGravado` recupera o dia
// civil nas duas convenções.
// ------------------------------------------------------------
const SOMENTE_DATA = /^\d{4}-\d{2}-\d{2}$/;
// <input type="datetime-local"> envia "YYYY-MM-DDTHH:mm" (sem fuso) — hora LOCAL.
const DATA_HORA_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/** Fuso da escola em vigor durante `comDatasDaEscola`; fora dele, nenhum. */
let fusoDasDatasDigitadas: string | null = null;

/**
 * Executa `analisar` com as datas digitadas (AAAA-MM-DD) convertidas para o meio-dia da escola em `fuso`. Só
 * aceita trabalho síncrono, como o parse do Zod: o fuso vale só durante esta chamada e não alcança outra requisição.
 */
export function comDatasDaEscola<T>(fuso: string, analisar: () => T): T {
  const anterior = fusoDasDatasDigitadas;
  fusoDasDatasDigitadas = fuso;
  try {
    const resultado = analisar();
    if (resultado instanceof Promise) throw new Error("comDatasDaEscola aceita apenas validação síncrona.");
    return resultado;
  } finally {
    fusoDasDatasDigitadas = anterior;
  }
}

/** Valida `entrada` com `schema`, com as datas digitadas no meio-dia da escola (ver {@link comDatasDaEscola}). */
export function analisarComDatasDaEscola<S extends z.ZodTypeAny>(schema: S, entrada: unknown, fuso: string): z.output<S> {
  return comDatasDaEscola(fuso, () => schema.parse(entrada));
}

/**
 * Converte uma string "YYYY-MM-DD" (date-only) em Date ancorada no meio-dia do fuso da escola
 * (`instanteDaGrade(data, "12:00", fuso)`). Sem fuso, recusa em vez de cair no relógio do servidor.
 * Um dia inexistente mantém a normalização de antes (31/02 → 03/03). Qualquer outro valor (Date,
 * datetime ISO etc.) passa inalterado para o coerce seguinte.
 */
export function paraDataLocal(v: unknown, fuso: string | null = fusoDasDatasDigitadas): unknown {
  if (typeof v === "string" && SOMENTE_DATA.test(v)) {
    if (!fuso) throw new Error("Data digitada sem o fuso da escola: valide a entrada com analisarComDatasDaEscola.");
    const [ano, mes, dia] = v.split("-").map(Number);
    return instanteDaGrade(new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10), "12:00", fuso);
  }
  return v;
}

/**
 * Campo de data opcional compartilhado por todos os schemas (turma, matrícula,
 * aluno, lead, financeiro, ajustes). Vazio/null/undefined → undefined; string
 * date-only → meio-dia da escola (ver {@link paraDataLocal} e {@link analisarComDatasDaEscola}).
 */
export const dataOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : paraDataLocal(v)),
  z.coerce.date().optional(),
);

/**
 * Converte uma string "YYYY-MM-DDTHH:mm" (vinda de <input type="datetime-local">,
 * sem fuso) em Date na HORA LOCAL informada. Diferente de {@link paraDataLocal},
 * NÃO ancora no meio-dia: a hora digitada é preservada (issue #16 — não descartar o
 * horário da experimental). Date-only ("YYYY-MM-DD") cai no meio-dia da escola via
 * {@link paraDataLocal}; qualquer outro valor passa inalterado.
 */
export function paraDataHoraLocal(v: unknown): unknown {
  if (typeof v === "string" && DATA_HORA_LOCAL.test(v)) {
    const [data, hora] = v.split("T");
    const [ano, mes, dia] = data.split("-").map(Number);
    const [h, min, seg] = hora.split(":").map(Number);
    return new Date(ano, mes - 1, dia, h, min, seg || 0, 0);
  }
  return paraDataLocal(v);
}

/**
 * Campo opcional de data COM hora (datetime-local). Preserva o horário digitado;
 * aceita também date-only (ancorado no meio-dia da escola). Vazio → undefined.
 */
export const dataHoraOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : paraDataHoraLocal(v)),
  z.coerce.date().optional(),
);

/** Data OBRIGATÓRIA "date-only" (ex.: nascimento) — ancorada no meio-dia da escola. */
export const dataObrigatoria = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : paraDataLocal(v)),
  z.coerce.date({ required_error: "Informe a data" }),
);

// ------------------------------------------------------------
// Código de país ISO 3166 (nacionalidade, residência, país emissor). Ver
// `lib/paises-iso.ts`. É DIFERENTE do `Pais` (mercado) — aceita qualquer país.
// ------------------------------------------------------------
export const codigoISO = z.string().refine((c) => CODIGOS_ISO.has(c), "Selecione um país válido");
export const codigoISOOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  codigoISO.optional(),
);

/**
 * Normaliza um telefone "cru" (qualquer máscara) para E.164, com o DDI embutido.
 * Regra (decisão do usuário): salvamos SEMPRE em E.164 (ex.: +50688887777); o DDI
 * não é coluna separada — fica embutido no próprio número. A máscara vive só na UI.
 *
 * `ddiPais` é o DDI do país do aluno (ex.: "+506"). Se o número cru já vier com o
 * código do país, não duplicamos; se vier só o número local, prefixamos o DDI.
 * Tamanhos variam por país (CR 8, BR 10-11, MX 10…), por isso não fixamos comprimento.
 * Retorna null quando não há dígito algum.
 */
export function normalizarTelefoneE164(
  cru: string | null | undefined,
  ddiPais: string,
): string | null {
  if (cru == null) return null;
  const digitos = String(cru).replace(/\D/g, "");
  if (!digitos) return null;
  const ddi = ddiPais.replace(/\D/g, ""); // ex.: "506"
  const completo = digitos.startsWith(ddi) ? digitos : ddi + digitos;
  return "+" + completo;
}

// ------------------------------------------------------------
// Validadores de documento NOMEADOS (doc 04 §2).
// Cada TipoDocumento.validador aponta para uma chave aqui.
// Documento é "avisa, não bloqueia": o resultado vira a flag `documentoValido`,
// nunca impede salvar. Validador desconhecido → trata como NÃO validado (false).
// ------------------------------------------------------------
type ValidadorDocumento = (valor: string) => boolean;

const soDigitos = (v: string) => v.replace(/\D/g, "");

/** CPF (Brasil) — dígito verificador módulo 11. */
function validarCPF(valor: string): boolean {
  const cpf = soDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (fim: number) => {
    let soma = 0;
    for (let i = 0; i < fim; i++) soma += Number(cpf[i]) * (fim + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

/**
 * Cédula (Costa Rica): física com 9 dígitos (X-XXXX-XXXX, primeiro dígito 1–9) ou
 * DIMEX de estrangeiro residente com 11–12 dígitos. Não há dígito verificador público:
 * a conferência é só de formato.
 */
function validarCedulaCR(valor: string): boolean {
  const limpo = valor.replace(/[\s-]/g, "");
  return /^[1-9]\d{8}$/.test(limpo) || /^[1-9]\d{10,11}$/.test(limpo);
}

/** Entidades federativas do RENAPO (NE = nascido no exterior). */
const ENTIDADES_CURP = new Set([
  "AS", "BC", "BS", "CC", "CL", "CM", "CS", "CH", "DF", "DG", "GT", "GR", "HG", "JC", "MC", "MN",
  "MS", "NT", "NL", "OC", "PL", "QT", "QR", "SP", "SL", "SR", "TC", "TS", "TL", "VZ", "YN", "ZS", "NE",
]);
const ALFABETO_CURP = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";

/**
 * CURP (México), 18 posições: iniciais, data AAMMDD, sexo, entidade, consoantes internas,
 * homoclave (dígito para nascidos até 1999, letra a partir de 2000) e dígito verificador do
 * RENAPO: soma dos valores no alfabeto oficial com pesos 18…2, verificador = (10 − soma mod 10) mod 10.
 */
function validarCURP(valor: string): boolean {
  const curp = valor.trim().toUpperCase();
  const m = /^[A-Z][AEIOUX][A-Z]{2}(\d{2})(\d{2})(\d{2})[HMX]([A-Z]{2})[B-DF-HJ-NP-TV-Z]{3}([A-Z\d])\d$/.exec(curp);
  if (!m) return false;
  const [, aa, mm, dd, entidade, homoclave] = m;
  if (!ENTIDADES_CURP.has(entidade!)) return false;
  const ano = (/\d/.test(homoclave!) ? 1900 : 2000) + Number(aa);
  const nascimento = new Date(Date.UTC(ano, Number(mm) - 1, Number(dd)));
  if (nascimento.getUTCMonth() !== Number(mm) - 1 || nascimento.getUTCDate() !== Number(dd)) return false;
  let soma = 0;
  for (let i = 0; i < 17; i++) soma += ALFABETO_CURP.indexOf(curp[i]!) * (18 - i);
  return (10 - (soma % 10)) % 10 === Number(curp[17]);
}

/** DNI (Argentina): 7 ou 8 dígitos (com ou sem pontos). Não há dígito verificador. */
function validarDNIAR(valor: string): boolean {
  const limpo = valor.replace(/[\s.]/g, "");
  return /^[1-9]\d{6,7}$/.test(limpo);
}

/** DUI (El Salvador): 8 dígitos + verificador; soma com pesos 9…2, verificador = (10 − soma mod 10) mod 10. */
function validarDUISV(valor: string): boolean {
  const limpo = valor.replace(/[\s-]/g, "");
  if (!/^\d{9}$/.test(limpo) || /^0{9}$/.test(limpo)) return false;
  let soma = 0;
  for (let i = 0; i < 8; i++) soma += Number(limpo[i]) * (9 - i);
  return (10 - (soma % 10)) % 10 === Number(limpo[8]);
}

/**
 * Passaporte: só o formato genérico do número de documento ICAO 9303 (6–9 alfanuméricos,
 * com ao menos um dígito). Não há verificador universal nem regra por país emissor
 * (decisão da #62); o dígito da MRZ não é digitado no cadastro.
 */
function validarPassaporte(valor: string): boolean {
  const limpo = valor.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{6,9}$/.test(limpo) && /\d/.test(limpo);
}

const VALIDADORES: Record<string, ValidadorDocumento> = {
  cpf: validarCPF,
  cedula_cr: validarCedulaCR,
  curp: validarCURP,
  dni_ar: validarDNIAR,
  dui_sv: validarDUISV,
  passaporte: validarPassaporte,
};

/**
 * Valida um documento por validador nomeado. Retorna se está válido.
 * NUNCA lança/bloqueia — o chamador salva sempre, gravando esta flag em
 * `Aluno.documentoValido`.
 */
export function validarDocumento(validador: string, valor: string): boolean {
  const fn = VALIDADORES[validador];
  if (!fn) return false;
  return fn(valor);
}

/**
 * Calcula a flag `Aluno.documentoValido` a partir do documento informado e dos
 * tipos de documento do país do aluno. Cada país pode ter 1+ {@link TipoDocumento};
 * o documento é considerado VÁLIDO se passar em QUALQUER um dos validadores do país
 * (ex.: Cédula OU Passaporte). Ausência de documento → false (não há o que validar).
 *
 * NUNCA bloqueia (doc 04): o resultado é só a flag persistida; o salvamento ocorre
 * de qualquer forma. Usado na criação (via matrícula) e na edição de aluno.
 */
export function calcularDocumentoValido(
  tiposDocumento: { validador: string }[],
  documento: string | null | undefined,
): boolean {
  const valor = documento?.trim();
  if (!valor) return false;
  return tiposDocumento.some((t) => validarDocumento(t.validador, valor));
}

/**
 * Chave de idempotência de uma tentativa, gerada pela tela (`crypto.randomUUID()`) e reenviada igual até o
 * sucesso (#166). Mesmo limite das ações que já têm coluna própria (`contratos/modelo-schema.ts`).
 */
export const ChaveIdempotenciaSchema = z.string().trim().min(8, "Chave de idempotência inválida.").max(100, "Chave de idempotência inválida.");
