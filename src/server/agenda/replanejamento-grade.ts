import { z } from "zod";
import { GradeEncontrosSchema, gerarGradeEncontros } from "./grade";
import { dataCivilInstitucional } from "@/server/operacao/fuso";

const Entrada = z.object({
  grade: GradeEncontrosSchema.omit({ quantidadeAulas: true }),
  agora: z.string().datetime(),
  // Q41–Q43 usa meta explícita; a revisão de calendário mantém o padrão de
  // regenerar exatamente os futuros já existentes.
  quantidadeAulasAlvo: z.number().int().positive().optional(),
  encontros: z.array(z.object({ id: z.string().min(1), inicio: z.string().datetime(), fim: z.string().datetime(),
    status: z.enum(["PREVISTO", "MINISTRADO", "CANCELADO", "RASCUNHO", "NAO_REALIZADO", "IMPEDIDO_ESCOLA"]) }).strict()).max(10000),
}).strict();

/** Proposta pura: mantém identidade/quantidade; não aplica nem confirma recursos. */
export function proporReplanejamentoGrade(input: z.input<typeof Entrada>) {
  const d = Entrada.parse(input), agora = Date.parse(d.agora);
  if (new Set(d.encontros.map((e) => e.id)).size !== d.encontros.length) throw new Error("Encontro repetido na revisão.");
  if (d.encontros.some((e) => Date.parse(e.fim) <= Date.parse(e.inicio))) throw new Error("Intervalo de encontro inválido.");
  if (d.encontros.some((e) => e.status === "MINISTRADO" && Date.parse(e.fim) > agora)) throw new Error("Aula ministrada futura exige conferência antes de replanejar.");
  const futuros = d.encontros.filter((e) => e.status === "PREVISTO" && Date.parse(e.inicio) > agora)
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id.localeCompare(b.id));
  const preservados = d.encontros.filter((e) => !futuros.some((f) => f.id === e.id));
  const limite = Math.max(agora, ...preservados.filter((e) => e.status === "PREVISTO" || e.status === "MINISTRADO").map((e) => Date.parse(e.fim)));
  const diaLimite = dataCivilInstitucional(new Date(limite), d.grade.fusoOrigem);
  let dataInicial = d.grade.dataInicial > diaLimite ? d.grade.dataInicial : diaLimite;
  // Há duas métricas: cumprimento conta só MINISTRADO, mas planejamento também
  // reserva PREVISTO passado. Diário atrasado não pode criar aula extra.
  const oficiaisPreservados = preservados.filter((e) => e.status === "MINISTRADO" || e.status === "PREVISTO").length;
  const quantidadeFutura = d.quantidadeAulasAlvo === undefined ? futuros.length : Math.max(0, d.quantidadeAulasAlvo - oficiaisPreservados);
  let grade: ReturnType<typeof gerarGradeEncontros> | null = null;
  if (quantidadeFutura) {
    grade = gerarGradeEncontros({ ...d.grade, dataInicial, quantidadeAulas: quantidadeFutura });
    // Pode haver um encontro da grade mais cedo no mesmo dia do limite.
    if (Date.parse(grade.primeiraAula) <= limite) {
      dataInicial = new Date(Date.parse(`${dataInicial}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
      grade = gerarGradeEncontros({ ...d.grade, dataInicial, quantidadeAulas: quantidadeFutura });
    }
  }
  const propostas = futuros.slice(0, quantidadeFutura).map((e, i) => {
    const novo = grade!.encontros[i];
    return { encontroId: e.id, inicioAnterior: e.inicio, fimAnterior: e.fim, inicioProposto: novo.inicio, fimProposto: novo.fim,
      alterado: e.inicio !== novo.inicio || e.fim !== novo.fim };
  });
  const extensaoQuantidade = d.quantidadeAulasAlvo === undefined ? {} : {
    removidos: futuros.slice(quantidadeFutura).map((e) => ({ encontroId: e.id, inicioAnterior: e.inicio, fimAnterior: e.fim })),
    adicionados: grade?.encontros.slice(futuros.length).map((e) => ({ inicioProposto: e.inicio, fimProposto: e.fim })) ?? [],
  };
  return { propostas, preservados, previsaoTermino: grade?.previsaoTermino ?? null, ...extensaoQuantidade,
    verificacoesPendentes: ["Atribuições e exceções específicas dos encontros", "Conflitos e indisponibilidade docente", "Reservas comerciais", "Revisão e aprovação conjunta"],
    aplicada: false as const };
}
