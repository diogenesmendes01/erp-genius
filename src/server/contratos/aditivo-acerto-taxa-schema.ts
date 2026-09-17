import { z } from "zod";

const id = z.string().trim().min(1).max(100);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const chave = z.string().trim().min(1).max(200);
const valor = z.string().regex(/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/);

export const ConsultarAlvosAcertoTaxaAditivoSchema = z.object({
  matriculaId: id,
  propostaId: id,
  conclusaoId: id,
  revisaoHash: hash,
}).strict();

export const ProporAcertoTaxaAditivoSchema = ConsultarAlvosAcertoTaxaAditivoSchema.extend({
  cobrancaId: id,
  motivo: z.string().trim().min(5).max(2000),
  evidencia: z.record(z.unknown()),
  chaveIdempotencia: chave,
}).strict();

export const DecidirAcertoTaxaAditivoSchema = z.object({
  propostaId: id,
  aprovada: z.boolean(),
  motivo: z.string().trim().min(5).max(2000),
  chaveIdempotencia: chave,
}).strict();

/** Dados calculados exclusivamente da versão formalizada e da cobrança fotografada. */
export const MemoriaAcertoTaxaAditivoSchema = z.object({
  condicoesHash: hash,
  revisaoHash: hash,
  taxa: z.object({ valorNovo: valor, vencimentoNovo: z.string().date() }).strict(),
  liquidacao: z.object({
    jaLiquidado: valor,
    creditoAnterior: valor,
    saldoAposAcerto: valor,
    creditoExcedente: valor,
    exigeCredito: z.boolean(),
    pendencia: z.object({
      codigo: z.literal("CONCILIAR_CREDITO_EXISTENTE"),
      valor,
      tratamento: z.string().min(1),
    }).nullable(),
  }).strict(),
  cobranca: z.object({
    id,
    matriculaId: id,
    tipo: z.literal("MATRICULA"),
    versao: z.number().int().positive(),
    status: z.enum(["PENDENTE", "ATRASADO", "PAGO", "CANCELADA"]),
    moeda: z.string().regex(/^[A-Z]{3}$/),
    valorOriginal: valor,
    valorNegociado: valor,
    valorRecebido: valor.nullable(),
    valorLiquidadoCredito: valor,
    saldo: valor.nullable(),
    vencimento: z.string().date(),
    movimento: z.object({
      recebimentos: z.number().int().nonnegative(),
      informesAtivos: z.number().int().nonnegative(),
      usosCredito: z.number().int().nonnegative(),
      compensacoes: z.number().int().nonnegative(),
      ajusteAcertoId: id.nullable(),
      suspensaPorPausaId: id.nullable(),
      canceladaPorPausaId: id.nullable(),
    }).strict(),
  }).strict(),
  comissoes: z.array(z.object({ id, versao: z.number().int().positive().optional(), status: z.string(), tipo: z.string(), valor: valor, valorBase: valor.nullable() }).strict()),
}).strict();

export type ProporAcertoTaxaAditivoInput = z.input<typeof ProporAcertoTaxaAditivoSchema>;
export type DecidirAcertoTaxaAditivoInput = z.input<typeof DecidirAcertoTaxaAditivoSchema>;
