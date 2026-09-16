"use server";

import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, type Resultado } from "@/server/_shared";
import { docenteAtual, escopoTurmasDocente } from "@/server/diario/permissoes";
import { APROVADORES_ACADEMICOS, EXECUTORES_ACADEMICOS, SOLICITANTES_ACADEMICOS, carregarEstadoAcademico, turmaAcademicaSelect } from "./estado";
import { classificarDestinoAcademico, exigirSnapshotMudancaAcademicaAtual, impedimentoEstadoAcademico, rotuloTurmaAcademica, SnapshotMudancaAcademicaSchema } from "./regras";
import { FiltrosSolicitacoesAcademicasSchema, type ContextoMudancaAcademica, type SolicitacaoAcademicaView } from "./schema";

export type { ContextoMudancaAcademica, SolicitacaoAcademicaView } from "./schema";

export async function listarContextoMudancaAcademica(alunoId: string, matriculaId?: string): Promise<Resultado<ContextoMudancaAcademica>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...SOLICITANTES_ACADEMICOS, Papel.PROFESSOR);
    if (!alunoId.trim()) throw new ErroRegra("Aluno obrigatório.");
    const amplo = autor.papeis.some((p) => SOLICITANTES_ACADEMICOS.includes(p));
    if (matriculaId !== undefined && (typeof matriculaId !== "string" || !matriculaId.trim())) throw new ErroRegra("Matrícula inválida.");
    const estado = await carregarEstadoAcademico(prisma, alunoId, undefined, matriculaId);
    if (!amplo && (!estado.origem || !docenteAtual(autor.id, estado.origem.turma))) throw new ErroPermissao("Este aluno não pertence às suas turmas atuais.");
    const aberta = await prisma.solicitacaoMudancaAcademica.findFirst({ where: { alunoId, ...(matriculaId ? { matriculaId } : {}), status: { in: ["PENDENTE", "APROVADA"] } }, select: { id: true } });
    const impedimento = impedimentoEstadoAcademico(estado, false);
    const origem = estado.origem;
    const turmas = amplo && origem && !impedimento ? await prisma.turma.findMany({ where: {
      id: { not: origem.turmaId }, modalidadeId: origem.turma.modalidadeId, nivel: { idiomaId: origem.turma.nivel.idiomaId }, online: origem.turma.online,
      status: { in: ["ABERTA", "EM_ANDAMENTO"] }, OR: [{ dataFim: null }, { dataFim: { gte: new Date() } }],
    }, select: turmaAcademicaSelect, orderBy: [{ codigo: "asc" }, { id: "asc" }] }) : [];
    if (!amplo) {
      const aindaPermitido = await prisma.alocacaoTurma.findFirst({ where: { id: origem!.id, alunoId, ativa: true, turma: escopoTurmasDocente(autor.id) }, select: { id: true } });
      if (!aindaPermitido) throw new ErroPermissao("Este aluno não pertence mais às suas turmas atuais.");
    }
    return {
      alunoId, alunoNome: nomeCompleto(estado.aluno), status: estado.aluno.status,
      origem: origem ? { alocacaoId: origem.id, matriculaId: origem.matriculaId ?? null, turmaId: origem.turmaId, label: rotuloTurmaAcademica(origem.turma), diasHorario: origem.turma.diasHorario, nivelId: origem.turma.nivelId, idiomaId: origem.turma.nivel.idiomaId, modalidadeId: origem.turma.modalidadeId } : null,
      destinos: turmas.filter((t) => t.capacidade > (t._count.alocacoes + t._count.reservasMatricula)).map((t) => ({ id: t.id, label: rotuloTurmaAcademica(t), diasHorario: t.diasHorario,
        tipo: classificarDestinoAcademico(origem!.turma, t) === "EQUIVALENTE" ? "EQUIVALENTE" as const : "EXCECAO" as const, vagas: Math.max(0, t.capacidade - (t._count.alocacoes + t._count.reservasMatricula)) })),
      podeSolicitar: amplo && !impedimento && !aberta, podeTransferirEquivalente: amplo && !impedimento && !aberta,
      podePrepararEquivalencia: autor.papeis.some(p => APROVADORES_ACADEMICOS.includes(p)) && !impedimento && !aberta,
      pedidoAbertoId: aberta?.id ?? null, impedimento,
    };
  });
}

export async function listarSolicitacoesAcademicas(filtros?: { alunoId?: string; matriculaId?: string; apenasAbertas?: boolean; antesDe?: string }): Promise<Resultado<{ solicitacoes: SolicitacaoAcademicaView[]; proximo: string | null }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...SOLICITANTES_ACADEMICOS, Papel.PROFESSOR);
    const dados = FiltrosSolicitacoesAcademicasSchema.parse(filtros ?? {});
    const amplo = autor.papeis.some((p) => SOLICITANTES_ACADEMICOS.includes(p));
    const escopo: Prisma.SolicitacaoMudancaAcademicaWhereInput = amplo ? {} : {
      turmaOrigem: escopoTurmasDocente(autor.id), alocacaoOrigem: { ativa: true },
    };
    const where: Prisma.SolicitacaoMudancaAcademicaWhereInput = {
      AND: [escopo, ...(dados.alunoId ? [{ alunoId: dados.alunoId }] : []),
        ...(dados.matriculaId ? [{ matriculaId: dados.matriculaId }] : []),
        ...(dados.apenasAbertas ? [{ status: { in: ["PENDENTE", "APROVADA"] } } as Prisma.SolicitacaoMudancaAcademicaWhereInput] : [])],
    };
    let cursor: { id: string } | undefined;
    if (dados.antesDe) {
      const permitido = await prisma.solicitacaoMudancaAcademica.findFirst({ where: { AND: [where, { id: dados.antesDe }] }, select: { id: true } });
      if (!permitido) throw new ErroPermissao("Página indisponível para o seu escopo atual.");
      cursor = permitido;
    }
    const registros = await prisma.solicitacaoMudancaAcademica.findMany({
      where, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 51, ...(cursor ? { cursor, skip: 1 } : {}),
      select: {
        id: true, alunoId: true, status: true, motivo: true, criadoEm: true, snapshot: true, alocacaoOrigemId: true, turmaOrigemId: true, turmaDestinoId: true,
        solicitanteId: true, aprovadorId: true, motivoDecisao: true, justificativaDispensaParecer: true, motivoExecucao: true, motivoCancelamento: true,
        decididoEm: true, executadoEm: true, canceladoEm: true,
        aluno: { select: { primeiroNome: true, sobrenome: true } },
        solicitante: { select: { id: true, nome: true, ativo: true, papeis: true } },
        aprovador: { select: { id: true, nome: true, ativo: true, papeis: true } },
        executor: { select: { id: true, nome: true } }, cancelador: { select: { id: true, nome: true } },
        turmaOrigem: { select: turmaAcademicaSelect }, turmaDestino: { select: turmaAcademicaSelect },
        pareceres: { orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { id: true, autorId: true, conteudo: true, criadoEm: true, autor: { select: { nome: true, ativo: true, papeis: true } } } },
      },
    });
    const solicitacoes: SolicitacaoAcademicaView[] = [];
    for (const registro of registros.slice(0, 50)) {
      const aberto = registro.status === "PENDENTE" || registro.status === "APROVADA";
      const parsed = SnapshotMudancaAcademicaSchema.safeParse(registro.snapshot);
      const temParecer = registro.pareceres.some((p) => p.autor.ativo && p.autor.papeis.includes(Papel.PROFESSOR) && docenteAtual(p.autorId, registro.turmaOrigem));
      let impedimento: string | null = null;
      let podeDarParecer = false;
      const estado = aberto || !amplo ? await carregarEstadoAcademico(prisma, registro.alunoId, registro.turmaDestinoId, parsed.success ? parsed.data.escopoMatriculaId ?? undefined : undefined) : null;
      if (!amplo && (!estado?.origem || estado.origem.id !== registro.alocacaoOrigemId || !docenteAtual(autor.id, estado.origem.turma))) {
        throw new ErroPermissao("As turmas atribuídas mudaram durante a consulta. Atualize a página para consultar seu escopo atual.");
      }
      if (aberto) {
        impedimento = impedimentoEstadoAcademico(estado!);
        if (!impedimento) {
          try { exigirSnapshotMudancaAcademicaAtual(registro.snapshot, estado!); }
          catch (erro) { if (erro instanceof ErroRegra) impedimento = erro.message; else throw erro; }
        }
        podeDarParecer = !impedimento && registro.status === "PENDENTE" && autor.papeis.includes(Papel.PROFESSOR) && !!estado!.origem && estado!.origem.id === registro.alocacaoOrigemId && docenteAtual(autor.id, estado!.origem.turma);
        if (!impedimento && (!registro.solicitante.ativo || !registro.solicitante.papeis.some((p) => SOLICITANTES_ACADEMICOS.includes(p)))) {
          impedimento = "O solicitante perdeu a autorização. Rejeite ou cancele este pedido antes de abrir um novo.";
        }
        if (!impedimento && registro.status === "APROVADA" && (!registro.aprovador?.ativo || !registro.aprovador.papeis.some((p) => APROVADORES_ACADEMICOS.includes(p)))) {
          impedimento = "A aprovação perdeu a autorização vigente. Cancele o pedido e obtenha uma nova aprovação.";
        }
        if (!impedimento && registro.status === "APROVADA" && !temParecer && !registro.justificativaDispensaParecer) impedimento = "O parecer docente não está mais vigente. Cancele o pedido e solicite uma nova decisão.";
      }
      solicitacoes.push({
        id: registro.id, alunoId: registro.alunoId, alunoNome: nomeCompleto(registro.aluno), status: registro.status, motivo: registro.motivo, criadoEm: registro.criadoEm.toISOString(),
        origem: parsed.success ? { label: parsed.data.origem.label, diasHorario: parsed.data.origem.diasHorario } : { label: rotuloTurmaAcademica(registro.turmaOrigem), diasHorario: registro.turmaOrigem.diasHorario },
        destino: parsed.success ? { label: parsed.data.destino.label, diasHorario: parsed.data.destino.diasHorario } : { label: rotuloTurmaAcademica(registro.turmaDestino), diasHorario: registro.turmaDestino.diasHorario },
        solicitante: { id: registro.solicitante.id, nome: registro.solicitante.nome }, aprovador: registro.aprovador ? { id: registro.aprovador.id, nome: registro.aprovador.nome } : null,
        executor: registro.executor, cancelador: registro.cancelador, motivoDecisao: registro.motivoDecisao, justificativaDispensaParecer: registro.justificativaDispensaParecer,
        motivoExecucao: registro.motivoExecucao, motivoCancelamento: registro.motivoCancelamento,
        decididoEm: registro.decididoEm?.toISOString() ?? null, executadoEm: registro.executadoEm?.toISOString() ?? null, canceladoEm: registro.canceladoEm?.toISOString() ?? null,
        pareceres: registro.pareceres.map((p) => ({ id: p.id, autorNome: p.autor.nome, conteudo: p.conteudo, criadoEm: p.criadoEm.toISOString() })),
        temParecerVigente: temParecer,
        podeDarParecer: podeDarParecer && !impedimento,
        // Mesmo obsoleto, GP independente pode rejeitar; a aprovação é revalidada na action.
        podeDecidir: registro.status === "PENDENTE" && registro.solicitanteId !== autor.id && autor.papeis.some((p) => APROVADORES_ACADEMICOS.includes(p)),
        podeExecutar: registro.status === "APROVADA" && !impedimento && autor.papeis.some((p) => EXECUTORES_ACADEMICOS.includes(p)),
        podeCancelar: aberto && amplo, impedimento,
      });
    }
    return { solicitacoes, proximo: registros.length > 50 ? solicitacoes.at(-1)?.id ?? null : null };
  });
}
