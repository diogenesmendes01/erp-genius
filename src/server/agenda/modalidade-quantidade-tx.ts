import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { PeriodosCalendarioSchema } from "./calendario-schema";
import { GradeEncontrosSchema } from "./grade";
import { conferirConflitosReplanejamento } from "./replanejamento-conflitos";
import { proporReplanejamentoGrade } from "./replanejamento-grade";
import { preverImpactoQuantidadeAulas } from "./modalidade-quantidade-preview";
import { diasPorSemanaDaFrequencia } from "@/server/turmas/schema";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const origemGrade = z.object({ origem: GradeEncontrosSchema.pick({ dataInicial: true, diasSemana: true, horario: true, duracaoMinutos: true }).passthrough() }).passthrough();

/** Estado atual, completo e não persistente usado para proposta, decisão e aplicação Q41–Q43. */
export async function carregarPreviaQuantidadeAulasTx(tx: Prisma.TransactionClient, input: { modalidadeId: string; quantidadeNova: number; agora?: Date }) {
  const agora = input.agora ?? new Date();
  const modalidade = await tx.modalidade.findUnique({ where: { id: input.modalidadeId } });
  if (!modalidade || !modalidade.aulasPorNivel || modalidade.aulasPorNivel <= 0) throw new ErroRegra("Modalidade sem quantidade atual de aulas válida.");
  const calendario = await tx.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" } });
  const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
  if (!calendario || config?.fusoInstitucional !== calendario.fusoInstitucional) throw new ErroRegra("Calendário institucional aprovado e fuso correspondente são obrigatórios.");
  const periodos = PeriodosCalendarioSchema.parse(calendario.periodos);
  const turmas = await tx.turma.findMany({ where: { modalidadeId: modalidade.id }, orderBy: { id: "asc" }, select: {
    id: true, codigo: true, status: true, professorId: true,
    encontrosAgenda: { orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true, fim: true, status: true, professorId: true, propostaGradeId: true, fusoOrigem: true, motivo: true } },
    propostasGrade: { orderBy: { versao: "desc" }, select: { id: true, fusoOrigem: true, snapshot: true, decisao: { select: { aprovada: true } } } },
    impactosQuantidadeAulas: { where: { proposta: { aplicacao: { isNot: null } } }, orderBy: { criadoEm: "desc" }, take: 1, select: { quantidadeNova: true } },
  } });
  const origensEfetivas = new Map(turmas.map((t) => {
    const publicada = t.encontrosAgenda.some((e) => e.status !== "RASCUNHO");
    return [t.id, publicada ? t.propostasGrade.find((p) => p.decisao?.aprovada) ?? null : t.propostasGrade[0] ?? null] as const;
  }));
  const quantidadeVigente = (t: typeof turmas[number]) => {
    const proposta = origensEfetivas.get(t.id);
    const origem = proposta ? origemGrade.safeParse(proposta.snapshot) : null;
    if (t.impactosQuantidadeAulas[0]) return t.impactosQuantidadeAulas[0].quantidadeNova;
    if (origem?.success && typeof origem.data.origem.quantidadeAulas === "number" && origem.data.origem.quantidadeAulas > 0) return origem.data.origem.quantidadeAulas;
    // Rascunho sem grade ainda não tem meta histórica; a modalidade é a origem
    // explícita somente enquanto não houver agenda publicada.
    if (!t.encontrosAgenda.some((e) => e.status !== "RASCUNHO")) return modalidade.aulasPorNivel!;
    return modalidade.aulasPorNivel!;
  };
  const classificacao = preverImpactoQuantidadeAulas({ quantidadeAnterior: modalidade.aulasPorNivel, quantidadeNova: input.quantidadeNova, agora: agora.toISOString(), turmas: turmas.map((t) => ({
    turmaId: t.id, status: t.status, publicada: t.encontrosAgenda.some((e) => e.status !== "RASCUNHO"),
    quantidadeVigente: quantidadeVigente(t),
    primeiroEncontroOficial: t.encontrosAgenda.find((e) => e.status !== "RASCUNHO" && e.status !== "CANCELADO")?.inicio.toISOString() ?? null,
    excecoesQ37: [],
  })) });
  const impactos = classificacao.impactos.map((base) => {
    const turma = turmas.find((t) => t.id === base.turmaId)!;
    // Agenda publicada só pode usar a última grade aprovada; um rascunho ou
    // rejeição posterior não redefine sua origem. Rascunho usa sua versão mais
    // recente, ainda não publicada.
    const proposta = origensEfetivas.get(turma.id) ?? null;
    const pendencias: string[] = [...base.dadosIncoerentes];
    const excecoesQ37: string[] = [];
    let parametrosGradeAprovada: { duracaoMinutos: number; frequencia: string | null; diasSemana: number[] } | null = null;
    let previsao: ReturnType<typeof proporReplanejamentoGrade> | null = null;
    if (base.quantidadeNova !== base.quantidadeAnterior) {
      if (!proposta && base.publicada) pendencias.push("Turma publicada sem grade aprovada com meta histórica: confira antes de alterar a meta.");
      else if (!proposta) {
        // Rascunho sem encontros pode receber a nova meta para sua grade futura;
        // não cria nem confirma agenda oficial.
        if (turma.encontrosAgenda.length) pendencias.push("Rascunho sem origem de grade exige conferência antes do recálculo.");
      }
      else {
        const origem = origemGrade.safeParse(proposta.snapshot);
        if (!origem.success) pendencias.push("Snapshot da grade aprovada está incompleto.");
        else {
          const o = origem.data.origem;
          parametrosGradeAprovada = { duracaoMinutos: o.duracaoMinutos, frequencia: typeof o.frequencia === "string" ? o.frequencia : null, diasSemana: [...o.diasSemana] };
          const quantidadeSnapshot = typeof o.quantidadeAulas === "number" ? o.quantidadeAulas : modalidade.aulasPorNivel;
          const frequenciaDaOrigem = typeof o.frequencia === "string" ? o.frequencia : null;
          const frequenciaPadrao = diasPorSemanaDaFrequencia(modalidade.frequencia);
          const diasDaOrigem = new Set(o.diasSemana).size;
          // A aplicação de quantidade reutiliza exatamente a grade já aprovada
          // da turma. Duração ou frequência particular são uma exceção Q37
          // visível, não autorização para reverter ao padrão da modalidade.
          if (quantidadeSnapshot !== modalidade.aulasPorNivel || o.duracaoMinutos !== modalidade.horasAula * 60 || (frequenciaDaOrigem !== null && frequenciaDaOrigem !== modalidade.frequencia) || diasDaOrigem !== frequenciaPadrao) excecoesQ37.push(proposta.id);
          try { previsao = proporReplanejamentoGrade({ agora: agora.toISOString(), quantidadeAulasAlvo: base.quantidadeNova,
            grade: { dataInicial: o.dataInicial, diasSemana: o.diasSemana, horario: o.horario, duracaoMinutos: o.duracaoMinutos,
              fusoOrigem: proposta.fusoOrigem, fusoEscola: calendario.fusoInstitucional, periodos },
            encontros: turma.encontrosAgenda.map((e) => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), status: e.status })),
          }); } catch (e) { pendencias.push(e instanceof Error ? e.message : "Não foi possível recalcular a turma."); }
        }
      }
    }
    const agendaAntes = turma.encontrosAgenda.map((e) => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), status: e.status, professorId: e.professorId, propostaGradeId: e.propostaGradeId }));
    const agendaDepois = previsao ? [
      ...previsao.preservados.map((e) => ({ ...agendaAntes.find((a) => a.id === e.id)!, inicio: e.inicio, fim: e.fim, status: e.status })),
      ...previsao.propostas.map((e) => ({ ...agendaAntes.find((a) => a.id === e.encontroId)!, inicio: e.inicioProposto, fim: e.fimProposto, status: base.publicada ? "PREVISTO" : "RASCUNHO" })),
      ...(previsao.removidos ?? []).map((e) => ({ ...agendaAntes.find((a) => a.id === e.encontroId)!, inicio: e.inicioAnterior, fim: e.fimAnterior, status: "CANCELADO" })),
      ...(previsao.adicionados ?? []).map((e) => ({ id: null, inicio: e.inicioProposto, fim: e.fimProposto, status: base.publicada ? "PREVISTO" : "RASCUNHO", professorId: turma.professorId, propostaGradeId: proposta?.id ?? null })),
    ] : agendaAntes;
    return { ...base, codigo: turma.codigo, professorId: turma.professorId, propostaGradeId: proposta?.id ?? null, fusoOrigem: proposta?.fusoOrigem ?? null, parametrosGradeAprovada,
      excecoesQ37, pendencias, agendaAntes, agendaDepois, previsao };
  });
  const intervalos = impactos.filter((i) => i.publicaAgenda).flatMap((i) => i.previsao?.propostas.map((p) => ({ encontroId: p.encontroId, turmaId: i.turmaId, professorId: turmas.find((t) => t.id === i.turmaId)?.encontrosAgenda.find((e) => e.id === p.encontroId)?.professorId ?? null, inicio: p.inicioProposto, fim: p.fimProposto })) ?? [])
    .concat(impactos.filter((i) => i.publicaAgenda).flatMap((i) => (i.previsao?.adicionados ?? []).map((p, indice) => ({ encontroId: `novo:${i.turmaId}:${indice}`, turmaId: i.turmaId, professorId: i.professorId, inicio: p.inicioProposto, fim: p.fimProposto }))));
  const recursos = await conferirConflitosReplanejamento(tx, intervalos);
  const semPendencia = impactos.every((i) => !i.pendencias.length);
  const estado = { modalidadeId: modalidade.id, quantidadeAnterior: modalidade.aulasPorNivel, quantidadeNova: input.quantidadeNova, calendarioId: calendario.id,
    impactos: impactos.map(({ previsao, ...i }) => i), recursos };
  return { ...estado, impactos, estadoHash: hash(estado), conferidoEm: agora.toISOString(), aplicada: false as const,
    podeAplicar: semPendencia && !recursos.internos.length && !recursos.externos.length && !recursos.indisponibilidades.length && !recursos.reservas.length && !recursos.semDocenteApto.length };
}
