import { z } from "zod";
import { ErroRegra } from "@/server/_shared";

const evidencia = z.record(z.string().trim().min(1), z.union([z.string().trim().min(1), z.number().finite(), z.boolean()])).refine(valor => Object.keys(valor).length > 0, "Informe evidência verificável.");
const campo = z.enum(["tipo", "valor", "moeda", "situacao", "dataPagamento", "forma", "pagadorId"]);

export const ComplementoConciliacaoFinanceiraSchema = z.object({
  itens: z.array(z.object({ campo, valorProposto: z.string().trim().min(1), motivo: z.string().trim().min(10).max(1000), evidencia }).strict()).min(1).max(7),
}).strict().superRefine((valor, contexto) => {
  const vistos = new Set<string>();
  for (const [indice, item] of valor.itens.entries()) {
    if (vistos.has(item.campo)) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ["itens", indice, "campo"], message: "Cada campo pode receber somente um complemento." });
    vistos.add(item.campo);
  }
});

type Complemento = z.output<typeof ComplementoConciliacaoFinanceiraSchema>;
type Modalidade = "PENDENCIA" | "BAIXAR" | "VINCULAR_RECEBIMENTO";

function texto(origem: unknown) {
  return typeof origem === "string" && origem.trim() ? origem.trim() : null;
}

/** Normaliza somente decimais finitos com até duas casas, sem arredondar a fonte. */
export function normalizarDecimalExato(valor: unknown) {
  const bruto = typeof valor === "number" && Number.isFinite(valor) ? String(valor) : texto(valor);
  if (!bruto || !/^\d+(\.\d{1,2})?$/.test(bruto)) return null;
  const [inteiro, fracao = ""] = bruto.split(".");
  return `${inteiro!.replace(/^0+(?=\d)/, "")}.${fracao.padEnd(2, "0")}`;
}

export function validarFonteConciliacaoFinanceira(input: {
  modalidade: Modalidade; valor?: string; moeda?: string; dataPagamento?: string; forma?: string; pagadorId: string;
  tipoCobranca: string; dadosOrigem: unknown; complemento?: Complemento;
}) {
  const itens = input.complemento?.itens ?? [];
  if (input.modalidade === "PENDENCIA") {
    if (itens.length) throw new ErroRegra("Pendência não pode declarar campos de pagamento no complemento.");
    return;
  }
  if (!input.valor || !input.moeda || !input.dataPagamento || !input.forma) throw new ErroRegra("Pagamento exige valor, moeda, data e forma.");
  const valorNormalizado = normalizarDecimalExato(input.valor);
  const dataPagamento = z.string().datetime({ offset: true }).safeParse(input.dataPagamento);
  if (!valorNormalizado || !dataPagamento.success) throw new ErroRegra("Valor ou data de pagamento inválidos para a conciliação.");
  const financeiro = input.dadosOrigem && typeof input.dadosOrigem === "object" && !Array.isArray(input.dadosOrigem)
    ? (input.dadosOrigem as { financeiro?: Record<string, unknown> }).financeiro : undefined;
  const esperado: Record<z.infer<typeof campo>, string> = {
    tipo: input.tipoCobranca,
    valor: valorNormalizado,
    moeda: input.moeda,
    situacao: "PAGAMENTO_COMPROVADO",
    dataPagamento: new Date(dataPagamento.data).toISOString(),
    forma: input.forma,
    pagadorId: input.pagadorId,
  };
  const porCampo = new Map(itens.map(item => [item.campo, item]));
  for (const item of itens) {
    const proposto = item.campo === "valor" ? normalizarDecimalExato(item.valorProposto) : item.campo === "dataPagamento" ? (() => {
      const data = z.string().datetime({ offset: true }).safeParse(item.valorProposto); return data.success ? new Date(data.data).toISOString() : null;
    })() : item.valorProposto;
    if (proposto !== esperado[item.campo]) throw new ErroRegra(`O complemento de ${item.campo} precisa reproduzir o valor proposto, sem substituir a fonte.`);
  }
  const fonte: Partial<Record<"tipo" | "valor" | "moeda" | "situacao", string | null>> = {
    tipo: texto(financeiro?.tipo), valor: normalizarDecimalExato(financeiro?.valor), moeda: texto(financeiro?.moeda), situacao: texto(financeiro?.situacao),
  };
  for (const campoFonte of ["tipo", "valor", "moeda"] as const) {
    if (fonte[campoFonte] !== esperado[campoFonte] && !porCampo.has(campoFonte)) throw new ErroRegra(`A fonte não confirma ${campoFonte}; informe complemento com evidência.`);
  }
  for (const campoExigido of ["situacao", "dataPagamento", "forma", "pagadorId"] as const) {
    if (!porCampo.has(campoExigido)) throw new ErroRegra(`Informe complemento evidenciado para ${campoExigido}.`);
  }
}
