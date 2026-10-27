import { z } from "zod";
import { CODIGOS_ISO } from "@/lib/paises-iso";
import { instanteDaGrade } from "@/server/agenda/grade";

export const telefoneE164 = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Telefone deve estar em formato internacional (E.164), ex.: +5511999998888");

export const emailSchema = z.string().email("E-mail inválido");

const SOMENTE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const DATA_HORA_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

let fusoDasDatasDigitadas: string | null = null;

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

export function analisarComDatasDaEscola<S extends z.ZodTypeAny>(schema: S, entrada: unknown, fuso: string): z.output<S> {
  return comDatasDaEscola(fuso, () => schema.parse(entrada));
}

export function paraDataLocal(v: unknown, fuso: string | null = fusoDasDatasDigitadas): unknown {
  if (typeof v === "string" && SOMENTE_DATA.test(v)) {
    if (!fuso) throw new Error("Data digitada sem o fuso da escola: valide a entrada com analisarComDatasDaEscola.");
    const [ano, mes, dia] = v.split("-").map(Number);
    return instanteDaGrade(new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10), "12:00", fuso);
  }
  return v;
}

export const dataOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : paraDataLocal(v)),
  z.coerce.date().optional(),
);

export const MSG_DATA_HORA_SEM_FUSO = "Data e hora digitadas sem fuso ou inválidas: confira o horário e informe o fuso.";

export function paraDataHoraLocal(v: unknown): unknown {
  if (typeof v === "string" && DATA_HORA_LOCAL.test(v)) {
    throw new Error(MSG_DATA_HORA_SEM_FUSO);
  }
  return paraDataLocal(v);
}

export const dataHoraOpcional = z.preprocess(
  (v, ctx) => {
    if (v === "" || v === null || v === undefined) return undefined;
    if (typeof v === "string" && DATA_HORA_LOCAL.test(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: MSG_DATA_HORA_SEM_FUSO });
      return z.NEVER;
    }
    return paraDataHoraLocal(v);
  },
  z.coerce.date().optional(),
);

export const dataObrigatoria = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : paraDataLocal(v)),
  z.coerce.date({ required_error: "Informe a data" }),
);

export const codigoISO = z.string().refine((c) => CODIGOS_ISO.has(c), "Selecione um país válido");
export const codigoISOOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  codigoISO.optional(),
);

export function normalizarTelefoneE164(
  cru: string | null | undefined,
  ddiPais: string,
): string | null {
  if (cru == null) return null;
  const digitos = String(cru).replace(/\D/g, "");
  if (!digitos) return null;
  const ddi = ddiPais.replace(/\D/g, "");
  const completo = digitos.startsWith(ddi) ? digitos : ddi + digitos;
  return "+" + completo;
}

type ValidadorDocumento = (valor: string) => boolean;

const soDigitos = (v: string) => v.replace(/\D/g, "");

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

function validarCedulaCR(valor: string): boolean {
  const limpo = valor.replace(/[\s-]/g, "");
  return /^[1-9]\d{8}$/.test(limpo) || /^[1-9]\d{10,11}$/.test(limpo);
}

const ENTIDADES_CURP = new Set([
  "AS", "BC", "BS", "CC", "CL", "CM", "CS", "CH", "DF", "DG", "GT", "GR", "HG", "JC", "MC", "MN",
  "MS", "NT", "NL", "OC", "PL", "QT", "QR", "SP", "SL", "SR", "TC", "TS", "TL", "VZ", "YN", "ZS", "NE",
]);
const ALFABETO_CURP = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";

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

function validarDNIAR(valor: string): boolean {
  const limpo = valor.replace(/[\s.]/g, "");
  return /^[1-9]\d{6,7}$/.test(limpo);
}

function validarDUISV(valor: string): boolean {
  const limpo = valor.replace(/[\s-]/g, "");
  if (!/^\d{9}$/.test(limpo) || /^0{9}$/.test(limpo)) return false;
  let soma = 0;
  for (let i = 0; i < 8; i++) soma += Number(limpo[i]) * (9 - i);
  return (10 - (soma % 10)) % 10 === Number(limpo[8]);
}

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

export function temValidadorDocumento(validador: string): boolean {
  return Object.prototype.hasOwnProperty.call(VALIDADORES, validador);
}

export function validarDocumento(validador: string, valor: string): boolean {
  const fn = VALIDADORES[validador];
  if (!fn) return false;
  return fn(valor);
}

export function calcularDocumentoValido(
  tiposDocumento: { validador: string }[],
  documento: string | null | undefined,
): boolean {
  const valor = documento?.trim();
  if (!valor) return false;
  return tiposDocumento.some((t) => validarDocumento(t.validador, valor));
}

export const ChaveIdempotenciaSchema = z.string().trim().min(8, "Chave de idempotência inválida.").max(100, "Chave de idempotência inválida.");
