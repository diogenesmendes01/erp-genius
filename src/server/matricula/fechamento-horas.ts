import { Prisma } from "@prisma/client";
import { z } from "zod";
import { dinheiro } from "@/server/financeiro/regras";
import { DataCivilSchema } from "./cobertura";
import { classificarOcorrenciaHoras, OcorrenciaHorasSchema } from "./ocorrencia-horas";

const id = z.string().min(1);
const instante = z.string().datetime({ offset: true });
const monetario = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);
const Entrada = z.object({
  matriculaId: id,
  periodo: z.object({ referencia: id, inicio: instante, fimExclusivo: instante }).strict(),
  vencimento: DataCivilSchema,
  moeda: id,
  escolha: z.enum(["AGUARDAR", "PROPOR_PARCIAL"]),
  encontros: z.array(z.object({
    encontroId: id, matriculaId: id, inicio: instante, fim: instante,
    contratoVersaoId: id.nullable(), moeda: id, valorHoraContratado: monetario.nullable(),
    // Somente uma destinação conferida impede nova cobrança. Reserva pendente não é quitação.
    destinacao: z.discriminatedUnion("tipo", [
      z.object({ tipo: z.literal("SEM_DESTINACAO") }).strict(),
      z.object({ tipo: z.literal("ANTECIPACAO_PENDENTE"), reservaId: id }).strict(),
      z.object({ tipo: z.literal("ANTECIPACAO_CONFERIDA"), registroId: id }).strict(),
      z.object({ tipo: z.literal("FATURADA"), cobrancaId: id, itemId: id }).strict(),
    ]),
    ocorrencia: OcorrenciaHorasSchema.nullable(),
  }).strict()),
}).strict();

export type EntradaFechamentoHoras = z.input<typeof Entrada>;

/** Apuração interna, sem efeitos. Origens devem ser carregadas e revalidadas pelo serviço;
 * este plano não comprova conferência, aprovação, quitação ou emissão no banco.
 * Os limites do período vêm da referência contratual, separados do vencimento.
 */
export function apurarFechamentoHoras(input: EntradaFechamentoHoras) {
  const d = Entrada.parse(input);
  if (Date.parse(d.periodo.fimExclusivo) <= Date.parse(d.periodo.inicio)) throw new Error("Período de apuração inválido.");
  if (new Set(d.encontros.map(e => e.encontroId)).size !== d.encontros.length) throw new Error("Encontro duplicado na apuração.");
  const itens: { encontroId: string; contratoVersaoId: string; minutos: number; unidadeMinutos: 60;
    valorHoraContratado: string; valor: string; desfecho: string; limiteCancelamento: string | null;
    origem: z.infer<typeof OcorrenciaHorasSchema> }[] = [];
  const pendencias: { encontroId: string; motivo: string }[] = [];
  const preservados: { encontroId: string; destinacao: EntradaFechamentoHoras["encontros"][number]["destinacao"] }[] = [];
  const semCobranca: { encontroId: string; desfecho: string; limiteCancelamento: string | null;
    origem: z.infer<typeof OcorrenciaHorasSchema> }[] = [];
  for (const e of [...d.encontros].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio) || a.encontroId.localeCompare(b.encontroId))) {
    if (e.matriculaId !== d.matriculaId || e.moeda !== d.moeda) throw new Error("Encontro de outra matrícula ou moeda.");
    const inicio = Date.parse(e.inicio), fim = Date.parse(e.fim);
    if (inicio < Date.parse(d.periodo.inicio) || inicio >= Date.parse(d.periodo.fimExclusivo)) throw new Error("Encontro fora do período de apuração.");
    const minutos = (fim - inicio) / 60000;
    if (!Number.isSafeInteger(minutos) || minutos <= 0) throw new Error("Duração contratada deve conter minutos inteiros positivos; não arredonde o tempo.");
    if (e.ocorrencia && (e.ocorrencia.matriculaId !== e.matriculaId || e.ocorrencia.referenciaEncontro !== e.encontroId
      || e.ocorrencia.contratoVersaoId !== e.contratoVersaoId || Date.parse(e.ocorrencia.inicio) !== inicio || Date.parse(e.ocorrencia.fim) !== fim)) {
      throw new Error("Ocorrência difere do encontro ou da versão contratual conferida.");
    }
    if (e.destinacao.tipo === "FATURADA" || e.destinacao.tipo === "ANTECIPACAO_CONFERIDA") {
      preservados.push({ encontroId: e.encontroId, destinacao: e.destinacao });
      continue;
    }
    if (e.destinacao.tipo === "ANTECIPACAO_PENDENTE") {
      pendencias.push({ encontroId: e.encontroId, motivo: "Conferir a destinação da reserva de horas antecipadas antes de faturar." });
      continue;
    }
    if (!e.ocorrencia) {
      pendencias.push({ encontroId: e.encontroId, motivo: "Ocorrência cobrável ainda não conferida." });
      continue;
    }
    if (!e.contratoVersaoId || e.valorHoraContratado === null) throw new Error("Condições financeiras ausentes para a ocorrência conferida.");
    const o = classificarOcorrenciaHoras(e.ocorrencia);
    if (!o.consomeHoras) {
      semCobranca.push({ encontroId: e.encontroId, desfecho: o.desfecho, limiteCancelamento: o.limiteCancelamento, origem: o.origem });
      continue;
    }
    const valor = dinheiro(new Prisma.Decimal(e.valorHoraContratado).mul(minutos).div(60));
    itens.push({ encontroId: e.encontroId, contratoVersaoId: e.contratoVersaoId, minutos, unidadeMinutos: 60,
      valorHoraContratado: dinheiro(e.valorHoraContratado).toFixed(2), valor: valor.toFixed(2),
      desfecho: o.desfecho, limiteCancelamento: o.limiteCancelamento, origem: o.origem });
  }
  const total = itens.reduce((s, i) => s.plus(i.valor), new Prisma.Decimal(0));
  if (total.gt("9999999999.99")) throw new Error("Total excede a capacidade monetária da cobrança.");
  const estado = pendencias.length ? d.escolha === "AGUARDAR" || !itens.length ? "AGUARDANDO_CONFERENCIA" : "PROPOSTA_PARCIAL"
    : itens.length ? "APURACAO_COMPLETA" : "SEM_ITENS_A_FATURAR";
  return { matriculaId: d.matriculaId, periodo: d.periodo, vencimento: d.vencimento, moeda: d.moeda,
    estado, exigeAprovacaoIndependente: estado === "PROPOSTA_PARCIAL", itens, pendencias, preservados, semCobranca,
    totalApurado: total.toFixed(2), minutosApurados: itens.reduce((s, i) => s + i.minutos, 0),
    // Mantém a apuração visível mesmo quando a decisão foi aguardar.
    emiteCobranca: false as const, alteraDiario: false as const };
}
