import { z } from "zod";

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
// z.coerce.date() interpretaria isso como MEIA-NOITE UTC; ao renderizar com
// toLocaleDateString("pt-BR") num fuso negativo (ex.: America/Sao_Paulo -03),
// o dia exibido recua 1 (01/01/2026 vira 31/12/2025). Para o dia digitado bater
// com o exibido, ancoramos a data no MEIO-DIA LOCAL: assim nenhuma diferença de
// fuso prática (servidor em -03/-06) cruza a fronteira do dia.
// ------------------------------------------------------------
const SOMENTE_DATA = /^\d{4}-\d{2}-\d{2}$/;
// <input type="datetime-local"> envia "YYYY-MM-DDTHH:mm" (sem fuso) — hora LOCAL.
const DATA_HORA_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * Converte uma string "YYYY-MM-DD" (date-only) em Date ancorada no meio-dia
 * LOCAL do dia digitado. Qualquer outro valor (Date, datetime ISO, etc.) passa
 * inalterado para o coerce seguinte.
 */
export function paraDataLocal(v: unknown): unknown {
  if (typeof v === "string" && SOMENTE_DATA.test(v)) {
    const [ano, mes, dia] = v.split("-").map(Number);
    return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
  }
  return v;
}

/**
 * Campo de data opcional compartilhado por todos os schemas (turma, matrícula,
 * aluno, lead, financeiro, ajustes). Vazio/null/undefined → undefined; string
 * date-only → meio-dia local (ver {@link paraDataLocal}).
 */
export const dataOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : paraDataLocal(v)),
  z.coerce.date().optional(),
);

/**
 * Converte uma string "YYYY-MM-DDTHH:mm" (vinda de <input type="datetime-local">,
 * sem fuso) em Date na HORA LOCAL informada. Diferente de {@link paraDataLocal},
 * NÃO ancora no meio-dia: a hora digitada é preservada (issue #16 — não descartar o
 * horário da experimental). Date-only ("YYYY-MM-DD") cai no meio-dia local via
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
 * aceita também date-only (ancorado no meio-dia local). Vazio → undefined.
 */
export const dataHoraOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : paraDataHoraLocal(v)),
  z.coerce.date().optional(),
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

const VALIDADORES: Record<string, ValidadorDocumento> = {
  cpf: validarCPF,
  // TODO (P5/B1): algoritmos reais de cedula_cr, curp, dni_ar, dui_sv, passaporte.
  // Por ora, validadores ainda não implementados deixam o documento como "não validado".
  passaporte: () => false,
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
