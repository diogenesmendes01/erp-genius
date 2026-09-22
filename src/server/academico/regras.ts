import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { ErroRegra } from "@/server/_shared/sessao";
import type { EstadoAcademico, TurmaAcademica } from "./estado";

type Classificavel = { nivelId: string; modalidadeId: string; online: boolean; nivel: { idiomaId: string } };
export function classificarDestinoAcademico(origem: Classificavel, destino: Classificavel): "EQUIVALENTE" | "EXCECAO" | "INCOMPATIVEL" {
  if (origem.nivel.idiomaId !== destino.nivel.idiomaId || origem.modalidadeId !== destino.modalidadeId || origem.online !== destino.online) return "INCOMPATIVEL";
  return origem.nivelId === destino.nivelId ? "EQUIVALENTE" : "EXCECAO";
}

export function rotuloTurmaAcademica(turma: Pick<TurmaAcademica, "codigo" | "nome" | "modalidade" | "nivel">) {
  return [turma.codigo, turma.nome, turma.modalidade.nome, `${turma.nivel.idioma.nome} ${turma.nivel.codigo}`].filter(Boolean).join(" · ");
}

export function impedimentoEstadoAcademico(estado: EstadoAcademico, requerDestino = true, agora = new Date()): string | null {
  if (!estado.origem?.matriculaId && estado.aluno.status !== "ATIVO") return "Somente alunos ativos podem mudar de turma. Pausa e retomada têm fluxos próprios.";
  if (estado.aluno.alocacoes.length !== 1 || !estado.origem) return "O aluno precisa ter exatamente uma turma atual. Confira a alocação antes de solicitar a mudança.";
  const origem = estado.origem.turma;
  if (estado.origem.matriculaId && !estado.matriculas.some((m) => m.id === estado.origem!.matriculaId && m.status === "ATIVA" && m.produto.idiomaId === origem.nivel.idiomaId && m.produto.modalidadeId === origem.modalidadeId)) {
    return "A matrícula vinculada à alocação não está ativa ou compatível. Outra contratação do aluno não autoriza esta mudança.";
  }
  if (estado.matriculas.length > 0 && !estado.matriculas.some((m) => m.status === "ATIVA" && m.produto.idiomaId === origem.nivel.idiomaId && m.produto.modalidadeId === origem.modalidadeId)) {
    return "Não há matrícula ativa compatível com a turma atual. Regularize a matrícula antes da mudança acadêmica.";
  }
  if (!requerDestino) return null;
  if (!estado.destino) return "Turma de destino não encontrada.";
  if (origem.id === estado.destino.id) return "Aluno já está nesta turma.";
  if (classificarDestinoAcademico(origem, estado.destino) === "INCOMPATIVEL") {
    return "Mudança de idioma, modalidade ou formato de ensino exige um fluxo contratual próprio. Esta operação altera somente turma ou nível.";
  }
  if (!["ABERTA", "EM_ANDAMENTO"].includes(estado.destino.status) || !estado.ofertaDestino?.disponivel) {
    return "Turma de destino não está disponível para transferência.";
  }
  if (estado.destino._count.alocacoes + estado.destino._count.reservasMatricula >= estado.destino.capacidade) return "Turma de destino sem vaga. A solicitação não reserva uma vaga.";
  return null;
}

const TurmaSnapshotSchema = z.object({
  id: z.string(), label: z.string(), nivelId: z.string(), modalidadeId: z.string(), professorId: z.string().nullable(),
  nivel: z.object({ codigo: z.string(), ordem: z.number(), idiomaId: z.string() }),
  modalidade: z.object({ nome: z.string(), segmento: z.string(), frequencia: z.string(), horasAula: z.number(), duracaoPorNivel: z.string(), aulasPorNivel: z.number().nullable(), minimoAbrir: z.number() }),
  status: z.string(), online: z.boolean(), diasSemana: z.array(z.number()), horarioInicio: z.string().nullable(), horarioFim: z.string().nullable(), diasHorario: z.string().nullable(),
  dataInicio: z.string().nullable(), dataFim: z.string().nullable(), capacidade: z.number(), rolling: z.boolean(),
  vinculosDocentes: z.array(z.object({ id: z.string(), professorId: z.string(), inicio: z.string(), fim: z.string().nullable() })),
});
export const SnapshotMudancaAcademicaSchema = z.object({
  versao: z.union([z.literal(1), z.literal(2), z.literal(3)]), alunoId: z.string(), statusAluno: z.literal("ATIVO").nullable(),
  escopoMatriculaId: z.string().nullable().default(null),
  alocacaoOrigemId: z.string(), alocadaEm: z.string(),
  matriculaOrigemId: z.string().nullable().default(null),
  origem: TurmaSnapshotSchema, destino: TurmaSnapshotSchema,
  matriculas: z.array(z.object({ id: z.string(), status: z.string(), produtoId: z.string(), idiomaId: z.string(), modalidadeId: z.string() })),
  ultimaMovimentacao: z.object({ id: z.string(), tipo: z.string(), criadoEm: z.string() }).nullable(),
  totalMovimentacoes: z.number().int().nonnegative(),
  agendaDestino: z.object({
    gradeId: z.string(), gradeVersao: z.number().int(), calendarioId: z.string(), calendarioVersao: z.number().int(),
    calendarioVigenteId: z.string(), calendarioVigenteVersao: z.number().int(),
    cadeiaCalendario: z.discriminatedUnion("tipo", [
      z.object({ tipo: z.literal("GRADE_PUBLICADA") }),
      z.object({ tipo: z.literal("REPLANEJAMENTO_APLICADO"), rascunhoId: z.string(), decisaoId: z.string(), aplicacaoId: z.string(), estadoHash: z.string(),
        alteracoesQuantidade: z.array(z.object({ propostaId: z.string(), decisaoId: z.string(), aplicacaoId: z.string(), estadoHash: z.string() })).min(1).optional() }),
    ]),
    encontros: z.array(z.object({ id: z.string(), inicio: z.string(), fim: z.string(), status: z.string(), professorId: z.string().nullable(), professorApto: z.boolean() })),
    indisponibilidades: z.array(z.object({ id: z.string(), professorId: z.string(), inicio: z.string(), fim: z.string() })),
  }).nullable().default(null),
}).superRefine((snapshot, ctx) => {
  if (snapshot.versao === 3 && !snapshot.agendaDestino) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["agendaDestino"], message: "A versão atual exige a fotografia da agenda." });
  }
});
export type SnapshotMudancaAcademica = z.infer<typeof SnapshotMudancaAcademicaSchema>;

function snapshotTurma(turma: TurmaAcademica): SnapshotMudancaAcademica["origem"] {
  return {
    id: turma.id, label: rotuloTurmaAcademica(turma), nivelId: turma.nivelId, modalidadeId: turma.modalidadeId, professorId: turma.professorId,
    nivel: { codigo: turma.nivel.codigo, ordem: turma.nivel.ordem, idiomaId: turma.nivel.idiomaId },
    modalidade: { nome: turma.modalidade.nome, segmento: turma.modalidade.segmento, frequencia: turma.modalidade.frequencia, horasAula: turma.modalidade.horasAula, duracaoPorNivel: turma.modalidade.duracaoPorNivel, aulasPorNivel: turma.modalidade.aulasPorNivel, minimoAbrir: turma.modalidade.minimoAbrir },
    status: turma.status, online: turma.online, diasSemana: [...turma.diasSemana].sort((a, b) => a - b),
    horarioInicio: turma.horarioInicio, horarioFim: turma.horarioFim, diasHorario: turma.diasHorario,
    dataInicio: turma.dataInicio?.toISOString() ?? null, dataFim: turma.dataFim?.toISOString() ?? null, capacidade: turma.capacidade, rolling: turma.rolling,
    vinculosDocentes: [...turma.vinculosDocentes].sort((a, b) => a.id.localeCompare(b.id)).map((v) => ({ id: v.id, professorId: v.professorId, inicio: v.inicio.toISOString(), fim: v.fim?.toISOString() ?? null })),
  };
}

/** Ocupação fica fora do snapshot: não há reserva, e a vaga é reavaliada na execução. */
export function montarSnapshotMudancaAcademica(estado: EstadoAcademico): SnapshotMudancaAcademica {
  if (!estado.origem || !estado.destino || impedimentoEstadoAcademico(estado, false)) throw new ErroRegra("Estado acadêmico indisponível para a solicitação.");
  return {
    // No vínculo contratual, a situação vinculante está em matriculas; o cadastro
    // global não decide a elegibilidade nem invalida a aprovação de outro contrato.
    versao: 3, alunoId: estado.aluno.id, statusAluno: estado.origem.matriculaId ? null : "ATIVO", alocacaoOrigemId: estado.origem.id, alocadaEm: estado.origem.criadoEm.toISOString(),
    escopoMatriculaId: estado.escopoMatriculaId ?? null,
    matriculaOrigemId: estado.origem.matriculaId ?? null,
    origem: snapshotTurma(estado.origem.turma), destino: snapshotTurma(estado.destino),
    matriculas: [...estado.matriculas].sort((a, b) => a.id.localeCompare(b.id)).map((m) => ({ id: m.id, status: m.status, produtoId: m.produtoId, idiomaId: m.produto.idiomaId, modalidadeId: m.produto.modalidadeId })),
    ultimaMovimentacao: estado.ultimaMovimentacao ? { id: estado.ultimaMovimentacao.id, tipo: estado.ultimaMovimentacao.tipo, criadoEm: estado.ultimaMovimentacao.criadoEm.toISOString() } : null,
    // O contador também detecta movimentações novas com o mesmo timestamp da anterior.
    totalMovimentacoes: estado.totalMovimentacoes,
    agendaDestino: estado.ofertaDestino?.fotografia ?? null,
  };
}

/**
 * O relógio não torna um pedido obsoleto sozinho. Para verificar a aprovação
 * já guardada e a agenda atual, descartamos em ambos os lados as aulas que já
 * começaram no mesmo marco. Uma remarcação, cancelamento ou indisponibilidade
 * de aula que ainda pode afetar o novo vínculo permanece na comparação.
 */
export function normalizarSnapshotMudancaAcademicaNoMarco(snapshot: SnapshotMudancaAcademica, marco: Date): SnapshotMudancaAcademica {
  if (!snapshot.agendaDestino) return snapshot;
  const encontros = snapshot.agendaDestino.encontros.filter((encontro) => new Date(encontro.inicio) >= marco);
  const indisponibilidades = snapshot.agendaDestino.indisponibilidades.filter((ausencia) => encontros.some((encontro) =>
    encontro.professorId === ausencia.professorId && new Date(ausencia.inicio) < new Date(encontro.fim) && new Date(ausencia.fim) > new Date(encontro.inicio)));
  return { ...snapshot, agendaDestino: { ...snapshot.agendaDestino, encontros, indisponibilidades } };
}

export function lerSnapshotMudancaAcademica(snapshot: unknown) {
  const parsed = SnapshotMudancaAcademicaSchema.safeParse(snapshot);
  if (!parsed.success) throw new ErroRegra("A solicitação não possui um estado verificável. Cancele-a e abra uma nova.");
  return parsed.data;
}

/**
 * Repetir uma solicitação antiga não promove nem aprova sua memória. Ainda
 * exige que o escopo original inteiro permaneça igual; a única tolerância é o
 * relógio removendo dos dois lados aulas que já começaram.
 */
export function memoriaLegadaMudancaAcademicaCorresponde(snapshot: SnapshotMudancaAcademica, estado: EstadoAcademico, marco: Date) {
  const atual = montarSnapshotMudancaAcademica(estado);
  const comparavel: SnapshotMudancaAcademica = {
    ...atual,
    versao: snapshot.versao,
    statusAluno: snapshot.versao === 1 && estado.aluno.status === "ATIVO" ? "ATIVO" : null,
    agendaDestino: snapshot.agendaDestino ? atual.agendaDestino : null,
  };
  return isDeepStrictEqual(
    normalizarSnapshotMudancaAcademicaNoMarco(snapshot, marco),
    normalizarSnapshotMudancaAcademicaNoMarco(comparavel, marco),
  );
}

export function exigirSnapshotMudancaAcademicaAtual(snapshot: unknown, estado: EstadoAcademico, marco: Date) {
  const anterior = lerSnapshotMudancaAcademica(snapshot);
  if (anterior.versao !== 3) throw new ErroRegra("A solicitação não registra a agenda vigente do destino. Cancele-a e abra uma nova.");
  if (impedimentoEstadoAcademico(estado, false)) throw new ErroRegra("O aluno ou as condições da matrícula mudaram desde a solicitação. Confira o vínculo antes de continuar.");
  const atual = montarSnapshotMudancaAcademica(estado);
  if (!isDeepStrictEqual(normalizarSnapshotMudancaAcademicaNoMarco(anterior, marco), normalizarSnapshotMudancaAcademicaNoMarco(atual, marco))) {
    throw new ErroRegra("O aluno, a matrícula, a alocação ou as condições das turmas mudaram desde a solicitação. Cancele-a e abra uma nova.");
  }
  return anterior;
}

export function exigirDecisaoAcademicaIndependente(solicitanteId: string, aprovadorId: string) {
  if (solicitanteId === aprovadorId) throw new ErroRegra("Quem solicita não pode aprovar ou rejeitar a própria mudança acadêmica, mesmo acumulando papéis.");
}
