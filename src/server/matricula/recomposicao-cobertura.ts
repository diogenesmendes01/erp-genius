import { z } from "zod";
import { DataCivilSchema } from "./cobertura";
import { ErroRegra } from "@/server/_shared";

const Intervalo = z.object({ inicio: DataCivilSchema, fim: DataCivilSchema }).strict().refine((v) => v.fim >= v.inicio, "Cobertura invertida.");
const Valor = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
export const RecomposicaoCoberturaSchema = z.object({
  matriculaId: z.string().min(1), moeda: z.string().regex(/^[A-Z]{3}$/),
  retornoOferta: DataCivilSchema, inicioCompensacao: DataCivilSchema,
  motivo: z.string().trim().min(5).max(2000), evidenciaCondicoes: z.string().trim().min(5).max(2000),
  direitos: z.array(z.object({
    id: z.string().min(1), matriculaId: z.string().min(1), compensacaoId: z.string().min(1),
    diaOrigem: DataCivilSchema, estado: z.enum(["PENDENTE", "RECOMPOSTO", "LIQUIDADO_FINANCEIRAMENTE"]), versao: z.number().int().positive(),
  }).strict()).min(1).max(3660),
  // O servidor deve fornecer toda a cobertura vigente, inclusive períodos preservados.
  periodosAtuais: z.array(z.object({
    cobrancaId: z.string().min(1), matriculaId: z.string().min(1), versao: z.number().int().nonnegative(),
    cobertura: Intervalo, valor: Valor, moeda: z.string().regex(/^[A-Z]{3}$/), vencimento: DataCivilSchema,
  }).strict()).max(1000),
  periodosPropostos: z.array(z.object({ cobrancaId: z.string().min(1), cobertura: Intervalo }).strict()).max(1000),
}).strict();

const instante = (d: string) => Date.parse(`${d}T00:00:00Z`);
const quantidade = (p: { inicio: string; fim: string }) => (instante(p.fim) - instante(p.inicio)) / 86400000 + 1;
const somarDias = (d: string, n: number) => DataCivilSchema.parse(new Date(instante(d) + n * 86400000).toISOString().slice(0, 10));
export class ErroRecomposicao extends ErroRegra {}

/** Q70: confere uma proposta explícita. Não muda cobertura, vencimentos ou destinação dos direitos. */
export function conferirRecomposicaoCobertura(input: z.input<typeof RecomposicaoCoberturaSchema>) {
  const d = RecomposicaoCoberturaSchema.parse(input);
  const falhar = (mensagem: string): never => { throw new ErroRecomposicao(mensagem); };
  if (d.inicioCompensacao < d.retornoOferta) falhar("Compensação não pode começar antes do retorno da oferta.");
  if (d.direitos.some((v) => v.matriculaId !== d.matriculaId || v.estado !== "PENDENTE")) falhar("Use somente direitos pendentes desta matrícula.");
  if (new Set(d.direitos.map((v) => v.id)).size !== d.direitos.length || new Set(d.direitos.map((v) => v.diaOrigem)).size !== d.direitos.length) falhar("Direito de compensação repetido.");
  if (d.direitos.some((v) => v.diaOrigem >= d.inicioCompensacao)) falhar("A compensação deve ocorrer depois do dia de indisponibilidade de origem.");
  const ids = new Set(d.periodosAtuais.map((p) => p.cobrancaId));
  if (ids.size !== d.periodosAtuais.length || d.periodosPropostos.length !== ids.size || new Set(d.periodosPropostos.map((p) => p.cobrancaId)).size !== ids.size || d.periodosPropostos.some((p) => !ids.has(p.cobrancaId))) falhar("A proposta deve contemplar cada período atual exatamente uma vez.");
  const compensacao = { inicio: d.inicioCompensacao, fim: somarDias(d.inicioCompensacao, d.direitos.length - 1) };
  const periodos = d.periodosAtuais.map((p) => {
    if (p.matriculaId !== d.matriculaId || p.moeda !== d.moeda) falhar("Período pertence a outra matrícula ou moeda.");
    const nova = d.periodosPropostos.find((v) => v.cobrancaId === p.cobrancaId)!.cobertura;
    const alterado = nova.inicio !== p.cobertura.inicio || nova.fim !== p.cobertura.fim;
    if (alterado && p.cobertura.inicio < d.retornoOferta) falhar("Período já iniciado antes do retorno exige conferência específica; não reprograme o histórico.");
    if (quantidade(nova) !== quantidade(p.cobertura)) falhar("Reprogramação não pode reduzir ou ampliar os dias contratados do período cobrado.");
    return { ...p, coberturaOriginal: p.cobertura, cobertura: nova, alterado };
  });
  const intervalos = [...periodos.map((p) => p.cobertura), compensacao].sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (let i = 1; i < intervalos.length; i++) if (intervalos[i].inicio <= intervalos[i - 1].fim) falhar("Coberturas sobrepostas: dias compensados não podem receber nova cobrança.");
  return { matriculaId: d.matriculaId, moeda: d.moeda, motivo: d.motivo, evidenciaCondicoes: d.evidenciaCondicoes,
    retornoOferta: d.retornoOferta, compensacao, quantidadeDias: d.direitos.length,
    destinos: [...d.direitos].sort((a, b) => a.diaOrigem.localeCompare(b.diaOrigem)).map((v, i) => ({ ...v, diaCompensadoProposto: somarDias(compensacao.inicio, i) })),
    periodos, valorAdicional: "0.00", exigeAprovacaoIndependente: true as const,
  };
}
