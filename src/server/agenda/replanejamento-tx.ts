import { AjustesReplanejamentoSchema, ajustarPrevisaoReplanejamento, type AjusteReplanejamento } from "./replanejamento-ajustes";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { PeriodosCalendarioSchema } from "./calendario-schema";
import { GradeEncontrosSchema } from "./grade";
import { conferirConflitosReplanejamento } from "./replanejamento-conflitos";
import { proporReplanejamentoGrade } from "./replanejamento-grade";
export async function carregarReplanejamentoTx(tx: Prisma.TransactionClient, calendarioId: string, ajustesInformados: AjusteReplanejamento[] = []) {
   const ajustes = AjustesReplanejamentoSchema.parse(ajustesInformados).sort((a,b) => a.encontroId.localeCompare(b.encontroId));
   const calendario = await tx.versaoCalendarioEscolar.findUnique({ where: { id: calendarioId }, include: { decisao: true } });
   if (!calendario) throw new ErroRegra("Calendário não encontrado.");
   if (calendario.decisao) throw new ErroRegra("Calendário já decidido; prepare outra versão para revisar.");
   const ultima = await tx.versaoCalendarioEscolar.findFirstOrThrow({ orderBy: { versao: "desc" } });
   if (ultima.id !== calendario.id) throw new ErroRegra("Confira a versão mais recente do calendário.");
   const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
   if (config?.fusoInstitucional !== calendario.fusoInstitucional) throw new ErroRegra("O fuso institucional mudou; prepare outra versão.");
   const periodos = PeriodosCalendarioSchema.parse(calendario.periodos), agora = new Date();
   const turmas = await tx.turma.findMany({ where: { encontrosAgenda: { some: { status: "PREVISTO", inicio: { gt: agora } } } }, orderBy: { id: "asc" },
    select: { id: true, codigo: true, status: true,
     propostasGrade: { where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" }, take: 1, select: { id: true, fusoOrigem: true, snapshot: true } },
     encontrosAgenda: { orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true, fim: true, status: true, propostaGradeId: true, professorId: true } } } });
   const bases = turmas.map((turma) => {
    const proposta = turma.propostasGrade[0], pendencias: string[] = [];
    let previsao: ReturnType<typeof proporReplanejamentoGrade> | null = null;
    if (turma.status === "CONCLUIDA") pendencias.push("Turma concluída com encontro previsto futuro exige conferência; seu histórico será preservado.");
    if (!proposta) pendencias.push("Turma sem grade aprovada exige conferência dos parâmetros históricos.");
    if (proposta && turma.encontrosAgenda.some((e) => e.status === "PREVISTO" && e.inicio > agora && e.propostaGradeId !== proposta.id))
     pendencias.push("Há encontros fora da grade de origem; conferir reposições e exceções antes de replanejar.");
    if (proposta && !pendencias.length) {
     const origem = z.object({ origem: GradeEncontrosSchema.pick({ dataInicial: true, diasSemana: true, horario: true, duracaoMinutos: true }).passthrough() }).safeParse(proposta.snapshot);
     if (!origem.success) pendencias.push("A grade aprovada possui parâmetros incompletos.");
     else try {
      const o = origem.data.origem;
      previsao = proporReplanejamentoGrade({ agora: agora.toISOString(), grade: { dataInicial: o.dataInicial, diasSemana: o.diasSemana, horario: o.horario,
       duracaoMinutos: o.duracaoMinutos, fusoOrigem: proposta.fusoOrigem, fusoEscola: calendario.fusoInstitucional, periodos },
       encontros: turma.encontrosAgenda.map((e) => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), status: e.status })) });
     } catch (erro) { pendencias.push(erro instanceof Error ? erro.message : "Não foi possível calcular esta grade."); }
    }
    return { turmaId: turma.id, codigo: turma.codigo, propostaGradeId: proposta?.id ?? null, fusoOrigem: proposta?.fusoOrigem ?? null,
     atribuicoes: turma.encontrosAgenda.map((e) => ({ encontroId: e.id, professorId: e.professorId })), previsao, pendencias };
   });
   const idsAjustaveis = new Set(bases.flatMap((r) => r.previsao?.propostas.map((p) => p.encontroId) ?? []));
   if (ajustes.some((a) => !idsAjustaveis.has(a.encontroId))) throw new ErroRegra("Ajuste fora dos encontros futuros elegíveis desta revisão.");
   const revisoes = bases.map((r) => {
    if (!r.previsao || !r.fusoOrigem) return r;
    const previsao = (() => { try { return ajustarPrevisaoReplanejamento({ previsao: r.previsao, ajustes: ajustes.filter((a) => r.previsao!.propostas.some((p) => p.encontroId === a.encontroId)),
      agora, fusoOrigem: r.fusoOrigem, fusoEscola: calendario.fusoInstitucional, periodos: periodos.map(({ id, inicio, fim }) => ({ id, inicio, fim })) });
    } catch (erro) { throw new ErroRegra(erro instanceof Error ? erro.message : "Não foi possível conferir o ajuste."); } })();
    const exigeExcecao = previsao.propostas.some((p) => p.periodosNaoLetivos.length);
    return { ...r, previsao, pendencias: [...r.pendencias, ...(exigeExcecao ? ["Encontro ajustado atinge dia não letivo; exige aprovação explícita da exceção para esse encontro."] : [])] };
   });
   const particulares = await tx.encontroAgenda.findMany({ where: { finalidade: "AULA", turmaId: null, status: "PREVISTO", inicio: { gt: agora } }, select: { id: true, inicio: true, fim: true, professorId: true }, orderBy: { id: "asc" } });
   const recuperacoes = await tx.encontroAgenda.findMany({ where: { finalidade: "RECUPERACAO", status: "PREVISTO", inicio: { gt: agora } }, select: { id: true, inicio: true, fim: true, professorId: true }, orderBy: { id: "asc" } });
   const recursos = await conferirConflitosReplanejamento(tx, revisoes.flatMap((r) => r.previsao?.propostas.map((p) => ({
    encontroId: p.encontroId, turmaId: r.turmaId, professorId: r.atribuicoes.find((a) => a.encontroId === p.encontroId)?.professorId ?? null,
    inicio: p.inicioProposto, fim: p.fimProposto,
   })) ?? []));
   return { ajustes, recursos, calendarioId: calendario.id, conferidoEm: agora.toISOString(), revisoes, particulares, ...(recuperacoes.length ? { recuperacoes } : {}),
    pendencias: ["Resolver conflitos e indisponibilidades apontados; conferir reservas e exceções antes da aprovação conjunta.", ...(particulares.length ? ["Particulares exigem revisão própria dos horários contratados."] : []), ...(recuperacoes.length ? ["Recuperações exigem revisão dos horários, avaliadores e prazos dos planos, sem efeito financeiro automático."] : [])],
    aplicada: false as const, revisaoCompleta: false as const };
}
