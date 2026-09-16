"use server";

import { Papel, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento, type Resultado } from "@/server/_shared";
import { docenteAtual } from "@/server/diario/permissoes";
import { exigirFechamentoProgressaoTx } from "@/server/avaliacoes/progressao-fechamento-tx";
import { APROVADORES_ACADEMICOS, EXECUTORES_ACADEMICOS, SOLICITANTES_ACADEMICOS, bloquearEstadoAcademico, carregarEstadoAcademico, exigirUsuarioAcademicoAtual, turmaAcademicaSelect } from "./estado";
import { classificarDestinoAcademico, exigirDecisaoAcademicaIndependente, exigirSnapshotMudancaAcademicaAtual, impedimentoEstadoAcademico, montarSnapshotMudancaAcademica, SnapshotMudancaAcademicaSchema } from "./regras";
import {
  CancelarMudancaAcademicaSchema, DecidirMudancaAcademicaSchema, ExecutarMudancaAcademicaSchema, RegistrarParecerMudancaSchema, SolicitarMudancaAcademicaSchema,
  type CancelarMudancaAcademicaInput, type DecidirMudancaAcademicaInput, type ExecutarMudancaAcademicaInput, type RegistrarParecerMudancaInput, type SolicitarMudancaAcademicaInput,
} from "./schema";

function revalidar(alunoId: string) {
  revalidatePath("/academico"); revalidatePath("/secretaria"); revalidatePath("/diario");
  revalidatePath("/alunos", "layout"); revalidatePath(`/alunos/${alunoId}`); revalidatePath("/configuracao/turmas");
}

/** A pré-leitura só determina os locks; o pedido e a autorização são relidos depois. */
async function bloquearSolicitacao(tx: Prisma.TransactionClient, id: string) {
  // Correções e revisões de progressão adquirem calendário antes dos vínculos.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const referencia = await tx.solicitacaoMudancaAcademica.findUnique({ where: { id }, select: { alunoId: true, turmaDestinoId: true } });
  if (!referencia) throw new ErroRegra("Solicitação acadêmica não encontrada.");
  await bloquearEstadoAcademico(tx, referencia.alunoId, referencia.turmaDestinoId);
  await tx.$queryRaw`SELECT id FROM "SolicitacaoMudancaAcademica" WHERE id = ${id} FOR UPDATE`;
  const solicitacao = await tx.solicitacaoMudancaAcademica.findUnique({ where: { id }, include: {
    pareceres: { orderBy: [{ criadoEm: "desc" }, { id: "desc" }], include: { autor: { select: { id: true, ativo: true, papeis: true } } } },
  } });
  if (!solicitacao || solicitacao.alunoId !== referencia.alunoId || solicitacao.turmaDestinoId !== referencia.turmaDestinoId) {
    throw new ErroRegra("A solicitação mudou durante a consulta. Atualize a página e tente novamente.");
  }
  return solicitacao;
}

async function exigirEstadoVigente(tx: Prisma.TransactionClient, solicitacao: Awaited<ReturnType<typeof bloquearSolicitacao>>) {
  const anterior = SnapshotMudancaAcademicaSchema.safeParse(solicitacao.snapshot);
  if (!anterior.success) throw new ErroRegra("A solicitação precisa de nova conferência do estado acadêmico.");
  const estado = await carregarEstadoAcademico(tx, solicitacao.alunoId, solicitacao.turmaDestinoId, anterior.data.escopoMatriculaId ?? undefined);
  const impedimento = impedimentoEstadoAcademico(estado);
  if (impedimento) throw new ErroRegra(impedimento);
  const snapshot = exigirSnapshotMudancaAcademicaAtual(solicitacao.snapshot, estado);
  if (snapshot.alocacaoOrigemId !== solicitacao.alocacaoOrigemId || snapshot.origem.id !== solicitacao.turmaOrigemId || snapshot.destino.id !== solicitacao.turmaDestinoId) {
    throw new ErroRegra("As turmas da solicitação não correspondem ao estado aprovado. Cancele-a e abra uma nova.");
  }
  if (classificarDestinoAcademico(estado.origem!.turma, estado.destino!) !== "EXCECAO") throw new ErroRegra("Esta solicitação não representa uma mudança excepcional de nível.");
  return estado;
}

function exigirParecerOuDispensa(solicitacao: Awaited<ReturnType<typeof bloquearSolicitacao>>, origem: Parameters<typeof docenteAtual>[1], dispensa?: string | null) {
  const temParecer = solicitacao.pareceres.some((p) => p.autor.ativo && p.autor.papeis.includes(Papel.PROFESSOR) && docenteAtual(p.autorId, origem));
  if (!temParecer && !dispensa?.trim()) throw new ErroRegra("A aprovação exige parecer do professor atual ou uma dispensa justificada pela gestão por indisponibilidade do parecer.");
}

export async function solicitarMudancaAcademica(alunoId: string, input: SolicitarMudancaAcademicaInput): Promise<Resultado<{ solicitacaoId: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...SOLICITANTES_ACADEMICOS);
    const dados = SolicitarMudancaAcademicaSchema.parse(input);
    if (!alunoId.trim()) throw new ErroRegra("Aluno obrigatório.");
    const solicitacaoId = await prisma.$transaction(async (tx) => {
      await bloquearEstadoAcademico(tx, alunoId, dados.turmaDestinoId);
      await exigirUsuarioAcademicoAtual(tx, autor.id, SOLICITANTES_ACADEMICOS);
      let estado = await carregarEstadoAcademico(tx, alunoId, dados.turmaDestinoId, dados.matriculaId);
      const impedimento = impedimentoEstadoAcademico(estado);
      if (impedimento) throw new ErroRegra(impedimento);
      if (dados.alocacaoOrigemId && estado.origem?.id !== dados.alocacaoOrigemId) throw new ErroRegra("A alocação mudou desde a consulta. Confira novamente antes de solicitar.");
      // Preparações novas capturam somente o contrato da origem inequívoca.
      // A leitura global continua necessária para recusar origens ambíguas.
      if (!dados.matriculaId && estado.origem?.matriculaId) {
        estado = await carregarEstadoAcademico(tx, alunoId, dados.turmaDestinoId, estado.origem.matriculaId);
      }
      if (classificarDestinoAcademico(estado.origem!.turma, estado.destino!) !== "EXCECAO") throw new ErroRegra("Turmas equivalentes usam proposta de aproveitamento, aprovação independente e execução pela Secretaria.");
      const aberta = await tx.solicitacaoMudancaAcademica.findFirst({ where: { alunoId, matriculaId: estado.origem!.matriculaId, status: { in: ["PENDENTE", "APROVADA"] } } });
      if (aberta) {
        if (aberta.solicitanteId === autor.id && aberta.turmaDestinoId === dados.turmaDestinoId && aberta.motivo === dados.motivo && aberta.horarioCompativel === dados.horarioCompativel) {
          // Repetir uma proposta anterior conserva seu escopo original, inclusive
          // quando ainda dependia do cadastro inteiro; não reescrever sua memória.
          const anterior = SnapshotMudancaAcademicaSchema.parse(aberta.snapshot);
          const estadoAnterior = await carregarEstadoAcademico(tx, alunoId, dados.turmaDestinoId, anterior.escopoMatriculaId ?? undefined);
          exigirSnapshotMudancaAcademicaAtual(aberta.snapshot, estadoAnterior);
          return aberta.id;
        }
        throw new ErroRegra("O aluno já possui uma mudança acadêmica em aberto. Conclua ou cancele a anterior antes de solicitar outra.");
      }
      const solicitacao = await tx.solicitacaoMudancaAcademica.create({ data: {
        alunoId, matriculaId: estado.origem!.matriculaId, alocacaoOrigemId: estado.origem!.id, turmaOrigemId: estado.origem!.turmaId, turmaDestinoId: dados.turmaDestinoId,
        motivo: dados.motivo, horarioCompativel: dados.horarioCompativel, solicitanteId: autor.id, snapshot: montarSnapshotMudancaAcademica(estado),
      } });
      await registrarEvento(tx, { tipo: "MudancaAcademicaSolicitada", agregadoTipo: "Aluno", agregadoId: alunoId, autorId: autor.id,
        payload: { solicitacaoId: solicitacao.id, alocacaoOrigemId: solicitacao.alocacaoOrigemId, turmaOrigemId: solicitacao.turmaOrigemId, turmaDestinoId: solicitacao.turmaDestinoId, motivo: dados.motivo, horarioCompativel: true } });
      return solicitacao.id;
    });
    revalidar(alunoId);
    return { solicitacaoId };
  });
}

export async function registrarParecerMudanca(id: string, input: RegistrarParecerMudancaInput): Promise<Resultado<{ parecerId: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR);
    const dados = RegistrarParecerMudancaSchema.parse(input);
    const resultado = await prisma.$transaction(async (tx) => {
      const solicitacao = await bloquearSolicitacao(tx, id);
      await exigirUsuarioAcademicoAtual(tx, autor.id, [Papel.PROFESSOR]);
      const origemAtual = await tx.alocacaoTurma.findFirst({ where: { id: solicitacao.alocacaoOrigemId, alunoId: solicitacao.alunoId, turmaId: solicitacao.turmaOrigemId, ativa: true }, select: { turma: { select: turmaAcademicaSelect } } });
      if (!origemAtual || !docenteAtual(autor.id, origemAtual.turma)) throw new ErroPermissao("Somente o professor atualmente responsável pela turma de origem pode registrar parecer para este aluno.");
      await exigirUsuarioAcademicoAtual(tx, solicitacao.solicitanteId, SOLICITANTES_ACADEMICOS);
      const estado = await exigirEstadoVigente(tx, solicitacao);
      if (!docenteAtual(autor.id, estado.origem!.turma)) throw new ErroPermissao("Somente o professor atualmente responsável pela turma de origem pode registrar parecer para este aluno.");
      const igual = solicitacao.pareceres.find((p) => p.autorId === autor.id && p.conteudo === dados.conteudo);
      if (igual) return { alunoId: solicitacao.alunoId, parecerId: igual.id };
      if (solicitacao.status !== "PENDENTE") throw new ErroRegra("Somente solicitações pendentes recebem novos pareceres. Os pareceres anteriores permanecem no histórico.");
      const parecer = await tx.parecerMudancaAcademica.create({ data: { solicitacaoId: id, autorId: autor.id, conteudo: dados.conteudo } });
      await registrarEvento(tx, { tipo: "ParecerMudancaAcademicaRegistrado", agregadoTipo: "Aluno", agregadoId: solicitacao.alunoId, autorId: autor.id,
        payload: { solicitacaoId: id, parecerId: parecer.id, turmaOrigemId: solicitacao.turmaOrigemId, conteudo: dados.conteudo } });
      return { alunoId: solicitacao.alunoId, parecerId: parecer.id };
    });
    revalidar(resultado.alunoId);
    return { parecerId: resultado.parecerId };
  });
}

export async function decidirMudancaAcademica(id: string, input: DecidirMudancaAcademicaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...APROVADORES_ACADEMICOS);
    const dados = DecidirMudancaAcademicaSchema.parse(input);
    const dispensa = dados.justificativaDispensaParecer || null;
    const alunoId = await prisma.$transaction(async (tx) => {
      const solicitacao = await bloquearSolicitacao(tx, id);
      await exigirUsuarioAcademicoAtual(tx, autor.id, APROVADORES_ACADEMICOS);
      exigirDecisaoAcademicaIndependente(solicitacao.solicitanteId, autor.id);
      const status = dados.aprovar ? "APROVADA" : "REJEITADA";
      if ((solicitacao.status === status || (dados.aprovar && solicitacao.status === "EXECUTADA")) && solicitacao.aprovadorId === autor.id && solicitacao.motivoDecisao === dados.motivo && solicitacao.justificativaDispensaParecer === dispensa) return solicitacao.alunoId;
      if (solicitacao.status !== "PENDENTE") throw new ErroRegra("Esta solicitação já foi decidida ou cancelada.");
      let fechamento: { id: string; estadoHash: string } | null = null;
      if (dados.aprovar) {
        await exigirUsuarioAcademicoAtual(tx, solicitacao.solicitanteId, SOLICITANTES_ACADEMICOS);
        const estado = await exigirEstadoVigente(tx, solicitacao);
        exigirParecerOuDispensa(solicitacao, estado.origem!.turma, dispensa);
        fechamento = await exigirFechamentoProgressaoTx(tx, { matriculaId: estado.origem!.matriculaId,
          alocacaoId: estado.origem!.id, gestorResponsavelId: autor.id });
      }
      await tx.solicitacaoMudancaAcademica.update({ where: { id }, data: {
        status, aprovadorId: autor.id, motivoDecisao: dados.motivo, justificativaDispensaParecer: dispensa, decididoEm: new Date(),
        ...(fechamento ? { fechamentoAcademicoId: fechamento.id, fechamentoEstadoHash: fechamento.estadoHash } : {}),
      } });
      await registrarEvento(tx, { tipo: "MudancaAcademicaDecidida", agregadoTipo: "Aluno", agregadoId: solicitacao.alunoId, autorId: autor.id,
        payload: { solicitacaoId: id, status, solicitanteId: solicitacao.solicitanteId, motivo: dados.motivo, justificativaDispensaParecer: dispensa,
          ...(fechamento ? { fechamentoAcademicoId: fechamento.id, fechamentoEstadoHash: fechamento.estadoHash } : {}) } });
      return solicitacao.alunoId;
    });
    revalidar(alunoId);
  });
}

export async function executarMudancaAcademica(id: string, input: ExecutarMudancaAcademicaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...EXECUTORES_ACADEMICOS);
    const dados = ExecutarMudancaAcademicaSchema.parse(input);
    const alunoId = await prisma.$transaction(async (tx) => {
      const solicitacao = await bloquearSolicitacao(tx, id);
      await exigirUsuarioAcademicoAtual(tx, autor.id, EXECUTORES_ACADEMICOS);
      if (solicitacao.status === "EXECUTADA" && solicitacao.executorId === autor.id && solicitacao.motivoExecucao === dados.motivo) return solicitacao.alunoId;
      if (solicitacao.status !== "APROVADA" || !solicitacao.aprovadorId) throw new ErroRegra("Somente uma solicitação aprovada pode ser executada.");
      const revisaoPendente = await tx.casoRevisaoProgressao.findFirst({ where: { solicitacaoId: id,
        itensResolucao: { none: { proposta: { acao: { in: ["REGISTRAR_CANCELAMENTO", "RECONFIRMAR_EXECUTADA"] }, decisao: { aprovada: true } } } },
      }, select: { id: true } });
      if (revisaoPendente) throw new ErroRegra("A mudança possui revisão de correção pendente. A gestão deve resolver a solicitação antes da execução.");
      exigirDecisaoAcademicaIndependente(solicitacao.solicitanteId, solicitacao.aprovadorId);
      await exigirUsuarioAcademicoAtual(tx, solicitacao.solicitanteId, SOLICITANTES_ACADEMICOS);
      await exigirUsuarioAcademicoAtual(tx, solicitacao.aprovadorId, APROVADORES_ACADEMICOS);
      const estado = await exigirEstadoVigente(tx, solicitacao);
      exigirParecerOuDispensa(solicitacao, estado.origem!.turma, solicitacao.justificativaDispensaParecer);
      await exigirFechamentoProgressaoTx(tx, { matriculaId: estado.origem!.matriculaId,
        alocacaoId: estado.origem!.id, gestorResponsavelId: solicitacao.aprovadorId,
        fechamentoId: solicitacao.fechamentoAcademicoId, estadoHashAprovado: solicitacao.fechamentoEstadoHash });
      const agora = new Date();
      await tx.alocacaoTurma.update({ where: { id: estado.origem!.id }, data: { ativa: false, encerradaEm: agora } });
      const novaAlocacao = await tx.alocacaoTurma.create({ data: { alunoId: solicitacao.alunoId, matriculaId: estado.origem!.matriculaId ?? null, turmaId: solicitacao.turmaDestinoId, criadoEm: agora } });
      const movimentacao = await tx.movimentacaoAluno.create({ data: {
        matriculaId: estado.origem!.matriculaId ?? null,
        alunoId: solicitacao.alunoId, tipo: "TROCA_TURMA", turmaOrigemId: solicitacao.turmaOrigemId, turmaDestinoId: solicitacao.turmaDestinoId,
        motivo: dados.motivo, observacao: `Mudança acadêmica aprovada: ${id}`, usuarioId: autor.id, criadoEm: agora,
      } });
      await tx.solicitacaoMudancaAcademica.update({ where: { id }, data: {
        status: "EXECUTADA", executorId: autor.id, motivoExecucao: dados.motivo, executadoEm: agora, movimentacaoId: movimentacao.id,
      } });
      await registrarEvento(tx, { tipo: "MudancaAcademicaExecutada", agregadoTipo: "Aluno", agregadoId: solicitacao.alunoId, autorId: autor.id,
        payload: { solicitacaoId: id, solicitanteId: solicitacao.solicitanteId, aprovadorId: solicitacao.aprovadorId, turmaOrigemId: solicitacao.turmaOrigemId,
          turmaDestinoId: solicitacao.turmaDestinoId, alocacaoOrigemId: solicitacao.alocacaoOrigemId, alocacaoDestinoId: novaAlocacao.id, movimentacaoId: movimentacao.id, motivo: dados.motivo, horarioCompativel: true,
          fechamentoAcademicoId: solicitacao.fechamentoAcademicoId, fechamentoEstadoHash: solicitacao.fechamentoEstadoHash } });
      await registrarEvento(tx, { tipo: "TrocaTurma", agregadoTipo: "Aluno", agregadoId: solicitacao.alunoId, autorId: autor.id,
        payload: { de: solicitacao.turmaOrigemId, para: solicitacao.turmaDestinoId, motivo: dados.motivo, solicitacaoId: id, horarioCompativel: true } });
      return solicitacao.alunoId;
    });
    revalidar(alunoId);
  });
}

export async function cancelarMudancaAcademica(id: string, input: CancelarMudancaAcademicaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...SOLICITANTES_ACADEMICOS);
    const dados = CancelarMudancaAcademicaSchema.parse(input);
    const alunoId = await prisma.$transaction(async (tx) => {
      const solicitacao = await bloquearSolicitacao(tx, id);
      await exigirUsuarioAcademicoAtual(tx, autor.id, SOLICITANTES_ACADEMICOS);
      if (solicitacao.status === "CANCELADA" && solicitacao.canceladorId === autor.id && solicitacao.motivoCancelamento === dados.motivo) return solicitacao.alunoId;
      if (!["PENDENTE", "APROVADA"].includes(solicitacao.status)) throw new ErroRegra("Apenas solicitações pendentes ou aprovadas podem ser canceladas. Uma mudança executada exige uma nova solicitação.");
      await tx.solicitacaoMudancaAcademica.update({ where: { id }, data: { status: "CANCELADA", canceladorId: autor.id, motivoCancelamento: dados.motivo, canceladoEm: new Date() } });
      await registrarEvento(tx, { tipo: "MudancaAcademicaCancelada", agregadoTipo: "Aluno", agregadoId: solicitacao.alunoId, autorId: autor.id,
        payload: { solicitacaoId: id, statusAnterior: solicitacao.status, motivo: dados.motivo } });
      return solicitacao.alunoId;
    });
    revalidar(alunoId);
  });
}
