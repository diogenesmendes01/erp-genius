import { Papel, Prisma } from "@prisma/client";
import { ErroPermissao, ErroRegra } from "@/server/_shared/sessao";
import { bloquearCalendarioAluno } from "@/server/retomada/estado";
import { carregarOfertasAgendaDestinoTx, type OfertaAgendaDestino } from "./destino-agenda";

export const SOLICITANTES_ACADEMICOS: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR];
export const APROVADORES_ACADEMICOS: Papel[] = [Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR];
export const EXECUTORES_ACADEMICOS: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR];
export const STATUS_ABERTOS_ACADEMICOS = ["PENDENTE", "APROVADA"] as const;

/** Projeção acadêmica explícita: não carrega contato, documento, preços ou cobranças. */
export const turmaAcademicaSelect = {
  id: true, codigo: true, nome: true, nivelId: true, modalidadeId: true, professorId: true,
  status: true, online: true, diasSemana: true, horarioInicio: true, horarioFim: true, diasHorario: true,
  dataInicio: true, dataFim: true, capacidade: true, rolling: true,
  nivel: { select: { id: true, codigo: true, ordem: true, idiomaId: true, idioma: { select: { nome: true } } } },
  modalidade: { select: { id: true, nome: true, segmento: true, frequencia: true, horasAula: true, duracaoPorNivel: true, aulasPorNivel: true, minimoAbrir: true } },
  vinculosDocentes: { where: { fim: null }, orderBy: { id: "asc" }, select: { id: true, professorId: true, inicio: true, fim: true } },
  _count: { select: { alocacoes: { where: { ativa: true } }, reservasMatricula: { where: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } } } },
} satisfies Prisma.TurmaSelect;

export type TurmaAcademica = Prisma.TurmaGetPayload<{ select: typeof turmaAcademicaSelect }>;

/** Sempre reler depois dos locks: autorização anterior à espera não autoriza a escrita. */
export async function exigirUsuarioAcademicoAtual(tx: Prisma.TransactionClient, id: string, papeis: Papel[]) {
  const usuario = await tx.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.some((p) => papeis.includes(p))) {
    throw new ErroPermissao("Um dos participantes não tem mais autorização para esta mudança acadêmica.");
  }
  return usuario;
}

/** Mesma ordem da pausa/retomada; Turma serializa ocupação com a alocação da matrícula. */
export async function bloquearEstadoAcademico(tx: Prisma.TransactionClient, alunoId: string, turmaDestinoId?: string) {
  // Grade, calendário, encontros e ausências usam esta trava antes das turmas.
  // A disponibilidade fotografada para a transferência precisa da mesma ordem.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearCalendarioAluno(tx, alunoId);
  const origens = await tx.alocacaoTurma.findMany({ where: { alunoId, ativa: true }, select: { turmaId: true } });
  const ids = [...new Set([...origens.map((a) => a.turmaId), ...(turmaDestinoId ? [turmaDestinoId] : [])])].sort();
  if (ids.length > 0) {
    await tx.$queryRaw`SELECT id FROM "Turma" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
    const turmas = await tx.turma.findMany({ where: { id: { in: ids } }, select: { nivelId: true, modalidadeId: true } });
    const nivelIds = [...new Set(turmas.map((t) => t.nivelId))].sort();
    const modalidadeIds = [...new Set(turmas.map((t) => t.modalidadeId))].sort();
    if (nivelIds.length) await tx.$queryRaw`SELECT id FROM "Nivel" WHERE id IN (${Prisma.join(nivelIds)}) ORDER BY id FOR SHARE`;
    if (modalidadeIds.length) await tx.$queryRaw`SELECT id FROM "Modalidade" WHERE id IN (${Prisma.join(modalidadeIds)}) ORDER BY id FOR SHARE`;
  }
  const matriculas = await tx.matricula.findMany({ where: { alunoId }, select: { produtoId: true } });
  const produtoIds = [...new Set(matriculas.map((m) => m.produtoId))].sort();
  if (produtoIds.length) await tx.$queryRaw`SELECT id FROM "Produto" WHERE id IN (${Prisma.join(produtoIds)}) ORDER BY id FOR SHARE`;
}

export async function carregarEstadoAcademico(tx: Pick<Prisma.TransactionClient,
  "aluno" | "turma" | "matricula" | "movimentacaoAluno" | "versaoCalendarioEscolar" | "propostaGradeTurma" | "encontroAgenda" | "indisponibilidadeDocente" | "rascunhoReplanejamento" | "impactoQuantidadeAulasModalidade">,
alunoId: string, turmaDestinoId?: string, matriculaId?: string, agora = new Date()) {
  const aluno = await tx.aluno.findUnique({ where: { id: alunoId }, select: {
    id: true, primeiroNome: true, sobrenome: true, status: true,
    alocacoes: { where: { ativa: true, ...(matriculaId ? { matriculaId } : {}) }, orderBy: { id: "asc" }, select: { id: true, matriculaId: true, turmaId: true, criadoEm: true, turma: { select: turmaAcademicaSelect } } },
  } });
  if (!aluno) throw new ErroRegra("Aluno não encontrado.");
  const destino = turmaDestinoId ? await tx.turma.findUnique({ where: { id: turmaDestinoId }, select: turmaAcademicaSelect }) : null;
  const ofertaDestino: OfertaAgendaDestino | null = destino
    ? (await carregarOfertasAgendaDestinoTx(tx, [destino.id], agora)).get(destino.id) ?? null
    : null;
  const matriculas = await tx.matricula.findMany({ where: { alunoId, ...(matriculaId ? { id: matriculaId } : {}) }, orderBy: { id: "asc" }, select: {
    id: true, status: true, produtoId: true, produto: { select: { idiomaId: true, modalidadeId: true } },
  } });
  // Movimentos sem contrato ainda podem afetar o cadastro inteiro e exigem conferência.
  const escopoMovimentos: Prisma.MovimentacaoAlunoWhereInput = { alunoId, ...(matriculaId ? { OR: [{ matriculaId }, { matriculaId: null }] } : {}) };
  const ultimaMovimentacao = await tx.movimentacaoAluno.findFirst({ where: escopoMovimentos, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { id: true, tipo: true, criadoEm: true } });
  const totalMovimentacoes = await tx.movimentacaoAluno.count({ where: escopoMovimentos });
  return { aluno, origem: aluno.alocacoes.length === 1 ? aluno.alocacoes[0] : null, destino, ofertaDestino, matriculas, ultimaMovimentacao, totalMovimentacoes, ...(matriculaId ? { escopoMatriculaId: matriculaId } : {}) };
}
export type EstadoAcademico = Awaited<ReturnType<typeof carregarEstadoAcademico>>;
