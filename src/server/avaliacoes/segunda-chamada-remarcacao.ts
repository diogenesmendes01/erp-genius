"use server";

import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { disponibilidadeRecuperacaoTx } from "./disponibilidade-recuperacao-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { prazoSegundaChamadaVigente } from "./segunda-chamada-prazo";
import {
  canonicalizarPropostaRemarcacaoSegundaChamada,
  DecidirRemarcacaoSegundaChamadaSchema,
  hashPropostaRemarcacaoSegundaChamada,
  normalizarPropostaRemarcacaoSegundaChamada,
  ProporRemarcacaoSegundaChamadaSchema,
} from "./segunda-chamada-remarcacao-schema";
import { instanteUtcSql } from "./segunda-chamada-utc";
import { estadoSegundaChamadaTx } from "./segunda-chamada-tx";
import { autorizacaoEspecialSegundaChamadaVigente } from "./segunda-chamada-autorizacao-especial";
import { professorSegundaChamadaCobreIntervaloTx } from "./segunda-chamada-atribuicao-tx";

const id = z.string().trim().min(1).max(100);
const consultaSchema = z.object({ reservaId: id, antesId: id.optional() }).strict();
const periodosNaoLetivosSchema = z.array(id).max(10_000);
const referenciaCalendarioRemarcacaoSchema = z.object({
  calendarioId: id,
  calendarioVersao: z.number().int().positive(),
  fusoInstitucional: z.string().trim().min(1).max(100),
  periodosNaoLetivos: periodosNaoLetivosSchema,
}).strict();
const hash = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor)).digest("hex");

type EstadoRemarcacao = {
  reserva: {
    id: string;
    propostaId: string;
    matriculaId: string;
    regraId: string;
    codigoAvaliacao: string;
    status: string;
    reservadaEm: string;
    regraCancelamentoMinutos: number;
  };
  agenda: { id: string; encontroId: string; agendadaPorId: string; criadaEm: string } | null;
  encontro: {
    id: string;
    finalidade: string;
    status: string;
    matriculaId: string | null;
    turmaId: string | null;
    professorId: string | null;
    inicio: string;
    fim: string;
    fusoOrigem: string;
  } | null;
  fatos: { ocorrencia: unknown | null; realizacao: unknown | null };
};

type ContextoReserva = {
  reservaId: string;
  propostaId: string;
  matriculaId: string;
  alocacaoId: string;
  turmaId: string;
  regraId: string;
  codigoAvaliacao: string;
  disponibilizacaoId: string | null;
  status: string;
  alunoId: string;
};

type ReferenciaCalendarioRemarcacao = {
  calendarioId: string;
  calendarioVersao: number;
  fusoInstitucional: string;
  periodosNaoLetivos: string[];
};

async function carregarEstadoRemarcacaoTx(tx: PrismaTypes.TransactionClient, reservaId: string) {
  const [linha] = await tx.$queryRaw<{ estado: EstadoRemarcacao | null }[]>(Prisma.sql`
    SELECT estado_remarcacao_agenda_segunda_chamada(${reservaId}) AS estado
  `);
  if (!linha?.estado) throw new ErroRegra("Estado da agenda de segunda chamada não encontrado.");
  return linha.estado;
}

async function contextoRemarcacaoVigenteTx(tx: PrismaTypes.TransactionClient, reserva: ContextoReserva) {
  const [atual] = await tx.$queryRaw<{ confere: boolean }[]>(Prisma.sql`
    SELECT EXISTS(SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id=a."turmaId"
      WHERE a.id=${reserva.alocacaoId} AND a."matriculaId"=${reserva.matriculaId}
        AND a."turmaId"=${reserva.turmaId} AND t."regraAvaliacaoId"=${reserva.regraId}) AS confere
  `);
  return atual?.confere === true;
}

/** A reserva vem antes do calendário/contexto, mantendo a ordem de locks da segunda chamada. */
async function bloquearReservaRemarcacaoTx(
  tx: PrismaTypes.TransactionClient,
  reservaId: string,
  conferirContexto = true,
) {
  const [reserva] = await tx.$queryRaw<ContextoReserva[]>(Prisma.sql`
    SELECT r.id AS "reservaId",r."propostaId" AS "propostaId",r."matriculaId" AS "matriculaId",
      p."alocacaoId" AS "alocacaoId",p."turmaId" AS "turmaId",r."regraId" AS "regraId",
      r."codigoAvaliacao" AS "codigoAvaliacao",s.id AS "disponibilizacaoId",r.status::text AS status,
      m."alunoId" AS "alunoId"
    FROM "ReservaSegundaChamada" r
    JOIN "PropostaSegundaChamada" p ON p.id=r."propostaId"
    JOIN "Matricula" m ON m.id=r."matriculaId"
    LEFT JOIN "DisponibilizacaoSegundaChamada" s ON s."propostaId"=p.id
    WHERE r.id=${reservaId}
    FOR UPDATE OF r
  `);
  if (!reserva) throw new ErroRegra("Reserva de segunda chamada não encontrada.");
  if (!conferirContexto) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
    return reserva;
  }

  const alocacao = await bloquearLancamento(tx, reserva.alocacaoId);
  if (alocacao.matriculaId !== reserva.matriculaId || alocacao.turmaId !== reserva.turmaId) {
    throw new ErroRegra("O vínculo da reserva mudou. Atualize a operação.");
  }
  return reserva;
}

async function conferirPreparadorRemarcacaoTx(
  tx: PrismaTypes.TransactionClient,
  usuarioId: string,
) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({
    where: { id: usuarioId },
    select: { ativo: true, papeis: true },
  });
  if (!usuario?.ativo || !usuario.papeis.some((papel) => ([
    Papel.SECRETARIA_ACADEMICA,
    Papel.GERENTE_PEDAGOGICO,
    Papel.ADMINISTRADOR,
  ] as Papel[]).includes(papel))) {
    throw new ErroPermissao();
  }
}

function conferirReservaAlteravel(estado: EstadoRemarcacao) {
  if (
    estado.reserva.status !== "RESERVADA"
    || !estado.agenda
    || !estado.encontro
    || estado.encontro.finalidade !== "SEGUNDA_CHAMADA"
    || estado.encontro.status !== "PREVISTO"
    || estado.fatos.ocorrencia
    || estado.fatos.realizacao
  ) {
    throw new ErroRegra("Remarcação exige reserva aberta, encontro previsto e ausência de fatos terminais.");
  }
}

async function conferirCalendarioRemarcacaoTx(
  tx: PrismaTypes.TransactionClient,
  destino: { inicio: Date; fim: Date },
): Promise<ReferenciaCalendarioRemarcacao> {
  const [linha] = await tx.$queryRaw<{ estado: Prisma.JsonValue | null }[]>(Prisma.sql`
    SELECT estado_calendario_remarcacao_segunda_chamada(
      ${instanteUtcSql(destino.inicio)},
      ${instanteUtcSql(destino.fim)}
    ) AS estado
  `);
  return referenciaCalendarioRemarcacaoSchema.parse(linha?.estado);
}

function conferirMotivoExcecaoNaoLetiva(
  referencia: ReferenciaCalendarioRemarcacao,
  motivoExcecaoNaoLetiva: string | undefined,
) {
  if (referencia.periodosNaoLetivos.length && !motivoExcecaoNaoLetiva) {
    throw new ErroRegra("O intervalo não letivo exige justificativa específica para decisão independente.");
  }
  if (!referencia.periodosNaoLetivos.length && motivoExcecaoNaoLetiva) {
    throw new ErroRegra("A justificativa de exceção só pode ser informada para período não letivo afetado.");
  }
}

async function conferirDestinoRemarcacaoTx(
  tx: PrismaTypes.TransactionClient,
  reserva: ContextoReserva,
  estado: EstadoRemarcacao,
  destino: { inicio: Date; fim: Date; fusoOrigem: string },
): Promise<ReferenciaCalendarioRemarcacao> {
  conferirReservaAlteravel(estado);
  if (destino.inicio <= new Date()) {
    throw new ErroRegra("O novo horário precisa permanecer futuro na decisão.");
  }
  if (!reserva.disponibilizacaoId) {
    throw new ErroRegra("A proposta aprovada precisa estar disponibilizada antes da remarcação.");
  }

  const prazo = await prazoSegundaChamadaVigente(tx, reserva.disponibilizacaoId);
  if (destino.inicio > prazo || destino.fim > prazo) {
    throw new ErroRegra("O novo horário precisa caber no prazo vigente; prorrogação exige aprovação própria.");
  }
  const estadoAcademico = await estadoSegundaChamadaTx(tx, reserva.alocacaoId, reserva.codigoAvaliacao);
  if (
    estadoAcademico.matriculaId !== reserva.matriculaId
    || estadoAcademico.turmaId !== reserva.turmaId
    || estadoAcademico.regraId !== reserva.regraId
    || !estadoAcademico.pendente
  ) {
    throw new ErroRegra("A avaliação, regra ou vínculo da reserva mudou. Prepare nova remarcação.");
  }
  const fimMenosUmMs = new Date(destino.fim.getTime() - 1);
  const [situacoes] = await tx.$queryRaw<{ inicio: string | null; fim: string | null }[]>(Prisma.sql`
    SELECT situacao_matricula_no_instante(${reserva.matriculaId},${instanteUtcSql(destino.inicio)}) AS inicio,
      situacao_matricula_no_instante(${reserva.matriculaId},${instanteUtcSql(fimMenosUmMs)}) AS fim
  `);
  const conferirBordaContratual = async (situacao: string | null, quando: Date, borda: "início" | "fim") => {
    if (situacao === "ATIVA" && estadoAcademico.ativa) return;
    if (["PAUSADA", "ENCERRADA"].includes(situacao ?? "")
      && await autorizacaoEspecialSegundaChamadaVigente(tx, reserva.alocacaoId, reserva.codigoAvaliacao, quando)) return;
    throw new ErroRegra(`A situação da matrícula no ${borda} do novo horário exige vínculo ativo ou autorização especial vigente.`);
  };
  await conferirBordaContratual(situacoes?.inicio ?? null, destino.inicio, "início");
  await conferirBordaContratual(situacoes?.fim ?? null, fimMenosUmMs, "fim");
  const [cobertura] = await tx.$queryRaw<{ valida: boolean }[]>(Prisma.sql`
    SELECT situacao_autorizacao_segunda_chamada_cobre_intervalo(
      ${reserva.matriculaId},${reserva.alocacaoId},${reserva.codigoAvaliacao},
      ${instanteUtcSql(destino.inicio)},${instanteUtcSql(destino.fim)}
    ) AS valida
  `);
  if (cobertura?.valida !== true) {
    throw new ErroRegra("A situação contratual e a autorização especial precisam cobrir todo o novo intervalo, inclusive suas mudanças internas.");
  }


  const professorId = estado.encontro!.professorId;
  if (!professorId) throw new ErroRegra("A remarcação exige professor definido no encontro atual.");

  const professor = await tx.usuario.findUnique({
    where: { id: professorId },
    select: { ativo: true, papeis: true },
  });
  if (!professor?.ativo || !professor.papeis.includes(Papel.PROFESSOR)) {
    throw new ErroRegra("O professor da segunda chamada precisa estar ativo.");
  }

  if (!(await professorSegundaChamadaCobreIntervaloTx(tx, {
    propostaId: reserva.propostaId,
    professorId,
    inicio: destino.inicio,
    fim: destino.fim,
  }))) {
    throw new ErroRegra("O professor precisa de atribuição durante todo o novo intervalo.");
  }

  const referenciaCalendario = await conferirCalendarioRemarcacaoTx(tx, destino);

  const disponibilidade = await disponibilidadeRecuperacaoTx(tx, {
    alunoId: reserva.alunoId,
    professorId,
    inicio: destino.inicio,
    fim: destino.fim,
    ignorarEncontroId: estado.encontro!.id,
  });
  if (disponibilidade.encontros.length) {
    throw new ErroRegra("Há encontro conflitante para o aluno, turma ou professor no novo horário.");
  }
  if (disponibilidade.indisponibilidades) {
    throw new ErroRegra("O professor possui indisponibilidade aprovada no novo intervalo.");
  }
  if (disponibilidade.reservas) {
    throw new ErroRegra("Há horário contratado reservado no novo intervalo.");
  }
  return referenciaCalendario;
}

/** Q21/Q148/Q149: proposta auditável que mantém a mesma reserva e não troca a agenda. */
export async function proporRemarcacaoAgendaSegundaChamada(
  input: z.input<typeof ProporRemarcacaoSegundaChamadaSchema>,
) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const entrada = canonicalizarPropostaRemarcacaoSegundaChamada(input);
    const entradaHash = hashPropostaRemarcacaoSegundaChamada(entrada);
    return prisma.$transaction(async (tx) => {
      const reserva = await bloquearReservaRemarcacaoTx(tx, entrada.reservaId);
      await conferirPreparadorRemarcacaoTx(tx, usuario.id);

      const [repetida] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`
        SELECT id,"entradaHash" AS "entradaHash"
        FROM "PropostaRemarcacaoAgendaSegundaChamada"
        WHERE "autorId"=${usuario.id} AND "chaveIdempotencia"=${entrada.chaveIdempotencia}
        FOR SHARE
      `);
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) {
          throw new ErroRegra("Chave utilizada com outra proposta de remarcação.");
        }
        const [anterior] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`
          SELECT versao FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=${repetida.id}
        `);
        return { id: repetida.id, versao: anterior?.versao ?? 0 };
      }

      const d = normalizarPropostaRemarcacaoSegundaChamada(entrada);

      const estado = await carregarEstadoRemarcacaoTx(tx, d.reservaId);
      if (hash(estado) !== d.estadoConferido) {
        throw new ErroRegra("A agenda mudou. Atualize a conferência antes de propor a remarcação.");
      }
      const referenciaCalendario = await conferirDestinoRemarcacaoTx(tx, reserva, estado, {
        inicio: new Date(d.inicio),
        fim: new Date(d.fim),
        fusoOrigem: d.fusoOrigem,
      });
      conferirMotivoExcecaoNaoLetiva(referenciaCalendario, d.motivoExcecaoNaoLetiva);

      const [ultima] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`
        SELECT versao FROM "PropostaRemarcacaoAgendaSegundaChamada"
        WHERE "reservaId"=${d.reservaId}
        ORDER BY versao DESC LIMIT 1 FOR UPDATE
      `);
      const propostaId = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "PropostaRemarcacaoAgendaSegundaChamada"
          (id,"reservaId","autorId",versao,inicio,fim,"fusoOrigem",motivo,evidencia,
          "calendarioId","calendarioVersao","fusoInstitucional","periodosNaoLetivos","motivoExcecaoNaoLetiva",
          snapshot,"entradaHash","chaveIdempotencia")
        VALUES
          (${propostaId},${d.reservaId},${usuario.id},${(ultima?.versao ?? 0) + 1},
          ${instanteUtcSql(d.inicio)},${instanteUtcSql(d.fim)},${d.fusoOrigem},${d.motivo},${d.evidencia},
          ${referenciaCalendario.calendarioId},${referenciaCalendario.calendarioVersao},${referenciaCalendario.fusoInstitucional},
          ${JSON.stringify(referenciaCalendario.periodosNaoLetivos)}::jsonb,${d.motivoExcecaoNaoLetiva ?? null},
          ${JSON.stringify(estado)}::jsonb,${entradaHash},${d.chaveIdempotencia})
      `);
      await registrarEvento(tx, {
        tipo: "RemarcacaoAgendaSegundaChamadaProposta",
        agregadoTipo: "Matricula",
        agregadoId: reserva.matriculaId,
        autorId: usuario.id,
        payload: {
          propostaId,
          reservaId: reserva.reservaId,
          inicio: d.inicio,
          fim: d.fim,
          fusoOrigem: d.fusoOrigem,
          calendarioId: referenciaCalendario.calendarioId,
          calendarioVersao: referenciaCalendario.calendarioVersao,
          periodosNaoLetivos: referenciaCalendario.periodosNaoLetivos,
        },
      });
      return { id: propostaId, versao: (ultima?.versao ?? 0) + 1 };
    });
  });
}

/** Outra pessoa da gestão decide; o trigger aplica aprovação de modo atômico e preserva a reserva. */
export async function decidirRemarcacaoAgendaSegundaChamada(
  input: z.input<typeof DecidirRemarcacaoSegundaChamadaSchema>,
) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(
      Papel.GERENTE_PEDAGOGICO,
      Papel.ADMINISTRADOR,
    );
    const d = DecidirRemarcacaoSegundaChamadaSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      const [referencia] = await tx.$queryRaw<{ reservaId: string }[]>(Prisma.sql`
        SELECT "reservaId" AS "reservaId"
        FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=${d.propostaId}
      `);
      if (!referencia) throw new ErroRegra("Proposta de remarcação não encontrada.");

      await conferirGestorAvaliacao(tx, usuario.id);
      const reservaHistorica = await bloquearReservaRemarcacaoTx(tx, referencia.reservaId, false);
      const [replay] = await tx.$queryRaw<{
        autorId: string; entradaHash: string; decisaoId: string | null; decisorId: string | null; aprovada: boolean | null; motivo: string | null; autorizarDiaNaoLetivo: boolean | null; encontroNovoId: string | null;
      }[]>(Prisma.sql`
        SELECT p."autorId" AS "autorId",p."entradaHash" AS "entradaHash",decisao.id AS "decisaoId",decisao."decisorId" AS "decisorId",decisao.aprovada,decisao.motivo,
          decisao."autorizarDiaNaoLetivo" AS "autorizarDiaNaoLetivo",decisao."encontroNovoId" AS "encontroNovoId"
        FROM "PropostaRemarcacaoAgendaSegundaChamada" p
        LEFT JOIN "DecisaoRemarcacaoAgendaSegundaChamada" decisao ON decisao."propostaId"=p.id
        WHERE p.id=${d.propostaId}
      `);
      if (replay && replay.autorId !== usuario.id && replay.entradaHash === d.propostaHash && replay.decisaoId
        && replay.decisorId === usuario.id && replay.aprovada === d.aprovada && replay.motivo === d.motivo && replay.autorizarDiaNaoLetivo === d.autorizarDiaNaoLetivo) {
        return { id: replay.decisaoId, encontroId: replay.encontroNovoId };
      }

      const reserva = d.aprovada
        ? await bloquearReservaRemarcacaoTx(tx, referencia.reservaId)
        : reservaHistorica;
      const [proposta] = await tx.$queryRaw<{
        id: string; reservaId: string; autorId: string; entradaHash: string;
        inicio: Date; fim: Date; fusoOrigem: string; snapshot: Prisma.JsonValue;
        calendarioId: string | null; calendarioVersao: number | null; fusoInstitucional: string | null;
        periodosNaoLetivos: Prisma.JsonValue | null; motivoExcecaoNaoLetiva: string | null;
      }[]>(Prisma.sql`
        SELECT id,"reservaId" AS "reservaId","autorId" AS "autorId","entradaHash" AS "entradaHash",
          inicio,fim,"fusoOrigem" AS "fusoOrigem",snapshot,
          "calendarioId" AS "calendarioId","calendarioVersao" AS "calendarioVersao",
          "fusoInstitucional" AS "fusoInstitucional","periodosNaoLetivos" AS "periodosNaoLetivos",
          "motivoExcecaoNaoLetiva" AS "motivoExcecaoNaoLetiva"
        FROM "PropostaRemarcacaoAgendaSegundaChamada"
        WHERE id=${d.propostaId} FOR UPDATE
      `);
      if (!proposta || proposta.reservaId !== reserva.reservaId) {
        throw new ErroRegra("A proposta de remarcação mudou. Atualize a operação.");
      }
      if (proposta.autorId === usuario.id) {
        throw new ErroRegra("Outra pessoa da gestão deve decidir a remarcação.");
      }
      if (proposta.entradaHash !== d.propostaHash) {
        throw new ErroRegra("Confira a proposta exata antes de decidir.");
      }

      const [existente] = await tx.$queryRaw<{
        id: string; decisorId: string; aprovada: boolean; motivo: string; autorizarDiaNaoLetivo: boolean; encontroNovoId: string | null;
      }[]>(Prisma.sql`
        SELECT id,"decisorId" AS "decisorId",aprovada,motivo,
          "autorizarDiaNaoLetivo" AS "autorizarDiaNaoLetivo","encontroNovoId" AS "encontroNovoId"
        FROM "DecisaoRemarcacaoAgendaSegundaChamada"
        WHERE "propostaId"=${proposta.id} FOR SHARE
      `);
      if (existente) {
        if (
          existente.decisorId === usuario.id
          && existente.aprovada === d.aprovada
          && existente.motivo === d.motivo
          && existente.autorizarDiaNaoLetivo === d.autorizarDiaNaoLetivo
        ) {
          return { id: existente.id, encontroId: existente.encontroNovoId };
        }
        throw new ErroRegra("A proposta já possui decisão.");
      }

      if (!d.aprovada && d.autorizarDiaNaoLetivo) {
        throw new ErroRegra("Rejeição não autoriza exceção de calendário.");
      }

      if (d.aprovada) {
        if (
          !proposta.calendarioId
          || proposta.calendarioVersao === null
          || !proposta.fusoInstitucional
          || !proposta.periodosNaoLetivos
        ) {
          throw new ErroRegra("A proposta histórica não tem conferência de calendário; prepare nova proposta antes de aprovar.");
        }
        const referenciaProposta: ReferenciaCalendarioRemarcacao = {
          calendarioId: proposta.calendarioId,
          calendarioVersao: proposta.calendarioVersao,
          fusoInstitucional: proposta.fusoInstitucional,
          periodosNaoLetivos: periodosNaoLetivosSchema.parse(proposta.periodosNaoLetivos),
        };
        conferirMotivoExcecaoNaoLetiva(referenciaProposta, proposta.motivoExcecaoNaoLetiva ?? undefined);
        if (d.autorizarDiaNaoLetivo !== (referenciaProposta.periodosNaoLetivos.length > 0)) {
          throw new ErroRegra("Confira a autorização explícita para período não letivo.");
        }
        const estado = await carregarEstadoRemarcacaoTx(tx, reserva.reservaId);
        if (hash(estado) !== hash(proposta.snapshot)) {
          throw new ErroRegra("A agenda mudou desde a proposta. Prepare nova remarcação.");
        }
        const referenciaAtual = await conferirDestinoRemarcacaoTx(tx, reserva, estado, {
          inicio: proposta.inicio,
          fim: proposta.fim,
          fusoOrigem: proposta.fusoOrigem,
        });
        if (JSON.stringify(referenciaAtual) !== JSON.stringify(referenciaProposta)) {
          throw new ErroRegra("O calendário ou os períodos não letivos mudaram desde a proposta. Prepare nova remarcação.");
        }
      }

      const decisaoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "DecisaoRemarcacaoAgendaSegundaChamada"
          (id,"propostaId","decisorId",aprovada,"autorizarDiaNaoLetivo",motivo)
        VALUES (${decisaoId},${proposta.id},${usuario.id},${d.aprovada},${d.autorizarDiaNaoLetivo},${d.motivo})
      `);
      const [decisao] = await tx.$queryRaw<{ encontroNovoId: string | null }[]>(Prisma.sql`
        SELECT "encontroNovoId" AS "encontroNovoId"
        FROM "DecisaoRemarcacaoAgendaSegundaChamada" WHERE id=${decisaoId}
      `);
      if (!decisao) throw new ErroRegra("A decisão de remarcação não foi persistida.");
      if (d.aprovada && !decisao.encontroNovoId) {
        throw new ErroRegra("A aplicação atômica da remarcação não concluiu.");
      }
      await registrarEvento(tx, {
        tipo: d.aprovada ? "RemarcacaoAgendaSegundaChamadaAprovada" : "RemarcacaoAgendaSegundaChamadaRejeitada",
        agregadoTipo: "Matricula",
        agregadoId: reserva.matriculaId,
        autorId: usuario.id,
        payload: {
          propostaId: proposta.id,
          decisaoId,
          reservaId: reserva.reservaId,
          encontroNovoId: decisao.encontroNovoId,
          autorizarDiaNaoLetivo: d.autorizarDiaNaoLetivo,
        },
      });
      return { id: decisaoId, encontroId: decisao.encontroNovoId };
    });
  });
}

/** Revisão administrativa da reserva identificada, sem alterar a agenda ou o prazo. */
export async function consultarRemarcacoesAgendaSegundaChamada(input: z.input<typeof consultaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(
      Papel.SECRETARIA_ACADEMICA,
      Papel.GERENTE_PEDAGOGICO,
      Papel.ADMINISTRADOR,
    );
    const d = consultaSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      const reserva = await bloquearReservaRemarcacaoTx(tx, d.reservaId, false);
      const contextoVigente = await contextoRemarcacaoVigenteTx(tx, reserva);
      await conferirPreparadorRemarcacaoTx(tx, usuario.id);
      const usuarioAtual = await tx.usuario.findUniqueOrThrow({
        where: { id: usuario.id },
        select: { papeis: true },
      });
      const podeDecidir = usuarioAtual.papeis.some((papel) =>
        papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR,
      );
      const estado = await carregarEstadoRemarcacaoTx(tx, d.reservaId);
      const cursor = d.antesId ? (await tx.$queryRaw<{ id: string; versao: number }[]>(Prisma.sql`
        SELECT id, versao
        FROM "PropostaRemarcacaoAgendaSegundaChamada"
        WHERE id = ${d.antesId} AND "reservaId" = ${d.reservaId}
      `))[0] : undefined;
      if (d.antesId && !cursor) {
        throw new ErroRegra("Cursor de remarcações não encontrado para esta reserva.");
      }
      const depoisCursor = cursor ? Prisma.sql`AND p.versao < ${cursor.versao}` : Prisma.empty;
      const propostas = await tx.$queryRaw<{
        id: string; autorId: string; autorNome: string; versao: number; inicio: Date; fim: Date;
        fusoOrigem: string; motivo: string; evidencia: string; criadaEm: Date; entradaHash: string;
        snapshot: Prisma.JsonValue; calendarioId: string | null; calendarioVersao: number | null;
        fusoInstitucional: string | null; periodosNaoLetivos: Prisma.JsonValue | null;
        motivoExcecaoNaoLetiva: string | null; decisaoId: string | null; aprovada: boolean | null;
        autorizarDiaNaoLetivo: boolean | null;
        motivoDecisao: string | null; decisorNome: string | null; encontroNovoId: string | null;
      }[]>(Prisma.sql`
        SELECT p.id,p."autorId" AS "autorId",autor.nome AS "autorNome",p.versao,p.inicio,p.fim,
          p."fusoOrigem" AS "fusoOrigem",p.motivo,p.evidencia,p."criadaEm" AS "criadaEm",
          p."entradaHash" AS "entradaHash",p.snapshot,
          p."calendarioId" AS "calendarioId",p."calendarioVersao" AS "calendarioVersao",
          p."fusoInstitucional" AS "fusoInstitucional",p."periodosNaoLetivos" AS "periodosNaoLetivos",
          p."motivoExcecaoNaoLetiva" AS "motivoExcecaoNaoLetiva",decisao.id AS "decisaoId",decisao.aprovada,
          decisao."autorizarDiaNaoLetivo" AS "autorizarDiaNaoLetivo",
          decisao.motivo AS "motivoDecisao",decisor.nome AS "decisorNome",
          decisao."encontroNovoId" AS "encontroNovoId"
        FROM "PropostaRemarcacaoAgendaSegundaChamada" p
        JOIN "Usuario" autor ON autor.id=p."autorId"
        LEFT JOIN "DecisaoRemarcacaoAgendaSegundaChamada" decisao ON decisao."propostaId"=p.id
        LEFT JOIN "Usuario" decisor ON decisor.id=decisao."decisorId"
        WHERE p."reservaId"=${d.reservaId} ${depoisCursor}
        ORDER BY p.versao DESC,p."criadaEm" DESC,p.id DESC
        LIMIT 21
      `);
      const pagina = propostas.slice(0, 20);
      return {
        reservaId: d.reservaId,
        identificacao: await identificarMatriculaAvaliacao(tx, reserva.matriculaId, reserva.turmaId),
        atual: estado,
        contextoVigente,
        estadoHash: hash(estado),
        podePropor: contextoVigente && reserva.status === "RESERVADA" && !!estado.encontro && estado.encontro.status === "PREVISTO"
          && !estado.fatos.ocorrencia && !estado.fatos.realizacao,
        itens: pagina.map((proposta) => ({
          id: proposta.id,
          versao: proposta.versao,
          autorNome: proposta.autorNome,
          inicio: proposta.inicio.toISOString(),
          fim: proposta.fim.toISOString(),
          fusoOrigem: proposta.fusoOrigem,
          motivo: proposta.motivo,
          evidencia: proposta.evidencia,
          criadaEm: proposta.criadaEm.toISOString(),
          entradaHash: proposta.entradaHash,
          snapshot: proposta.snapshot,
          calendario: proposta.calendarioId && proposta.calendarioVersao !== null && proposta.fusoInstitucional && proposta.periodosNaoLetivos
            ? {
              id: proposta.calendarioId,
              versao: proposta.calendarioVersao,
              fusoInstitucional: proposta.fusoInstitucional,
              periodosNaoLetivos: periodosNaoLetivosSchema.parse(proposta.periodosNaoLetivos),
            }
            : null,
          motivoExcecaoNaoLetiva: proposta.motivoExcecaoNaoLetiva,
          decisao: proposta.decisaoId ? {
            aprovada: proposta.aprovada!,
            motivo: proposta.motivoDecisao ?? "",
            decisorNome: proposta.decisorNome ?? "",
            encontroNovoId: proposta.encontroNovoId,
            autorizarDiaNaoLetivo: proposta.autorizarDiaNaoLetivo!,
          } : null,
          podeDecidir: podeDecidir && !proposta.decisaoId && proposta.autorId !== usuario.id,
          podeAprovar: contextoVigente && podeDecidir && !proposta.decisaoId && proposta.autorId !== usuario.id,
          impedimentoAprovacao: contextoVigente ? null : "O contexto da segunda chamada mudou; esta proposta pode ser rejeitada, mas não aprovada.",
        })),
        proximoId: propostas.length > 20 ? pagina.at(-1)!.id : null,
      };
    });
  });
}
