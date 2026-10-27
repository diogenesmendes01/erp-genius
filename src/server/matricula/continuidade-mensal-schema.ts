import { z } from "zod";
import { DataCivilSchema } from "./cobertura";
import { RegraVencimentoDiaUtilSchema } from "@/server/financeiro/vencimento-dia-util";

export const DataCivilContinuidadeSchema = DataCivilSchema.refine(
  (data) => data >= "0001-01-01",
  "Data da continuidade deve estar entre os anos 0001 e 9999.",
);

export const RegraCoberturaContinuidadeSchema = z.discriminatedUnion("referencia", [
  z.object({ referencia: z.literal("MES_CIVIL") }).strict(),
  z.object({ referencia: z.literal("CICLO_MATRICULA"), dataReferencia: DataCivilContinuidadeSchema }).strict(),
]);

const DecimalCanonicoSchema = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/, "Informe preço decimal canônico com até duas casas.");
const MoedaSchema = z.string().regex(/^[A-Z]{3}$/, "Informe moeda ISO de três letras.");

export const ReferenciaVencimentoContinuidadeSchema = z.enum(["MES_COBERTURA", "MES_ANTERIOR", "MES_SEGUINTE"]);
const PeriodoCoberturaSchema = z.object({ inicio: DataCivilContinuidadeSchema, fim: DataCivilContinuidadeSchema }).strict().refine((periodo) => periodo.inicio <= periodo.fim, "Cobertura invertida.");

export const ContinuidadeMensalContratadaSchema = z.object({
  contratada: z.literal(true), clausula: z.string().trim().min(1).max(4_000), evidenciaId: z.string().trim().min(1).max(100),
}).strict();

export const RegrasContinuidadeMensalSchema = z.object({
  continuidadeContratada: ContinuidadeMensalContratadaSchema,
  regraCobertura: RegraCoberturaContinuidadeSchema,
  referenciaVencimento: ReferenciaVencimentoContinuidadeSchema,
  diaVencimento: z.number().int().min(1).max(31),
  antecedenciaDias: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  valorOriginal: DecimalCanonicoSchema, valorNegociado: DecimalCanonicoSchema, moeda: MoedaSchema,
  vigenteDesde: DataCivilContinuidadeSchema,
  ajusteVencimento: z.union([z.literal("MANTER_DATA"), RegraVencimentoDiaUtilSchema]),
}).strict();

export const ReferenciaRecomposicaoContinuidadeSchema = z.object({
  aplicacaoId: z.string().trim().min(1), decisaoId: z.string().trim().min(1), cobrancaId: z.string().trim().min(1),
  dataReferencia: DataCivilContinuidadeSchema,
  aplicadaEm: z.string().datetime().optional(),
}).strict();

export const ReferenciaAditivoCoberturaContinuidadeSchema = z.object({
  conjuntoId: z.string().trim().min(1),
  versaoCondicoesId: z.string().trim().min(1),
  decisaoId: z.string().trim().min(1),
  regraAplicada: RegraCoberturaContinuidadeSchema,
}).strict();

export const PlanejarContinuidadeMensalSchema = RegrasContinuidadeMensalSchema.extend({
  ultimaCobertura: PeriodoCoberturaSchema,
  ultimoVencimento: DataCivilContinuidadeSchema.optional(),
  dataPlanejamento: DataCivilContinuidadeSchema,
}).strict();

export type EntradaPlanejarContinuidadeMensal = z.input<typeof PlanejarContinuidadeMensalSchema>;
export type ContinuidadeMensalPlanejada = z.output<typeof PlanejarContinuidadeMensalSchema>;
