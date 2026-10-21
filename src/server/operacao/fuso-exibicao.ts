import { formatarDataCivil } from "@/lib/data-civil";
import { FusoInstitucionalSchema, dataCivilInstitucional, diaCivilGravado } from "./fuso";

/** Preferência só interpreta instantes já persistidos; não muda fontes ou datas civis. */
export function resolverFusoExibicao(preferencia: string | null | undefined, fusoOrigem: string) {
  const preferido = FusoInstitucionalSchema.safeParse(preferencia);
  if (preferido.success) return preferido.data;
  const origem = FusoInstitucionalSchema.safeParse(fusoOrigem);
  return origem.success ? origem.data : "UTC";
}

/**
 * Valor inicial de um campo de fuso de ENTRADA (docs/43 §6 item 6): o fuso da escola, senão a preferência de
 * exibição de quem preenche; "" quando nenhum dos dois vale — o campo fica vazio e obrigatório, nunca um
 * "UTC" presumido.
 */
export function fusoInicialDeEntrada(institucional: string | null | undefined, preferencia: string | null | undefined): string {
  for (const fuso of [institucional, preferencia]) {
    const valido = FusoInstitucionalSchema.safeParse(fuso);
    if (valido.success) return valido.data;
  }
  return "";
}

/**
 * Estilos de um INSTANTE na tela. Todos levam `timeZone` explícito: a tela nunca depende do fuso do servidor
 * (SSR) nem do navegador. "dataHora" é o padrão histórico ("20/10/2026, 20:30").
 */
const ESTILOS_INSTANTE = {
  dataHora: { dateStyle: "short", timeStyle: "short" },
  data: { dateStyle: "short" },
  hora: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  diaMesHora: { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;
export type EstiloInstante = keyof typeof ESTILOS_INSTANTE;

/**
 * Helper central de exibição de instantes (docs/43 §6 item 6; fuso pessoal nas telas). A preferência pessoal
 * vale quando é um IANA válido; senão, o fuso de origem (o da escola, nas telas operacionais). Datas civis
 * (vencimento, promessa, nascimento) NÃO passam por aqui: ver `formatarDiaCivilGravado` e `formatarDataCivil`.
 */
export function formatarInstanteExibicao(valor: Date | string, preferencia: string | null | undefined, fusoOrigem: string, estilo: EstiloInstante = "dataHora") {
  const instante = new Date(valor);
  if (!Number.isFinite(instante.getTime())) return { texto: String(valor), fuso: resolverFusoExibicao(preferencia, fusoOrigem) };
  const fuso = resolverFusoExibicao(preferencia, fusoOrigem);
  try {
    return { texto: new Intl.DateTimeFormat("pt-BR", { ...ESTILOS_INSTANTE[estilo], timeZone: fuso }).format(instante), fuso };
  } catch {
    return { texto: instante.toISOString(), fuso: "UTC" };
  }
}

/**
 * Data civil GRAVADA como instante (promessa de pagamento, data do pagamento): o dia da escola pelo mesmo critério
 * da régua (`diaCivilGravado`), sem fuso pessoal — um dia civil não muda conforme quem lê. Fuso da escola
 * inválido usa o dia UTC; valor que não é data volta como está; ausente vira `ausente`.
 */
export function formatarDiaCivilGravado(valor: Date | string | null | undefined, fusoEscola: string, ausente = "—"): string {
  if (valor == null || valor === "") return ausente;
  const instante = new Date(valor);
  if (!Number.isFinite(instante.getTime())) return String(valor);
  const fuso = FusoInstitucionalSchema.safeParse(fusoEscola);
  return formatarDataCivil(fuso.success ? diaCivilGravado(instante, fuso.data) : instante.toISOString().slice(0, 10), ausente);
}

/**
 * Dia de um campo de pagamento de semântica MISTA (`Cobranca.pagoEm`, `Recebimento.dataPagamento`, data do
 * informe). Ele guarda a data digitada, a gravação legada à meia-noite UTC ou um instante real (`new Date()`/
 * `agora` na baixa sem data, no ajuste que quita, na desistência; o instante histórico da baixa da migração).
 * A data digitada é gravada ao meio-dia da ESCOLA (`paraDataLocal`): em `registrarPagamento`/ativação e, a partir
 * do #290, também no recebimento destinado (FIN-04). Registros ANTIGOS do FIN-04 (e o primeiro envio de um
 * formulário antigo ainda aberto logo depois do deploy) guardam o meio-dia do NAVEGADOR.
 * Normalizar na gravação não é local: o mesmo valor alimenta `Recebimento.dataPagamento`, o hash de idempotência
 * e filtros por período. Por isso a leitura distingue:
 * - exatamente 00:00:00.000 UTC → data civil legada, o dia UTC (não recua um dia a oeste de Greenwich);
 * - qualquer outro valor → o dia da escola (`dataCivilInstitucional`). Para a data digitada ao meio-dia (ou à
 *   meia-noite) da escola é o próprio dia; para um instante, o dia em que ele ocorreu na escola.
 * Limites:
 * - um instante real exatamente à meia-noite UTC, com milissegundo zero, é lido como data civil;
 * - registros ANTIGOS do FIN-04 com o navegador a mais de 12h a LESTE da escola (ex.: escola em São Paulo,
 *   navegador em Sydney): o meio-dia do navegador cai no dia ANTERIOR da escola, e a data sai um dia antes; a mais
 *   de 12h a OESTE, um dia depois. Desde o #290 o gravador manda AAAA-MM-DD e o servidor grava o meio-dia da escola
 *   (`analisarComDatasDaEscola`); o replay da mesma chave compara com o dia que a escola vê no registro existente
 *   (`mesmaDataDigitadaNaEscola`, src/server/financeiro/recebimentos.ts).
 * Sem fuso pessoal: o dia do pagamento não muda conforme quem lê. Fuso da escola inválido usa o dia UTC.
 */
export function diaCivilDoPagamento(gravada: Date, fusoEscola: string): string {
  const utc = gravada.toISOString();
  const fuso = FusoInstitucionalSchema.safeParse(fusoEscola);
  if (!fuso.success || utc.endsWith("T00:00:00.000Z")) return utc.slice(0, 10);
  return dataCivilInstitucional(gravada, fuso.data);
}

/** `diaCivilDoPagamento` formatado (dd/mm/aaaa); valor que não é data volta como está; ausente vira `ausente`. */
export function formatarDiaDoPagamento(valor: Date | string | null | undefined, fusoEscola: string, ausente = "—"): string {
  if (valor == null || valor === "") return ausente;
  const instante = new Date(valor);
  if (!Number.isFinite(instante.getTime())) return String(valor);
  return formatarDataCivil(diaCivilDoPagamento(instante, fusoEscola), ausente);
}

/**
 * Dia da escola de um valor que é o dia civil no fuso da escola por construção (follow-up gravado pelo
 * `dataCivilInstitucional`, como no cartão do funil). Não lança: fuso da escola inválido usa o dia UTC, como os
 * outros helpers de exibição; valor que não é data volta como está; ausente vira `ausente`.
 */
export function formatarDiaDaEscola(valor: Date | string | null | undefined, fusoEscola: string, ausente = "—"): string {
  if (valor == null || valor === "") return ausente;
  const instante = new Date(valor);
  if (!Number.isFinite(instante.getTime())) return String(valor);
  const fuso = FusoInstitucionalSchema.safeParse(fusoEscola);
  return formatarDataCivil(fuso.success ? dataCivilInstitucional(instante, fuso.data) : instante.toISOString().slice(0, 10), ausente);
}
