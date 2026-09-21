import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HABILIDADES } from "./calculo";

const decimal = z.string().max(100).regex(/^-?\d+(\.\d+)?$/);
const habilidade = z.enum(HABILIDADES);
const quantidade = z.number().int().min(0).max(2147483647);
const prazo = quantidade.min(1);
const id = z.string().trim().min(1).max(100);

/** Todos os parâmetros pedagógicos são explícitos; minutos são a unidade armazenada. */
export const ConteudoRegraAvaliacaoSchema = z.object({
  titulo: z.string().trim().min(3).max(200),
  aplicacao: z.string().trim().min(5).max(2000),
  escala: z.object({ minimo: decimal, maximo: decimal }).strict(),
  minimoGeral: decimal,
  frequenciaMinimaPercentual: decimal,
  habilidades: z.array(z.object({
    habilidade, peso: decimal, minimo: decimal, limiteRecuperacoes: quantidade,
  }).strict()).length(4),
  avaliacoes: z.array(z.object({
    codigo: id, titulo: z.string().trim().min(3).max(200),
    etapa: z.enum(["INTERMEDIARIA", "FINAL"]), peso: decimal,
    habilidades: z.array(habilidade).min(1).max(4), limiteSegundasChamadas: quantidade,
  }).strict()).min(2).max(1000),
  recuperacao: z.object({ prazoRealizacaoMinutos: prazo, antecedenciaCancelamentoMinutos: quantidade }).strict(),
  segundaChamada: z.object({ prazoRealizacaoMinutos: prazo, antecedenciaCancelamentoMinutos: quantidade }).strict(),
}).strict().superRefine((d, ctx) => {
  // Refinamentos de formato podem falhar antes daqui: não entregar decimal inválido ao construtor.
  const valores = [d.escala.minimo, d.escala.maximo, d.minimoGeral, d.frequenciaMinimaPercentual,
    ...d.habilidades.flatMap(h => [h.peso, h.minimo]), ...d.avaliacoes.map(a => a.peso)];
  if (valores.some(v => !decimal.safeParse(v).success)) return;
  const erro = (message: string) => ctx.addIssue({ code: "custom", message });
  const menor = new Prisma.Decimal(d.escala.minimo), maior = new Prisma.Decimal(d.escala.maximo);
  if (!menor.lt(maior)) erro("Escala deve ter mínimo menor que máximo.");
  if ([d.minimoGeral, ...d.habilidades.map(h => h.minimo)].some(n => new Prisma.Decimal(n).lt(menor) || new Prisma.Decimal(n).gt(maior))) erro("Mínimos de nota devem pertencer à escala.");
  if ([...d.habilidades.map(h => h.peso), ...d.avaliacoes.map(a => a.peso)].some(n => !new Prisma.Decimal(n).gt(0))) erro("Pesos devem ser positivos.");
  const frequencia = new Prisma.Decimal(d.frequenciaMinimaPercentual);
  if (frequencia.lt(0) || frequencia.gt(100)) erro("Frequência mínima deve estar entre 0 e 100 por cento.");
  if (new Set(d.habilidades.map(h => h.habilidade)).size !== 4) erro("Configure as quatro habilidades sem repetição.");
  if (new Set(d.avaliacoes.map(a => a.codigo)).size !== d.avaliacoes.length) erro("Código de avaliação repetido.");
  if (d.avaliacoes.some(a => new Set(a.habilidades).size !== a.habilidades.length)) erro("Habilidade repetida na avaliação.");
  if (!d.avaliacoes.some(a => a.etapa === "INTERMEDIARIA")) erro("Configure ao menos uma avaliação intermediária.");
  const final = new Set(d.avaliacoes.filter(a => a.etapa === "FINAL").flatMap(a => a.habilidades));
  if (final.size !== 4) erro("A etapa final precisa cobrir as quatro habilidades.");
});

export const PrepararRegraAvaliacaoSchema = z.object({
  nivelId: id, versaoEsperada: quantidade,
  conteudo: ConteudoRegraAvaliacaoSchema,
  motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100),
}).strict();
export const DecidirRegraAvaliacaoSchema = z.object({
  regraId: id, conteudoHash: z.string().regex(/^[a-f0-9]{64}$/),
  aprovada: z.boolean(), motivo: z.string().trim().min(5).max(2000),
}).strict();
