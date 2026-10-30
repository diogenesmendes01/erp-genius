import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HABILIDADES } from "./calculo";

const decimal = z.string().max(100).regex(/^-?\d+(\.\d+)?$/);
const habilidade = z.enum(HABILIDADES);
const quantidade = z.number().int().min(0).max(2147483647);
const prazo = quantidade.min(1);
const id = z.string().trim().min(1).max(100);

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

export type ConteudoRegraAvaliacao = z.output<typeof ConteudoRegraAvaliacaoSchema>;

/**
 * Defaults de compatibilidade para versões gravadas antes da evolução do schema (#530).
 *
 * A ordem das migrations mostra quando cada campo passou a existir no conteúdo:
 * - `habilidades[].limiteRecuperacoes`: lido pelos guards a partir de 20260913170000_cancelamento_reserva_recuperacao;
 * - `recuperacao`: lido a partir de 20260913180000_disponibilizacao_recuperacao;
 * - `segundaChamada` e `avaliacoes[].limiteSegundasChamadas`: a partir de 20260915005000_segunda_chamada.
 * Versões anteriores (ou gravadas por seed/SQL direto no QA) não têm esses campos.
 *
 * Os defaults são os mais restritivos aceitos pelo schema: limite 0 (nenhuma recuperação ou
 * segunda chamada), prazo mínimo de 1 minuto e antecedência 0. Servem apenas para EXIBIR a
 * versão antiga; o cálculo de nota continua exigindo conteúdo estritamente válido
 * (ver `exigirConteudoRegra`) e nada é gravado no banco.
 */
export const DEFAULTS_REGRA_LEGADA = Object.freeze({
  limiteRecuperacoes: 0,
  limiteSegundasChamadas: 0,
  recuperacao: Object.freeze({ prazoRealizacaoMinutos: 1, antecedenciaCancelamentoMinutos: 0 }),
  segundaChamada: Object.freeze({ prazoRealizacaoMinutos: 1, antecedenciaCancelamentoMinutos: 0 }),
});

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const ausente = (o: Record<string, unknown>, chave: string) => !Object.prototype.hasOwnProperty.call(o, chave) || o[chave] === undefined;

/**
 * Normalização pura e determinística: devolve uma CÓPIA do conteúdo com os campos ausentes
 * conhecidos preenchidos. Nunca altera a entrada nem sobrescreve valor existente.
 */
export function normalizarConteudoLegado(raw: unknown): { conteudo: unknown; camposPreenchidos: string[] } {
  if (!objeto(raw)) return { conteudo: raw, camposPreenchidos: [] };
  const c: Record<string, unknown> = structuredClone(raw);
  const campos: string[] = [];
  if (Array.isArray(c.habilidades)) c.habilidades.forEach((h, i) => {
    if (objeto(h) && ausente(h, "limiteRecuperacoes")) { h.limiteRecuperacoes = DEFAULTS_REGRA_LEGADA.limiteRecuperacoes; campos.push(`habilidades.${i}.limiteRecuperacoes`); }
  });
  if (Array.isArray(c.avaliacoes)) c.avaliacoes.forEach((a, i) => {
    if (objeto(a) && ausente(a, "limiteSegundasChamadas")) { a.limiteSegundasChamadas = DEFAULTS_REGRA_LEGADA.limiteSegundasChamadas; campos.push(`avaliacoes.${i}.limiteSegundasChamadas`); }
  });
  for (const chave of ["recuperacao", "segundaChamada"] as const) {
    const padrao = DEFAULTS_REGRA_LEGADA[chave];
    if (ausente(c, chave)) { c[chave] = { ...padrao }; campos.push(chave); continue; }
    const atual = c[chave];
    if (!objeto(atual)) continue;
    for (const k of ["prazoRealizacaoMinutos", "antecedenciaCancelamentoMinutos"] as const)
      if (ausente(atual, k)) { atual[k] = padrao[k]; campos.push(`${chave}.${k}`); }
  }
  return { conteudo: c, camposPreenchidos: campos };
}

export type LeituraConteudoRegra =
  | { ok: true; conteudo: ConteudoRegraAvaliacao; legado: false; camposPreenchidos: [] }
  | { ok: true; conteudo: ConteudoRegraAvaliacao; legado: true; camposPreenchidos: string[] }
  | { ok: false; legado: true; caminhos: string[] };

/** Leitura tolerante (somente exibição). A gravação continua usando o schema estrito. */
export function lerConteudoRegra(raw: unknown): LeituraConteudoRegra {
  const direto = ConteudoRegraAvaliacaoSchema.safeParse(raw);
  if (direto.success) return { ok: true, conteudo: direto.data, legado: false, camposPreenchidos: [] };
  const n = normalizarConteudoLegado(raw);
  if (n.camposPreenchidos.length) {
    const normalizado = ConteudoRegraAvaliacaoSchema.safeParse(n.conteudo);
    if (normalizado.success) return { ok: true, conteudo: normalizado.data, legado: true, camposPreenchidos: n.camposPreenchidos };
    return { ok: false, legado: true, caminhos: [...new Set(normalizado.error.issues.map(i => i.path.join(".")))] };
  }
  return { ok: false, legado: true, caminhos: [...new Set(direto.error.issues.map(i => i.path.join(".")))] };
}
