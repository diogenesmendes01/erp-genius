"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { PrepararAgendaAditivoSchema } from "./agenda-aditivo-schema";
import { carregarConferenciaAgendaAditivoTx } from "./agenda-aditivo-tx";

/** Consulta de conferência: não persiste proposta, não reserva e não aplica agenda. */
export async function consultarConferenciaAgendaAditivo(input: z.input<typeof PrepararAgendaAditivoSchema>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, ator.id, input), { timeout: 30000 });
  });
}

const ConsultaOpcoesAgendaSchema = z.object({ matriculaId: z.string().trim().min(1) }).strict();

/** Dados mínimos para montar a conferência. A ação não oferece reservas, cobranças ou contatos. */
export async function consultarOpcoesConferenciaAgendaAditivo(input: z.input<typeof ConsultaOpcoesAgendaSchema>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO);
    const d = ConsultaOpcoesAgendaSchema.parse(input);
    return prisma.$transaction(async tx => {
      const atual = await tx.usuario.findUnique({ where: { id: ator.id }, select: { ativo: true, papeis: true } });
      if (!atual?.ativo || !atual.papeis.some(p => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR || p === Papel.GERENTE_PEDAGOGICO)) throw new ErroRegra("Permissão operacional necessária.");
      const matricula = await tx.matricula.findFirst({ where: { id: d.matriculaId, status: "ATIVA" }, select: { id: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } });
      if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
      const [encontros, professores] = await Promise.all([
        tx.encontroAgenda.findMany({ where: { matriculaId: matricula.id, finalidade: "AULA", turmaId: null, reposicaoIndividualId: null, agendaReposicaoIndividual: null, status: "PREVISTO", inicio: { gt: new Date() }, professorId: { not: null } }, orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true, fim: true, fusoOrigem: true, professor: { select: { id: true, nome: true } } } }),
        tx.usuario.findMany({ where: { ativo: true, papeis: { has: Papel.PROFESSOR } }, orderBy: [{ nome: "asc" }, { id: "asc" }], select: { id: true, nome: true } }),
      ]);
      return { matricula: { id: matricula.id, aluno: [matricula.aluno.primeiroNome, matricula.aluno.sobrenome].filter(Boolean).join(" ") }, encontros: encontros.map(e => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), fusoOrigem: e.fusoOrigem, professorId: e.professor?.id ?? null, professor: e.professor?.nome ?? "Professor não disponível" })), professores };
    }, { timeout: 30000 });
  });
}

export async function listarMatriculasConferenciaAgendaAditivo(input: { alunoId: string }) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO);
    const alunoId = z.string().trim().min(1).parse(input.alunoId);
    return prisma.$transaction(async tx => {
      const atual = await tx.usuario.findUnique({ where: { id: ator.id }, select: { ativo: true, papeis: true } });
      if (!atual?.ativo || !atual.papeis.some(p => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR || p === Papel.GERENTE_PEDAGOGICO)) throw new ErroRegra("Permissão operacional necessária.");
      return tx.matricula.findMany({ where: { alunoId, status: "ATIVA", encontrosAgenda: { some: { finalidade: "AULA", turmaId: null, reposicaoIndividualId: null, agendaReposicaoIndividual: null, status: "PREVISTO", inicio: { gt: new Date() }, professorId: { not: null } } } }, orderBy: { criadoEm: "desc" }, select: { id: true, codigo: true, produto: { select: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } } } });
    });
  });
}
