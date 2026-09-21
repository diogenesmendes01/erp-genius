"use server";

import { revalidatePath } from "next/cache";
import { Papel, StatusTurma, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarCodigo } from "@/lib/codigo";
import {
  exigirSessaoComPapel,
  exigirPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  ErroPermissao,
  type Resultado,
} from "@/server/_shared";
import {
  TurmaSchema,
  type TurmaInput,
  diasPorSemanaDaFrequencia,
  duracaoIntervaloEmMinutos,
  rotuloDiasHorario,
  emMinutos,
} from "./schema";
import { conferirConclusaoTurma } from "./conclusao-agenda";
import { sincronizarVinculoDocente } from "./vinculo-docente";

// Valida a agenda contra a frequência da modalidade e devolve o rótulo derivado.
// Lança ErroRegra se o nº de dias não casar (ex.: Intensiva 3x exige 3 dias).
async function validarAgenda(
  modalidadeId: string,
  diasSemana: number[],
  horarioInicio: string,
  horarioFim: string,
  db: Pick<Prisma.TransactionClient, "modalidade"> = prisma,
  exigirDuracaoDaModalidade = false,
  exigirFrequencia = true,
): Promise<string> {
  const modalidade = await db.modalidade.findUnique({ where: { id: modalidadeId } });
  if (!modalidade) throw new ErroRegra("Modalidade não encontrada.");
  const req = diasPorSemanaDaFrequencia(modalidade.frequencia);
  const dias = Array.from(new Set(diasSemana)); // sem duplicados
  if (exigirFrequencia && req !== null && dias.length !== req) {
    throw new ErroRegra(
      `A modalidade ${modalidade.nome} é ${modalidade.frequencia}: selecione exatamente ${req} dia(s) — você marcou ${dias.length}.`,
    );
  }
  if (exigirDuracaoDaModalidade) {
    const duracaoEsperada = Number(modalidade.horasAula) * 60;
    const duracaoInformada = duracaoIntervaloEmMinutos(horarioInicio, horarioFim);
    if (!Number.isInteger(duracaoEsperada) || duracaoEsperada <= 0 || duracaoInformada !== duracaoEsperada) {
      throw new ErroRegra(
        `A aula da modalidade ${modalidade.nome} dura ${modalidade.horasAula} hora(s). O horário informado precisa corresponder a essa duração.`,
      );
    }
  }
  return rotuloDiasHorario(dias, horarioInicio, horarioFim);
}

const PATH = "/configuracao/turmas";

// Dono = Gerente Pedagógico (Admin passa automaticamente em exigirPapel).
async function exigirGestorTurma() {
  return exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
}

/** Revalidar depois dos locks: a sessão pode ter perdido autoridade durante a espera. */
async function exigirGestorAtual(tx: Prisma.TransactionClient, usuarioId: string) {
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, nome: true, papeis: true, ativo: true } });
  if (!usuario?.ativo) throw new ErroPermissao("Seu acesso à gestão de turmas foi revogado.");
  exigirPapel(usuario, Papel.GERENTE_PEDAGOGICO);
}

/** Vendedor solicita abertura de turma ao Gerente Pedagógico (doc 09 §Matrícula). */
export async function solicitarAberturaTurma(input: {
  produtoId: string;
  nivelId?: string;
  observacao?: string;
}): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
    if (!input.produtoId) throw new ErroRegra("Selecione o produto.");
    // Evento gravado em transação (issue #1): consistente com o restante do domínio.
    await prisma.$transaction(async (tx) => {
      await registrarEvento(tx, {
        tipo: "AberturaTurmaSolicitada",
        agregadoTipo: "Produto",
        agregadoId: input.produtoId,
        autorId: autor.id,
        payload: { nivelId: input.nivelId ?? null, observacao: input.observacao ?? null },
      });
    });
    revalidatePath(PATH);
  });
}

export async function criarTurma(input: TurmaInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirGestorTurma();
    const dados = TurmaSchema.parse(input);

    const id = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`regra-avaliacao-nivel:${dados.nivelId}`}, 0))`;
      await tx.$queryRaw`SELECT id FROM "Modalidade" WHERE id = ${dados.modalidadeId} FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`;
      await exigirGestorAtual(tx, autor.id);
      const diasHorario = await validarAgenda(
        dados.modalidadeId,
        dados.diasSemana,
        dados.horarioInicio,
        dados.horarioFim,
        tx,
        true,
      );
      const codigo = await gerarCodigo("turma");
      const turma = await tx.turma.create({
        data: {
          codigo,
          nome: dados.nome ?? null,
          modalidadeId: dados.modalidadeId,
          nivelId: dados.nivelId,
          professorId: dados.professorId || null,
          diasSemana: dados.diasSemana,
          horarioInicio: dados.horarioInicio,
          horarioFim: dados.horarioFim,
          diasHorario,
          dataInicio: dados.dataInicio,
          dataFim: dados.dataFim ?? null,
          capacidade: dados.capacidade,
          rolling: dados.rolling,
          status: StatusTurma.PLANEJADA,
        },
      });
      await sincronizarVinculoDocente(tx, turma.id, turma.professorId);
      await registrarEvento(tx, {
        tipo: "TurmaCriada",
        agregadoTipo: "Turma",
        agregadoId: turma.id,
        autorId: autor.id,
        payload: { codigo, modalidadeId: dados.modalidadeId, nivelId: dados.nivelId, regraAvaliacaoId: turma.regraAvaliacaoId },
      });
      return turma.id;
    });

    revalidatePath(PATH);
    return { id };
  });
}

export async function editarTurma(id: string, input: TurmaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirGestorTurma();
    const dados = TurmaSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      // Matrícula, transferências e diário usam este mesmo lock antes de alterar ocupação/contexto.
      await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Modalidade" WHERE id = ${dados.modalidadeId} FOR SHARE`;
      await exigirGestorAtual(tx, autor.id);
      const atual = await tx.turma.findUnique({ where: { id }, include: { _count: { select: { alocacoes: true } } } });
      if (!atual) throw new ErroRegra("Turma não encontrada.");
      // O formulário de edição não apaga a referência histórica automaticamente.
      // A limpeza explícita demanda a revisão que trate os consumidores legados.
      const dataFim = dados.dataFim ?? atual.dataFim;
      if (dataFim && dataFim <= dados.dataInicio)
        throw new ErroRegra("A data final de referência deve ser depois da data de início.");
      if (dados.nivelId !== atual.nivelId && atual.regraAvaliacaoId)
        throw new ErroRegra("A turma já possui regras de avaliação vinculadas ao nível. A mudança exige revisão acadêmica específica.");
      const dias = (valores: number[]) => [...new Set(valores)].sort((a, b) => a - b).join(",");
      const alterouGrade = dados.modalidadeId !== atual.modalidadeId || dados.nivelId !== atual.nivelId ||
        (dados.professorId || null) !== atual.professorId || dias(dados.diasSemana) !== dias(atual.diasSemana) ||
        !atual.horarioInicio || emMinutos(dados.horarioInicio) !== emMinutos(atual.horarioInicio) ||
        !atual.horarioFim || emMinutos(dados.horarioFim) !== emMinutos(atual.horarioFim) ||
        dados.dataInicio.getTime() !== atual.dataInicio?.getTime() || dataFim?.getTime() !== atual.dataFim?.getTime();
      const alterouDuracaoOuModalidade = dados.modalidadeId !== atual.modalidadeId ||
        !atual.horarioInicio || emMinutos(dados.horarioInicio) !== emMinutos(atual.horarioInicio) ||
        !atual.horarioFim || emMinutos(dados.horarioFim) !== emMinutos(atual.horarioFim);
      const alterouFrequenciaOuModalidade = dados.modalidadeId !== atual.modalidadeId ||
        dias(dados.diasSemana) !== dias(atual.diasSemana);
      if (alterouGrade && await tx.encontroAgenda.count({ where: { turmaId: id, status: { not: "RASCUNHO" } } }))
        throw new ErroRegra("A turma possui agenda publicada. Mudanças de professor, nível, modalidade, datas ou horários exigem revisão e aprovação da agenda.");
      if ((dados.nivelId !== atual.nivelId || dados.modalidadeId !== atual.modalidadeId) && atual._count.alocacoes > 0)
        throw new ErroRegra("Turma com alunos ou histórico não pode mudar de nível ou modalidade. Crie outra turma e solicite a mudança acadêmica.");
      // O formulário/schema ainda não oferece mudança online/presencial. Não ignorar uma tentativa explícita pela API.
      if ("online" in input && input.online !== undefined && input.online !== atual.online)
        throw new ErroRegra("O formato online/presencial não pode ser alterado por esta operação.");
      const ocupacao = await tx.alocacaoTurma.count({ where: { turmaId: id, ativa: true } });
      const reservasOcupantes = await tx.reservaVagaMatricula.count({ where: { turmaId: id, status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } });
      if (reservasOcupantes > 0 && dados.capacidade < ocupacao + reservasOcupantes)
        throw new ErroRegra(`A capacidade deve comportar ${ocupacao} alocações e ${reservasOcupantes} reservas ocupantes.`);
      if (dados.capacidade < ocupacao)
        throw new ErroRegra(`A capacidade não pode ser menor que os ${ocupacao} alunos atualmente alocados.`);
      const diasHorario = await validarAgenda(
        dados.modalidadeId,
        dados.diasSemana,
        dados.horarioInicio,
        dados.horarioFim,
        tx,
        alterouDuracaoOuModalidade,
        alterouFrequenciaOuModalidade,
      );
      const turma = await tx.turma.update({
        where: { id },
        data: {
          nome: dados.nome ?? null,
          modalidadeId: dados.modalidadeId,
          nivelId: dados.nivelId,
          professorId: dados.professorId || null,
          diasSemana: dados.diasSemana,
          horarioInicio: dados.horarioInicio,
          horarioFim: dados.horarioFim,
          diasHorario,
          dataInicio: dados.dataInicio,
          dataFim,
          capacidade: dados.capacidade,
          rolling: dados.rolling,
        },
      });
      await sincronizarVinculoDocente(tx, id, turma.status === StatusTurma.CONCLUIDA ? null : turma.professorId);
      await registrarEvento(tx, {
        tipo: "TurmaEditada",
        agregadoTipo: "Turma",
        agregadoId: id,
        autorId: autor.id,
        payload: {
          diasHorario, capacidade: dados.capacidade,
          de: { nivelId: atual.nivelId, modalidadeId: atual.modalidadeId, professorId: atual.professorId, capacidade: atual.capacidade },
          para: { nivelId: turma.nivelId, modalidadeId: turma.modalidadeId, professorId: turma.professorId, capacidade: turma.capacidade },
        },
      });
    });

    revalidatePath(PATH);
    revalidatePath("/diario");
    revalidatePath("/alunos");
    revalidatePath("/inbox");
  });
}

const EVENTO_STATUS: Record<StatusTurma, string> = {
  PLANEJADA: "TurmaPlanejada",
  ABERTA: "TurmaAberta",
  EM_ANDAMENTO: "TurmaEmAndamento",
  CONCLUIDA: "TurmaConcluida",
};

export async function alterarStatusTurma(id: string, novoStatus: StatusTurma): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirGestorTurma();
    if (!Object.values(StatusTurma).includes(novoStatus)) throw new ErroRegra("Status de turma inválido.");

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${id} FOR UPDATE`;
      await exigirGestorAtual(tx, autor.id);
      const turma = await tx.turma.findUnique({ where: { id } });
      if (!turma) throw new ErroRegra("Turma não encontrada.");
      if (turma.status === novoStatus) return;
      if (turma.status === "CONCLUIDA") throw new ErroRegra("Uma turma concluída não pode ser reaberta pela mudança direta de status.");
      const primeiro = await tx.encontroAgenda.findFirst({ where: { turmaId: id, status: { in: ["PREVISTO", "MINISTRADO"] } },
        orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true } });
      const iniciou = turma.status === "EM_ANDAMENTO" || (!!primeiro && primeiro.inicio <= new Date()) ||
        await tx.aulaDiario.count({ where: { turmaId: id } }) > 0;
      if (iniciou && (novoStatus === "PLANEJADA" || novoStatus === "ABERTA"))
        throw new ErroRegra("A turma já iniciou; não pode retornar a um estado anterior ao início.");
      if (novoStatus === "EM_ANDAMENTO" && (!primeiro || primeiro.inicio > new Date()))
        throw new ErroRegra("O início exige o primeiro encontro válido da agenda no horário correspondente. Confira a agenda ou o histórico legado.");
      const conclusao = novoStatus === "CONCLUIDA" ? await conferirConclusaoTurma(tx, id) : null;
      const atualizada = await tx.turma.update({ where: { id }, data: { status: novoStatus } });
      await sincronizarVinculoDocente(tx, id, novoStatus === StatusTurma.CONCLUIDA ? null : atualizada.professorId);
      await registrarEvento(tx, {
        tipo: EVENTO_STATUS[novoStatus],
        agregadoTipo: "Turma",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: turma.status, para: novoStatus, ...(conclusao ? { conclusao } : {}), ...(novoStatus === "EM_ANDAMENTO" && primeiro ? { encontroId: primeiro.id, inicioEfetivo: primeiro.inicio.toISOString() } : {}) },
      });
    });

    revalidatePath(PATH);
    revalidatePath("/diario");
    revalidatePath("/alunos");
    revalidatePath("/inbox");
  });
}
