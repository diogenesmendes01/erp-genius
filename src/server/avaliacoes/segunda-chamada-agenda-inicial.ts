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
import { professorSegundaChamadaCobreIntervaloTx } from "./segunda-chamada-atribuicao-tx";
import {
  canonicalizarAgendaInicialSegundaChamada,
  DecidirAgendaInicialSegundaChamadaSchema,
  hashAgendaInicialSegundaChamada,
  normalizarAgendaInicialSegundaChamada,
  ProporAgendaInicialSegundaChamadaSchema,
} from "./segunda-chamada-agenda-inicial-schema";
import { instanteUtcSql } from "./segunda-chamada-utc";
import { estadoSegundaChamadaTx } from "./segunda-chamada-tx";

const id = z.string().trim().min(1).max(100);
const referenciaCalendarioSchema = z.object({
  calendarioId: id,
  calendarioVersao: z.number().int().positive(),
  fusoInstitucional: z.string().trim().min(1).max(100),
  periodosNaoLetivos: z.array(id).max(10_000),
}).strict();
const periodosLegiveisSchema = z.array(z.object({
  id: id,
  nome: z.string().trim().min(1),
  inicio: z.string().min(1),
  fim: z.string().min(1),
}).passthrough()).max(10_000);
const previaSchema = ProporAgendaInicialSegundaChamadaSchema.pick({
  propostaSegundaChamadaId: true,
  professorId: true,
  inicio: true,
  fim: true,
  fusoOrigem: true,
}).strict();
const consultaSchema = z.object({ propostaSegundaChamadaId: id, antesId: id.optional() }).strict();
const papeisPreparadores: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR];
function jsonEstavel(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonEstavel).join(",")}]`;
  if (valor && typeof valor === "object") {
    return `{${Object.entries(valor as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, item]) => `${JSON.stringify(chave)}:${jsonEstavel(item)}`).join(",")}}`;
  }
  return JSON.stringify(valor);
}
const hash = (valor: unknown) => createHash("sha256").update(jsonEstavel(valor)).digest("hex");

type Contexto = {
  id: string; matriculaId: string; alocacaoId: string; turmaId: string; nivelId: string;
  regraId: string; codigoAvaliacao: string; alunoId: string; disponibilizacaoId: string | null;
};
type ReferenciaCalendario = z.infer<typeof referenciaCalendarioSchema>;

async function conferirPreparadorTx(tx: PrismaTypes.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.some((papel) => papeisPreparadores.includes(papel))) throw new ErroPermissao();
}

async function carregarContextoTx(tx: PrismaTypes.TransactionClient, propostaSegundaChamadaId: string) {
  const consultar = (bloquear: boolean) => tx.$queryRaw<Contexto[]>(Prisma.sql`
    SELECT p.id,p."matriculaId" AS "matriculaId",p."alocacaoId" AS "alocacaoId",p."turmaId" AS "turmaId",
      p."nivelId" AS "nivelId",p."regraId" AS "regraId",p."codigoAvaliacao" AS "codigoAvaliacao",
      m."alunoId" AS "alunoId",s.id AS "disponibilizacaoId"
    FROM "PropostaSegundaChamada" p
    JOIN "Matricula" m ON m.id=p."matriculaId"
    LEFT JOIN "DecisaoSegundaChamada" decisao ON decisao."propostaId"=p.id AND decisao.aprovada
    LEFT JOIN "DisponibilizacaoSegundaChamada" s ON s."propostaId"=p.id
    WHERE p.id=${propostaSegundaChamadaId} AND decisao."propostaId" IS NOT NULL
    ${bloquear ? Prisma.sql`FOR UPDATE OF p` : Prisma.empty}
  `);
  const [leve] = await consultar(false);
  if (!leve?.disponibilizacaoId) throw new ErroRegra("A segunda chamada precisa estar aprovada e disponibilizada antes da agenda.");
  const alocacao = await bloquearLancamento(tx, leve.alocacaoId);
  const [contexto] = await consultar(true);
  if (!contexto?.disponibilizacaoId || contexto.alocacaoId !== leve.alocacaoId
    || contexto.matriculaId !== leve.matriculaId || contexto.turmaId !== leve.turmaId
    || alocacao.matriculaId !== contexto.matriculaId || alocacao.turmaId !== contexto.turmaId) {
    throw new ErroRegra("O vínculo da segunda chamada mudou. Atualize a conferência.");
  }
  return contexto;
}

async function carregarContextoHistoricoTx(tx: PrismaTypes.TransactionClient, propostaSegundaChamadaId: string) {
  const [contexto] = await tx.$queryRaw<Contexto[]>(Prisma.sql`
    SELECT p.id,p."matriculaId" AS "matriculaId",p."alocacaoId" AS "alocacaoId",p."turmaId" AS "turmaId",
      p."nivelId" AS "nivelId",p."regraId" AS "regraId",p."codigoAvaliacao" AS "codigoAvaliacao",
      m."alunoId" AS "alunoId",s.id AS "disponibilizacaoId"
    FROM "PropostaSegundaChamada" p JOIN "Matricula" m ON m.id=p."matriculaId"
    LEFT JOIN "DisponibilizacaoSegundaChamada" s ON s."propostaId"=p.id
    WHERE p.id=${propostaSegundaChamadaId}
  `);
  if (!contexto) throw new ErroRegra("Fonte histórica da segunda chamada não encontrada.");
  return contexto;
}

async function contextoAgendaVigenteTx(tx: PrismaTypes.TransactionClient, contexto: Contexto) {
  const [atual] = await tx.$queryRaw<{ confere: boolean }[]>(Prisma.sql`
    SELECT EXISTS(SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id=a."turmaId"
      WHERE a.id=${contexto.alocacaoId} AND a."matriculaId"=${contexto.matriculaId}
        AND a."turmaId"=${contexto.turmaId} AND t."regraAvaliacaoId"=${contexto.regraId}) AS confere
  `);
  return atual?.confere === true;
}

async function conferirCalendarioTx(tx: PrismaTypes.TransactionClient, inicio: Date, fim: Date): Promise<ReferenciaCalendario> {
  const [linha] = await tx.$queryRaw<{ estado: Prisma.JsonValue | null }[]>(Prisma.sql`
    SELECT estado_calendario_remarcacao_segunda_chamada(
      ${instanteUtcSql(inicio)},${instanteUtcSql(fim)}
    ) AS estado
  `);
  return referenciaCalendarioSchema.parse(linha?.estado);
}

function conferirExcecao(referencia: ReferenciaCalendario, motivo: string | undefined) {
  if (referencia.periodosNaoLetivos.length && !motivo) throw new ErroRegra("O período não letivo exige justificativa específica para decisão independente.");
  if (!referencia.periodosNaoLetivos.length && motivo) throw new ErroRegra("A justificativa de exceção só é válida para período não letivo afetado.");
}

async function calendarioExibicaoTx(tx: PrismaTypes.TransactionClient, referencia: ReferenciaCalendario) {
  const calendario = await tx.versaoCalendarioEscolar.findUnique({
    where: { id: referencia.calendarioId }, select: { periodos: true },
  });
  const periodos = calendario
    ? periodosLegiveisSchema.parse(calendario.periodos).filter((periodo) => referencia.periodosNaoLetivos.includes(periodo.id))
      .map(({ nome, inicio, fim }) => ({ nome, inicio, fim }))
    : [];
  return { versao: referencia.calendarioVersao, fusoInstitucional: referencia.fusoInstitucional, periodos };
}

async function conferirAgendaTx(
  tx: PrismaTypes.TransactionClient,
  contexto: Contexto,
  destino: { professorId: string; inicio: Date; fim: Date; fusoOrigem: string },
) {
  if (destino.fim <= destino.inicio || destino.inicio <= new Date()) throw new ErroRegra("O encontro precisa ser futuro e ter fim posterior ao início.");
  const estado = await estadoSegundaChamadaTx(tx, contexto.alocacaoId, contexto.codigoAvaliacao);
  if (
    !estado.pendente
    || estado.matriculaId !== contexto.matriculaId || estado.turmaId !== contexto.turmaId
    || estado.regraId !== contexto.regraId || estado.saldo <= 0
  ) throw new ErroRegra("A avaliação, o vínculo ou o saldo da segunda chamada mudou.");
  const [cobertura] = await tx.$queryRaw<{ cobre: boolean | null }[]>(Prisma.sql`
    SELECT situacao_autorizacao_segunda_chamada_cobre_intervalo(
      ${contexto.matriculaId},${contexto.alocacaoId},${contexto.codigoAvaliacao},
      ${instanteUtcSql(destino.inicio)},${instanteUtcSql(destino.fim)}
    ) AS cobre
  `);
  if (cobertura?.cobre !== true) {
    throw new ErroRegra("O intervalo da agenda exige vínculo ativo ou autorização especial vigente em toda a segunda chamada.");
  }
  const prazo = await prazoSegundaChamadaVigente(tx, contexto.disponibilizacaoId!);
  if (destino.fim > prazo) throw new ErroRegra("O encontro inteiro precisa caber no prazo vigente.");
  const professor = await tx.usuario.findUnique({ where: { id: destino.professorId }, select: { ativo: true, papeis: true } });
  if (!professor?.ativo || !professor.papeis.includes(Papel.PROFESSOR)) throw new ErroRegra("Informe professor ativo para a segunda chamada.");
  if (!(await professorSegundaChamadaCobreIntervaloTx(tx, {
    propostaId: contexto.id, professorId: destino.professorId, inicio: destino.inicio, fim: destino.fim,
  }))) throw new ErroRegra("O professor precisa de atribuição durante todo o intervalo da segunda chamada.");
  const calendario = await conferirCalendarioTx(tx, destino.inicio, destino.fim);
  const disponibilidade = await disponibilidadeRecuperacaoTx(tx, {
    alunoId: contexto.alunoId, professorId: destino.professorId, inicio: destino.inicio, fim: destino.fim,
  });
  if (disponibilidade.encontros.length) throw new ErroRegra("Há encontro conflitante para o aluno, turma ou professor no intervalo da segunda chamada.");
  if (disponibilidade.indisponibilidades) throw new ErroRegra("O professor possui indisponibilidade aprovada no intervalo da segunda chamada.");
  if (disponibilidade.reservas) throw new ErroRegra("Há horário comercial reservado para o aluno ou professor no intervalo da segunda chamada.");
  const estadoConferido = {
    propostaSegundaChamadaId: contexto.id,
    matriculaId: contexto.matriculaId,
    alocacaoId: contexto.alocacaoId,
    turmaId: contexto.turmaId,
    regraId: contexto.regraId,
    codigoAvaliacao: contexto.codigoAvaliacao,
    prazoAte: prazo.toISOString(),
    professorId: destino.professorId,
    inicio: destino.inicio.toISOString(),
    fim: destino.fim.toISOString(),
    fusoOrigem: destino.fusoOrigem,
    calendario,
    conflitos: { encontros: disponibilidade.encontros.map((encontro) => ({
      inicio: encontro.inicio.toISOString(), fim: encontro.fim.toISOString(), professorId: encontro.professorId,
    })), indisponibilidades: disponibilidade.indisponibilidades, reservas: disponibilidade.reservas },
  };
  return { estado: estadoConferido, estadoConferidoHash: hash(estadoConferido), calendario };
}

/** Prévia sem efeitos; o hash identifica o conjunto efetivamente revisado. */
export async function consultarPreviaAgendaInicialSegundaChamada(input: z.input<typeof previaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const d = previaSchema.parse(input);
    const inicio = new Date(d.inicio), fim = new Date(d.fim);
    return prisma.$transaction(async (tx) => {
      await conferirPreparadorTx(tx, usuario.id);
      const contexto = await carregarContextoTx(tx, d.propostaSegundaChamadaId);
      const conferencia = await conferirAgendaTx(tx, contexto, { ...d, inicio, fim });
      return {
        ...conferencia.estado,
        calendario: await calendarioExibicaoTx(tx, conferencia.calendario),
        estadoConferido: conferencia.estadoConferidoHash,
        identificacao: await identificarMatriculaAvaliacao(tx, contexto.matriculaId, contexto.turmaId),
      };
    });
  });
}

/** Prepara uma agenda concreta sem reservar oportunidade nem criar encontro. */
export async function proporAgendaInicialSegundaChamada(input: z.input<typeof ProporAgendaInicialSegundaChamadaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const entrada = canonicalizarAgendaInicialSegundaChamada(input);
    const entradaHash = hashAgendaInicialSegundaChamada(entrada);
    return prisma.$transaction(async (tx) => {
      await conferirPreparadorTx(tx, usuario.id);
      const contexto = await carregarContextoTx(tx, entrada.propostaSegundaChamadaId);
      const [repetida] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`
        SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaAgendaSegundaChamada"
        WHERE "autorId"=${usuario.id} AND "chaveIdempotencia"=${entrada.chaveIdempotencia} FOR SHARE
      `);
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada com outra agenda inicial.");
        return { id: repetida.id, entradaHash };
      }
      const d = normalizarAgendaInicialSegundaChamada(entrada);
      const conferencia = await conferirAgendaTx(tx, contexto, {
        professorId: d.professorId, inicio: new Date(d.inicio), fim: new Date(d.fim), fusoOrigem: d.fusoOrigem,
      });
      if (conferencia.estadoConferidoHash !== d.estadoConferido) throw new ErroRegra("A agenda mudou. Atualize a prévia antes de propor.");
      conferirExcecao(conferencia.calendario, d.motivoExcecaoNaoLetiva);
      const [ultima] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`
        SELECT versao FROM "PropostaAgendaSegundaChamada"
        WHERE "propostaSegundaChamadaId"=${contexto.id} ORDER BY versao DESC LIMIT 1 FOR UPDATE
      `);
      const propostaId = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "PropostaAgendaSegundaChamada"
          (id,"propostaSegundaChamadaId","autorId","professorId",versao,inicio,fim,"fusoOrigem",motivo,evidencia,
          "motivoExcecaoNaoLetiva","calendarioId","calendarioVersao","fusoInstitucional","periodosNaoLetivos",snapshot,"entradaHash","chaveIdempotencia")
        VALUES (${propostaId},${contexto.id},${usuario.id},${d.professorId},${(ultima?.versao ?? 0) + 1},
          ${instanteUtcSql(d.inicio)},${instanteUtcSql(d.fim)},${d.fusoOrigem},${d.motivo},${d.evidencia},
          ${d.motivoExcecaoNaoLetiva ?? null},${conferencia.calendario.calendarioId},${conferencia.calendario.calendarioVersao},
          ${conferencia.calendario.fusoInstitucional},${JSON.stringify(conferencia.calendario.periodosNaoLetivos)}::jsonb,
          ${JSON.stringify(conferencia.estado)}::jsonb,${entradaHash},${d.chaveIdempotencia})
      `);
      await registrarEvento(tx, { tipo: "AgendaInicialSegundaChamadaProposta", agregadoTipo: "Matricula", agregadoId: contexto.matriculaId, autorId: usuario.id,
        payload: { propostaId, propostaSegundaChamadaId: contexto.id, professorId: d.professorId, inicio: d.inicio, fim: d.fim } });
      return { id: propostaId, entradaHash };
    });
  });
}

/** Outra pessoa da gestão decide; o trigger SQL aplica encontro, reserva e agenda numa transação. */
export async function decidirAgendaInicialSegundaChamada(input: z.input<typeof DecidirAgendaInicialSegundaChamadaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const d = DecidirAgendaInicialSegundaChamadaSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      const [referencia] = await tx.$queryRaw<{ propostaSegundaChamadaId: string; matriculaId: string }[]>(Prisma.sql`
        SELECT agenda."propostaSegundaChamadaId" AS "propostaSegundaChamadaId",
          fonte."matriculaId" AS "matriculaId"
        FROM "PropostaAgendaSegundaChamada" agenda
        JOIN "PropostaSegundaChamada" fonte ON fonte.id=agenda."propostaSegundaChamadaId"
        WHERE agenda.id=${d.propostaId}
      `);
      if (!referencia) throw new ErroRegra("Proposta de agenda inicial não encontrada.");
      await conferirGestorAvaliacao(tx, usuario.id);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const [replay] = await tx.$queryRaw<{
        autorId: string; entradaHash: string; decisaoId: string | null; decisorId: string | null; aprovada: boolean | null; motivo: string | null; autorizarDiaNaoLetivo: boolean | null;
        encontroId: string | null; reservaId: string | null; agendaId: string | null;
      }[]>(Prisma.sql`
        SELECT p."autorId" AS "autorId",p."entradaHash" AS "entradaHash",decisao.id AS "decisaoId",decisao."decisorId" AS "decisorId",decisao.aprovada,decisao.motivo,
          decisao."autorizarDiaNaoLetivo" AS "autorizarDiaNaoLetivo",decisao."encontroId" AS "encontroId",aplicacao."reservaId" AS "reservaId",aplicacao."agendaId" AS "agendaId"
        FROM "PropostaAgendaSegundaChamada" p
        LEFT JOIN "DecisaoAgendaSegundaChamada" decisao ON decisao."propostaId"=p.id
        LEFT JOIN "AplicacaoAgendaSegundaChamada" aplicacao ON aplicacao."decisaoId"=decisao.id
        WHERE p.id=${d.propostaId}
      `);
      if (replay && replay.autorId !== usuario.id && replay.entradaHash === d.propostaHash && replay.decisaoId
        && replay.decisorId === usuario.id && replay.aprovada === d.aprovada && replay.motivo === d.motivo && replay.autorizarDiaNaoLetivo === d.autorizarDiaNaoLetivo) {
        return { decisaoId: replay.decisaoId, encontroId: replay.encontroId, reservaId: replay.reservaId, agendaId: replay.agendaId };
      }
      const contexto = d.aprovada
        ? await carregarContextoTx(tx, referencia.propostaSegundaChamadaId)
        : null;
      const [proposta] = await tx.$queryRaw<{
        id: string; propostaSegundaChamadaId: string; autorId: string; entradaHash: string; professorId: string; inicio: Date; fim: Date; fusoOrigem: string;
        snapshot: Prisma.JsonValue; calendarioId: string | null; calendarioVersao: number | null;
        fusoInstitucional: string | null; periodosNaoLetivos: Prisma.JsonValue | null; motivoExcecaoNaoLetiva: string | null;
      }[]>(Prisma.sql`
        SELECT id,"propostaSegundaChamadaId" AS "propostaSegundaChamadaId","autorId" AS "autorId","entradaHash" AS "entradaHash","professorId" AS "professorId",inicio,fim,
          "fusoOrigem" AS "fusoOrigem",snapshot,"calendarioId" AS "calendarioId","calendarioVersao" AS "calendarioVersao",
          "fusoInstitucional" AS "fusoInstitucional","periodosNaoLetivos" AS "periodosNaoLetivos",
          "motivoExcecaoNaoLetiva" AS "motivoExcecaoNaoLetiva"
        FROM "PropostaAgendaSegundaChamada" WHERE id=${d.propostaId} FOR UPDATE
      `);
      if (!proposta || proposta.propostaSegundaChamadaId !== referencia.propostaSegundaChamadaId || proposta.autorId === usuario.id || proposta.entradaHash !== d.propostaHash) {
        throw new ErroRegra("Confira uma proposta de outra pessoa antes de decidir.");
      }
      const [existente] = await tx.$queryRaw<{
        id: string; decisorId: string; aprovada: boolean; motivo: string; autorizarDiaNaoLetivo: boolean;
        encontroId: string | null; reservaId: string | null; agendaId: string | null;
      }[]>(Prisma.sql`
        SELECT d.id,d."decisorId" AS "decisorId",d.aprovada,d.motivo,d."autorizarDiaNaoLetivo" AS "autorizarDiaNaoLetivo",
          d."encontroId" AS "encontroId",a."reservaId" AS "reservaId",a."agendaId" AS "agendaId"
        FROM "DecisaoAgendaSegundaChamada" d
        LEFT JOIN "AplicacaoAgendaSegundaChamada" a ON a."decisaoId"=d.id
        WHERE d."propostaId"=${proposta.id} FOR SHARE OF d
      `);
      if (existente) {
        if (existente.decisorId === usuario.id && existente.aprovada === d.aprovada && existente.motivo === d.motivo && existente.autorizarDiaNaoLetivo === d.autorizarDiaNaoLetivo) {
          return { decisaoId: existente.id, encontroId: existente.encontroId, reservaId: existente.reservaId, agendaId: existente.agendaId };
        }
        throw new ErroRegra("A proposta de agenda já possui decisão.");
      }
      if (!d.aprovada && d.autorizarDiaNaoLetivo) throw new ErroRegra("Rejeição não autoriza exceção de calendário.");
      if (d.aprovada) {
        if (!proposta.calendarioId || proposta.calendarioVersao === null || !proposta.fusoInstitucional || !proposta.periodosNaoLetivos) {
          throw new ErroRegra("A proposta histórica não tem conferência de calendário; prepare nova proposta antes de aprovar.");
        }
        const calendarioProposto = referenciaCalendarioSchema.parse({
          calendarioId: proposta.calendarioId, calendarioVersao: proposta.calendarioVersao,
          fusoInstitucional: proposta.fusoInstitucional, periodosNaoLetivos: proposta.periodosNaoLetivos,
        });
        conferirExcecao(calendarioProposto, proposta.motivoExcecaoNaoLetiva ?? undefined);
        if (d.autorizarDiaNaoLetivo !== (calendarioProposto.periodosNaoLetivos.length > 0)) {
          throw new ErroRegra("Confira a autorização explícita para período não letivo.");
        }
        const conferencia = await conferirAgendaTx(tx, contexto!, {
          professorId: proposta.professorId, inicio: proposta.inicio, fim: proposta.fim, fusoOrigem: proposta.fusoOrigem,
        });
        if (hash(proposta.snapshot) !== conferencia.estadoConferidoHash) {
          throw new ErroRegra("A agenda mudou desde a proposta. Prepare nova versão.");
        }
        if (JSON.stringify(calendarioProposto) !== JSON.stringify(conferencia.calendario)) {
          throw new ErroRegra("O calendário ou os períodos não letivos mudaram. Prepare nova proposta.");
        }
      }
      const decisaoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "DecisaoAgendaSegundaChamada"
          (id,"propostaId","decisorId",aprovada,"autorizarDiaNaoLetivo",motivo)
        VALUES (${decisaoId},${proposta.id},${usuario.id},${d.aprovada},${d.autorizarDiaNaoLetivo},${d.motivo})
      `);
      const [aplicacao] = await tx.$queryRaw<{ encontroId: string | null; reservaId: string | null; agendaId: string | null }[]>(Prisma.sql`
        SELECT d."encontroId" AS "encontroId",a."reservaId" AS "reservaId",a."agendaId" AS "agendaId"
        FROM "DecisaoAgendaSegundaChamada" d LEFT JOIN "AplicacaoAgendaSegundaChamada" a ON a."decisaoId"=d.id
        WHERE d.id=${decisaoId}
      `);
      if (!aplicacao || (d.aprovada && (!aplicacao.encontroId || !aplicacao.reservaId || !aplicacao.agendaId))) {
        throw new ErroRegra("A aplicação atômica da agenda inicial não concluiu.");
      }
      await registrarEvento(tx, { tipo: d.aprovada ? "AgendaInicialSegundaChamadaAprovada" : "AgendaInicialSegundaChamadaRejeitada", agregadoTipo: "Matricula", agregadoId: contexto?.matriculaId ?? referencia.matriculaId, autorId: usuario.id,
        payload: { propostaId: proposta.id, decisaoId, encontroId: aplicacao.encontroId, reservaId: aplicacao.reservaId, agendaId: aplicacao.agendaId, autorizarDiaNaoLetivo: d.autorizarDiaNaoLetivo } });
      return { decisaoId, encontroId: aplicacao.encontroId, reservaId: aplicacao.reservaId, agendaId: aplicacao.agendaId };
    });
  });
}

/** Histórico administrativo; não libera reserva, realização ou decisão fora das permissões. */
export async function consultarAgendasIniciaisSegundaChamada(input: z.input<typeof consultaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const d = consultaSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await conferirPreparadorTx(tx, usuario.id);
      const contexto = await carregarContextoHistoricoTx(tx, d.propostaSegundaChamadaId);
      const contextoVigente = await contextoAgendaVigenteTx(tx, contexto);
      const cursor = d.antesId ? (await tx.$queryRaw<{ id: string; versao: number }[]>(Prisma.sql`
        SELECT id,versao FROM "PropostaAgendaSegundaChamada"
        WHERE id=${d.antesId} AND "propostaSegundaChamadaId"=${contexto.id}
      `))[0] : undefined;
      if (d.antesId && !cursor) throw new ErroRegra("Cursor de agendas iniciais não encontrado para esta segunda chamada.");
      const depois = cursor ? Prisma.sql`AND p.versao < ${cursor.versao}` : Prisma.empty;
      const usuarioAtual = await tx.usuario.findUniqueOrThrow({ where: { id: usuario.id }, select: { papeis: true } });
      const podeDecidirGeral = usuarioAtual.papeis.some((papel) => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR);
      const estado = contextoVigente ? await estadoSegundaChamadaTx(tx, contexto.alocacaoId, contexto.codigoAvaliacao) : null;
      const aplicada = await tx.$queryRaw<{ existe: boolean }[]>(Prisma.sql`
        SELECT EXISTS(
          SELECT 1 FROM "DecisaoAgendaSegundaChamada" d
          WHERE d.aprovada AND d."propostaId" IN (
            SELECT id FROM "PropostaAgendaSegundaChamada" WHERE "propostaSegundaChamadaId"=${contexto.id}
          )
        ) AS existe
      `);
      const professores = await tx.usuario.findMany({
        where: { ativo: true, papeis: { has: Papel.PROFESSOR } },
        select: { id: true, nome: true }, orderBy: [{ nome: "asc" }, { id: "asc" }], take: 50,
      });
      const itens = await tx.$queryRaw<{
        id: string; autorId: string; autorNome: string; entradaHash: string; versao: number; professorNome: string; inicio: Date; fim: Date; fusoOrigem: string; motivo: string; evidencia: string;
        motivoExcecaoNaoLetiva: string | null; criadaEm: Date; calendarioId: string | null; calendarioVersao: number | null; fusoInstitucional: string | null;
        periodosNaoLetivos: Prisma.JsonValue | null; calendarioPeriodos: Prisma.JsonValue | null; decisaoId: string | null; aprovada: boolean | null; motivoDecisao: string | null; decisorNome: string | null; autorizarDiaNaoLetivo: boolean | null;
        encontroId: string | null; reservaId: string | null; agendaId: string | null;
      }[]>(Prisma.sql`
        SELECT p.id,p."autorId" AS "autorId",autor.nome AS "autorNome",p."entradaHash" AS "entradaHash",p.versao,professor.nome AS "professorNome",p.inicio,p.fim,p."fusoOrigem" AS "fusoOrigem",p.motivo,p.evidencia,p."motivoExcecaoNaoLetiva" AS "motivoExcecaoNaoLetiva",p."criadaEm" AS "criadaEm",
          p."calendarioId" AS "calendarioId",p."calendarioVersao" AS "calendarioVersao",p."fusoInstitucional" AS "fusoInstitucional",p."periodosNaoLetivos" AS "periodosNaoLetivos",calendario.periodos AS "calendarioPeriodos",
          decisao.id AS "decisaoId",decisao.aprovada,decisao.motivo AS "motivoDecisao",decisor.nome AS "decisorNome",decisao."autorizarDiaNaoLetivo" AS "autorizarDiaNaoLetivo",decisao."encontroId" AS "encontroId",aplicacao."reservaId" AS "reservaId",aplicacao."agendaId" AS "agendaId"
        FROM "PropostaAgendaSegundaChamada" p JOIN "Usuario" professor ON professor.id=p."professorId" JOIN "Usuario" autor ON autor.id=p."autorId"
          LEFT JOIN "DecisaoAgendaSegundaChamada" decisao ON decisao."propostaId"=p.id LEFT JOIN "Usuario" decisor ON decisor.id=decisao."decisorId"
          LEFT JOIN "AplicacaoAgendaSegundaChamada" aplicacao ON aplicacao."decisaoId"=decisao.id
          LEFT JOIN "VersaoCalendarioEscolar" calendario ON calendario.id=p."calendarioId"
        WHERE p."propostaSegundaChamadaId"=${contexto.id} ${depois}
        ORDER BY p.versao DESC,p.id DESC LIMIT 21
      `);
      const pagina = itens.slice(0, 20);
      return { propostaSegundaChamadaId: contexto.id, identificacao: await identificarMatriculaAvaliacao(tx, contexto.matriculaId, contexto.turmaId), professores,
        contextoVigente,
        podePropor: contextoVigente && !!estado?.pendente && estado.saldo > 0 && !aplicada[0]?.existe,
        proximoId: itens.length > 20 ? pagina.at(-1)!.id : null,
        itens: pagina.map((item) => {
          const calendario = item.calendarioId && item.calendarioVersao !== null && item.fusoInstitucional && item.periodosNaoLetivos
            ? referenciaCalendarioSchema.parse({ calendarioId: item.calendarioId, calendarioVersao: item.calendarioVersao, fusoInstitucional: item.fusoInstitucional, periodosNaoLetivos: item.periodosNaoLetivos }) : null;
          const periodos = calendario && item.calendarioPeriodos
            ? periodosLegiveisSchema.parse(item.calendarioPeriodos).filter((periodo) => calendario.periodosNaoLetivos.includes(periodo.id)).map(({ nome, inicio, fim }) => ({ nome, inicio, fim })) : [];
          return { id: item.id, versao: item.versao, autorNome: item.autorNome, professorNome: item.professorNome, inicio: item.inicio.toISOString(), fim: item.fim.toISOString(), fusoOrigem: item.fusoOrigem, motivo: item.motivo, evidencia: item.evidencia, motivoExcecaoNaoLetiva: item.motivoExcecaoNaoLetiva, criadaEm: item.criadaEm.toISOString(),
            calendario: calendario ? { versao: calendario.calendarioVersao, fusoInstitucional: calendario.fusoInstitucional, periodos } : null,
            entradaHash: podeDecidirGeral && !item.decisaoId && item.autorId !== usuario.id ? item.entradaHash : null,
            podeDecidir: podeDecidirGeral && !item.decisaoId && item.autorId !== usuario.id,
            podeAprovar: contextoVigente && podeDecidirGeral && !item.decisaoId && item.autorId !== usuario.id,
            impedimentoAprovacao: contextoVigente ? null : "O contexto da segunda chamada mudou; esta proposta pode ser rejeitada, mas não aprovada.",
          decisao: item.decisaoId ? { aprovada: item.aprovada!, motivo: item.motivoDecisao ?? "", decisorNome: item.decisorNome ?? "", autorizarDiaNaoLetivo: item.autorizarDiaNaoLetivo!, encontroId: item.encontroId, reservaId: item.reservaId, agendaId: item.agendaId } : null,
          };
        }) };
    });
  });
}
