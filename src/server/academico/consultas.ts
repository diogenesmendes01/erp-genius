"use server";

import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { janelaDaPagina, recorteDaPagina } from "@/lib/pagina-url";
import { alemDoCursor, cursorDaLeitura, direcaoDeLeitura, lerPaginaDaFila, type Direcao, type NavegacaoDaPagina, type NavegacaoFila } from "@/lib/cursor-fila";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, type Resultado } from "@/server/_shared";
import { docenteAtual, escopoTurmasDocente } from "@/server/diario/permissoes";
import { APROVADORES_ACADEMICOS, EXECUTORES_ACADEMICOS, SOLICITANTES_ACADEMICOS, carregarEstadoAcademico, turmaAcademicaSelect } from "./estado";
import { carregarOfertasAgendaDestinoTx } from "./destino-agenda";
import { classificarDestinoAcademico, exigirSnapshotMudancaAcademicaAtual, impedimentoEstadoAcademico, rotuloTurmaAcademica, SnapshotMudancaAcademicaSchema } from "./regras";
import { FilaSolicitacoesAcademicasSchema, FiltrosSolicitacoesAcademicasSchema, type ContextoMudancaAcademica, type SolicitacaoAcademicaView } from "./schema";

export type { ContextoMudancaAcademica, SolicitacaoAcademicaView } from "./schema";

export async function listarContextoMudancaAcademica(alunoId: string, matriculaId?: string): Promise<Resultado<ContextoMudancaAcademica>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...SOLICITANTES_ACADEMICOS, Papel.PROFESSOR);
    const agora = new Date();
    if (!alunoId.trim()) throw new ErroRegra("Aluno obrigatório.");
    const amplo = autor.papeis.some((p) => SOLICITANTES_ACADEMICOS.includes(p));
    if (matriculaId !== undefined && (typeof matriculaId !== "string" || !matriculaId.trim())) throw new ErroRegra("Matrícula inválida.");
    const estado = await carregarEstadoAcademico(prisma, alunoId, undefined, matriculaId, agora);
    if (!amplo && (!estado.origem || !docenteAtual(autor.id, estado.origem.turma))) throw new ErroPermissao("Este aluno não pertence às suas turmas atuais.");
    const aberta = await prisma.solicitacaoMudancaAcademica.findFirst({ where: { alunoId, ...(matriculaId ? { matriculaId } : {}), status: { in: ["PENDENTE", "APROVADA"] } }, select: { id: true } });
    const impedimento = impedimentoEstadoAcademico(estado, false);
    const origem = estado.origem;
    const turmas = amplo && origem && !impedimento ? await prisma.turma.findMany({ where: {
      id: { not: origem.turmaId }, modalidadeId: origem.turma.modalidadeId, nivel: { idiomaId: origem.turma.nivel.idiomaId }, online: origem.turma.online,
      status: { in: ["ABERTA", "EM_ANDAMENTO"] },
    }, select: turmaAcademicaSelect, orderBy: [{ codigo: "asc" }, { id: "asc" }] }) : [];
    const ofertas = await carregarOfertasAgendaDestinoTx(prisma, turmas.map((turma) => turma.id), agora);
    if (!amplo) {
      const aindaPermitido = await prisma.alocacaoTurma.findFirst({ where: { id: origem!.id, alunoId, ativa: true, turma: escopoTurmasDocente(autor.id) }, select: { id: true } });
      if (!aindaPermitido) throw new ErroPermissao("Este aluno não pertence mais às suas turmas atuais.");
    }
    return {
      alunoId, alunoNome: nomeCompleto(estado.aluno), status: estado.aluno.status,
      origem: origem ? { alocacaoId: origem.id, matriculaId: origem.matriculaId ?? null, turmaId: origem.turmaId, label: rotuloTurmaAcademica(origem.turma), diasHorario: origem.turma.diasHorario, nivelId: origem.turma.nivelId, idiomaId: origem.turma.nivel.idiomaId, modalidadeId: origem.turma.modalidadeId } : null,
      destinos: turmas.filter((t) => ofertas.get(t.id)?.disponivel && t.capacidade > (t._count.alocacoes + t._count.reservasMatricula)).map((t) => ({ id: t.id, label: rotuloTurmaAcademica(t), diasHorario: t.diasHorario,
        tipo: classificarDestinoAcademico(origem!.turma, t) === "EQUIVALENTE" ? "EQUIVALENTE" as const : "EXCECAO" as const, vagas: Math.max(0, t.capacidade - (t._count.alocacoes + t._count.reservasMatricula)) })),
      podeSolicitar: amplo && !impedimento && !aberta, podeTransferirEquivalente: amplo && !impedimento && !aberta,
      podePrepararEquivalencia: autor.papeis.some(p => APROVADORES_ACADEMICOS.includes(p)) && !impedimento && !aberta,
      pedidoAbertoId: aberta?.id ?? null, impedimento,
    };
  });
}

type AutorAcademico = Awaited<ReturnType<typeof exigirSessaoComPapel>>;

/** Escopo e filtros das solicitações de quem consulta (a mesma base para a lista do aluno e a fila de /academico). */
function filtroSolicitacoes(autor: AutorAcademico, dados: { alunoId?: string; matriculaId?: string; apenasAbertas?: boolean }) {
  const amplo = autor.papeis.some((p) => SOLICITANTES_ACADEMICOS.includes(p));
  const escopo: Prisma.SolicitacaoMudancaAcademicaWhereInput = amplo ? {} : {
    turmaOrigem: escopoTurmasDocente(autor.id), alocacaoOrigem: { ativa: true },
  };
  const where: Prisma.SolicitacaoMudancaAcademicaWhereInput = {
    AND: [escopo, ...(dados.alunoId ? [{ alunoId: dados.alunoId }] : []),
      ...(dados.matriculaId ? [{ matriculaId: dados.matriculaId }] : []),
      ...(dados.apenasAbertas ? [{ status: { in: ["PENDENTE", "APROVADA"] } } as Prisma.SolicitacaoMudancaAcademicaWhereInput] : [])],
  };
  return { amplo, escopo, where };
}

/** Solicitações em ordem (criadoEm, id), na direção pedida (a fila lê ao contrário para voltar). */
function lerSolicitacoes(where: Prisma.SolicitacaoMudancaAcademicaWhereInput, janela: { direcao: Direcao; take: number; skip?: number }) {
  return prisma.solicitacaoMudancaAcademica.findMany({
    where, orderBy: [{ criadoEm: janela.direcao }, { id: janela.direcao }], take: janela.take, ...(janela.skip ? { skip: janela.skip } : {}),
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
}

/** Cada solicitação lida, com o estado acadêmico atual e o que quem consulta pode fazer com ela. */
async function montarSolicitacoes(autor: AutorAcademico, amplo: boolean, registros: Awaited<ReturnType<typeof lerSolicitacoes>>, agora: Date) {
  const solicitacoes: SolicitacaoAcademicaView[] = [];
  for (const registro of registros) {
    const aberto = registro.status === "PENDENTE" || registro.status === "APROVADA";
    const parsed = SnapshotMudancaAcademicaSchema.safeParse(registro.snapshot);
    const temParecer = registro.pareceres.some((p) => p.autor.ativo && p.autor.papeis.includes(Papel.PROFESSOR) && docenteAtual(p.autorId, registro.turmaOrigem));
    let impedimento: string | null = null;
    let podeDarParecer = false;
    const estado = aberto || !amplo ? await carregarEstadoAcademico(prisma, registro.alunoId, registro.turmaDestinoId, parsed.success ? parsed.data.escopoMatriculaId ?? undefined : undefined, agora) : null;
    if (!amplo && (!estado?.origem || estado.origem.id !== registro.alocacaoOrigemId || !docenteAtual(autor.id, estado.origem.turma))) {
      throw new ErroPermissao("As turmas atribuídas mudaram durante a consulta. Atualize a página para consultar seu escopo atual.");
    }
    if (aberto) {
      impedimento = impedimentoEstadoAcademico(estado!, true, agora);
      if (!impedimento) {
        try { exigirSnapshotMudancaAcademicaAtual(registro.snapshot, estado!, agora); }
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
  return solicitacoes;
}

/** Lista (histórico) das solicitações de um aluno: página numerada (E4), 50 por página, contada no escopo de quem consulta. */
export async function listarSolicitacoesAcademicas(filtros?: { alunoId?: string; matriculaId?: string; apenasAbertas?: boolean; pagina?: number }): Promise<Resultado<{ solicitacoes: SolicitacaoAcademicaView[]; pagina: number; temProxima: boolean }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...SOLICITANTES_ACADEMICOS, Papel.PROFESSOR);
    const agora = new Date();
    const dados = FiltrosSolicitacoesAcademicasSchema.parse(filtros ?? {});
    const { amplo, where } = filtroSolicitacoes(autor, dados);
    // Página numerada (E4), contada dentro do escopo de quem consulta: não carrega id de registro na URL.
    const pagina = dados.pagina ?? 1;
    const lidos = await lerSolicitacoes(where, { direcao: "desc", ...janelaDaPagina(pagina, 50) });
    const { registros, temProxima } = recorteDaPagina(lidos, 50);
    return { solicitacoes: await montarSolicitacoes(autor, amplo, registros, agora), pagina, temProxima };
  });
}

/**
 * Fila de trabalho de /academico (E4, decisão de 10/10/2026): as solicitações abertas (pendentes e aprovadas), ou todas
 * com `historico`, por cursor nos dois sentidos em ordem estável (criadoEm desc, id desc). A âncora do cursor é lida no
 * escopo de quem consulta, mas sem o filtro de abertas: executar ou cancelar a solicitação âncora não a perde, e a
 * próxima continua de onde a pessoa parou sem pular ninguém.
 */
export async function listarFilaSolicitacoesAcademicas(input: NavegacaoFila & { historico?: boolean } = {}): Promise<Resultado<NavegacaoDaPagina & { solicitacoes: SolicitacaoAcademicaView[] }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...SOLICITANTES_ACADEMICOS, Papel.PROFESSOR);
    const agora = new Date();
    const dados = FilaSolicitacoesAcademicasSchema.parse(input);
    const { amplo, escopo, where } = filtroSolicitacoes(autor, { apenasAbertas: !dados.historico });
    const ler = async (leitura: NavegacaoFila, take: number) => {
      const cursor = cursorDaLeitura(leitura);
      const ancora = cursor === null ? null : await prisma.solicitacaoMudancaAcademica.findFirst({ where: { AND: [escopo, { id: cursor }] }, select: { id: true, criadoEm: true } });
      if (cursor !== null && !ancora) return [];
      const corte: Prisma.SolicitacaoMudancaAcademicaWhereInput = ancora ? { OR: [{ criadoEm: alemDoCursor(leitura, "desc", ancora.criadoEm) }, { criadoEm: ancora.criadoEm, id: alemDoCursor(leitura, "desc", ancora.id) }] } : {};
      return lerSolicitacoes({ AND: [where, corte] }, { direcao: direcaoDeLeitura(leitura)("desc"), take });
    };
    const { registros, ...navegacao } = await lerPaginaDaFila({ depois: dados.depois, antes: dados.antes }, 50, ler, (s) => s.id);
    return { solicitacoes: await montarSolicitacoes(autor, amplo, registros, agora), ...navegacao };
  });
}

export type { DiarioTurma, ProgressaoAluno, DadosPortal } from "./consultas-legado";
