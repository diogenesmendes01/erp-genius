import { z } from "zod";

const TurmaEntrada = z.object({
  turmaId: z.string().min(1),
  quantidadeVigente: z.number().int().positive(),
  status: z.enum(["PLANEJADA", "ABERTA", "EM_ANDAMENTO", "CONCLUIDA"]),
  publicada: z.boolean(),
  primeiroEncontroOficial: z.string().datetime().nullable(),
  // O diário pode ser lançado tardiamente; não serve para redefinir início.
  diarioMaisRecente: z.string().datetime().nullable().optional(),
  excecoesQ37: z.array(z.string().min(1)).default([]),
}).strict();

const Entrada = z.object({
  quantidadeAnterior: z.number().int().positive(),
  quantidadeNova: z.number().int().positive(),
  agora: z.string().datetime(),
  turmas: z.array(TurmaEntrada).max(10000),
}).strict().superRefine((d, ctx) => {
  if (d.quantidadeAnterior === d.quantidadeNova) ctx.addIssue({ code: "custom", message: "A quantidade nova deve ser diferente da atual." });
  if (new Set(d.turmas.map((t) => t.turmaId)).size !== d.turmas.length) ctx.addIssue({ code: "custom", message: "Turma repetida no impacto." });
});

export type PreviaQuantidadeAulas = ReturnType<typeof preverImpactoQuantidadeAulas>;

/**
 * Classifica o alcance Q41–Q43 sem gravar ou publicar agenda. O início efetivo
 * vem do primeiro encontro oficial não cancelado, e não de status derivado.
 */
export function preverImpactoQuantidadeAulas(input: z.input<typeof Entrada>) {
  const d = Entrada.parse(input);
  const agora = Date.parse(d.agora);
  const aumento = d.quantidadeNova > d.quantidadeAnterior;
  const impactos = d.turmas.map((turma) => {
    const iniciadaEm = turma.primeiroEncontroOficial ? Date.parse(turma.primeiroEncontroOficial) : null;
    const finalizada = turma.status === "CONCLUIDA";
    const iniciada = !finalizada && iniciadaEm !== null && iniciadaEm <= agora;
    const rascunho = !turma.publicada && !iniciada;
    let alcance:
      | "FINALIZADA_PRESERVADA"
      | "REDUCAO_INICIADA_PRESERVADA"
      | "REDUCAO_NAO_INICIADA"
      | "REDUCAO_RASCUNHO"
      | "AUMENTO_INICIADA"
      | "AUMENTO_NAO_INICIADA"
      | "AUMENTO_RASCUNHO";
    let quantidadeAplicada = turma.quantidadeVigente;
    let causa = "Meta vigente da turma.";
    if (finalizada) { alcance = "FINALIZADA_PRESERVADA"; causa = "Turma finalizada preserva a meta histórica."; }
    else if (!aumento && iniciada) { alcance = "REDUCAO_INICIADA_PRESERVADA"; causa = "Redução não alcança turma já iniciada."; }
    else if (aumento && turma.quantidadeVigente >= d.quantidadeNova) { alcance = iniciada ? "AUMENTO_INICIADA" : rascunho ? "AUMENTO_RASCUNHO" : "AUMENTO_NAO_INICIADA"; causa = "Meta vigente da turma já atende ou supera a nova meta."; }
    else if (aumento && rascunho) { alcance = "AUMENTO_RASCUNHO"; quantidadeAplicada = d.quantidadeNova; causa = "Aumento recalcula rascunho sem publicar."; }
    else if (!aumento && rascunho) { alcance = "REDUCAO_RASCUNHO"; quantidadeAplicada = d.quantidadeNova; causa = "Redução alcança rascunho ainda não iniciado."; }
    else if (aumento && iniciada) { alcance = "AUMENTO_INICIADA"; quantidadeAplicada = d.quantidadeNova; causa = "Aumento alcança turma iniciada."; }
    else if (aumento) { alcance = "AUMENTO_NAO_INICIADA"; quantidadeAplicada = d.quantidadeNova; causa = "Aumento alcança turma não iniciada."; }
    else { alcance = "REDUCAO_NAO_INICIADA"; quantidadeAplicada = d.quantidadeNova; causa = "Redução alcança turma não iniciada."; }
    return {
      ...turma,
      alcance,
      iniciadaEm: turma.primeiroEncontroOficial,
      quantidadeAnterior: d.quantidadeAnterior,
      quantidadeVigente: turma.quantidadeVigente,
      quantidadeNova: quantidadeAplicada,
      causa,
      dadosIncoerentes: !turma.publicada && iniciada ? ["Há encontro oficial passado em turma marcada como rascunho; confira antes de aplicar."] : [],
      preservada: quantidadeAplicada === turma.quantidadeVigente,
      publicaAgenda: turma.publicada && quantidadeAplicada !== turma.quantidadeVigente,
      recalculaSomenteRascunho: !turma.publicada && quantidadeAplicada !== turma.quantidadeVigente,
    };
  }).sort((a, b) => a.turmaId.localeCompare(b.turmaId));
  return {
    tipo: aumento ? "AUMENTO" as const : "REDUCAO" as const,
    quantidadeAnterior: d.quantidadeAnterior,
    quantidadeNova: d.quantidadeNova,
    impactos,
    requerAprovacaoConjunta: impactos.some((i) => i.publicaAgenda),
    aplicada: false as const,
    publicada: false as const,
  };
}
