import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { diasPorSemanaDaFrequencia } from "@/server/turmas/schema";
import { PeriodosCalendarioSchema } from "./calendario-schema";
import { gerarGradeEncontros } from "./grade";

export async function carregarGradeInicialTx(tx: Prisma.TransactionClient, d: { turmaId: string; fusoOrigem: string }) {
      const turma = await tx.turma.findUnique({ where: { id: d.turmaId }, include: { modalidade: true } });
      if (!turma || turma.status !== "PLANEJADA") throw new ErroRegra("A geração inicial exige turma planejada; turmas iniciadas seguem revisão de cronograma.");
      if (await tx.aulaDiario.count({ where: { turmaId: turma.id } }) || await tx.encontroAgenda.count({ where: { turmaId: turma.id, status: { not: "RASCUNHO" } } })) throw new ErroRegra("Há histórico ou agenda publicada; revise o cronograma preservando os encontros existentes.");
      if (!turma.dataInicio || !turma.horarioInicio) throw new ErroRegra("Complete a data inicial e o horário da turma.");
      const quantidade = turma.modalidade.aulasPorNivel, duracao = turma.modalidade.horasAula * 60;
      if (!quantidade || !Number.isInteger(quantidade) || quantidade <= 0 || !Number.isInteger(duracao) || duracao <= 0) throw new ErroRegra("Configure quantidade de aulas e duração válida na modalidade; não será estimada por meses.");
      const frequencia = diasPorSemanaDaFrequencia(turma.modalidade.frequencia);
      if (frequencia === null || new Set(turma.diasSemana).size !== frequencia) throw new ErroRegra("Confira a frequência da modalidade e os dias da turma antes de gerar a grade.");
      const calendario = await tx.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" } });
      if (!calendario) throw new ErroRegra("Publique o calendário institucional antes de gerar a grade.");
      const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" } });
      if (config?.fusoInstitucional !== calendario.fusoInstitucional) throw new ErroRegra("O fuso institucional diverge do calendário aprovado; revise sua versão.");
      const horario = turma.horarioInicio.padStart(5, "0");
      const grade = gerarGradeEncontros({ dataInicial: turma.dataInicio.toISOString().slice(0, 10), diasSemana: turma.diasSemana, horario, duracaoMinutos: duracao,
        quantidadeAulas: quantidade, fusoOrigem: d.fusoOrigem, fusoEscola: calendario.fusoInstitucional, periodos: PeriodosCalendarioSchema.parse(calendario.periodos) });
      return { turmaId: turma.id, calendarioId: calendario.id, calendarioVersao: calendario.versao,
        origem: { modalidadeId: turma.modalidadeId, nivelId: turma.nivelId, quantidadeAulas: quantidade, duracaoMinutos: duracao, frequencia: turma.modalidade.frequencia,
          diasSemana: turma.diasSemana, horario, dataInicial: turma.dataInicio.toISOString().slice(0, 10), professorId: turma.professorId }, grade,
        pendenciasPublicacao: ["Conferir disponibilidade docente e aprovação da grade.", "Confirmar fuso de origem proposto para a turma."] };
}
