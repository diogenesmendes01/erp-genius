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
import { autorizacaoEspecialSegundaChamadaVigente } from "./segunda-chamada-autorizacao-especial";
import {
  canonicalizarSubstituicaoAgendaSegundaChamada,
  ConsultarSubstituicaoAgendaSegundaChamadaSchema,
  DecidirSubstituicaoAgendaSegundaChamadaSchema,
  hashSubstituicaoAgendaSegundaChamada,
  ProporSubstituicaoAgendaSegundaChamadaSchema,
} from "./segunda-chamada-substituicao-schema";
import { estadoSegundaChamadaTx } from "./segunda-chamada-tx";
import { instanteUtcSql } from "./segunda-chamada-utc";

const preparadores: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR];
const estadoSchema = z.object({
  reserva: z.object({ id: z.string(), propostaId: z.string(), matriculaId: z.string(), regraId: z.string(), codigoAvaliacao: z.string(), status: z.string() }).passthrough(),
  agenda: z.object({ id: z.string(), encontroId: z.string() }).passthrough().nullable(),
  encontro: z.object({ id: z.string(), finalidade: z.string(), status: z.string(), matriculaId: z.string().nullable(), turmaId: z.string().nullable(), professorId: z.string().nullable(), inicio: z.string(), fim: z.string(), fusoOrigem: z.string() }).passthrough().nullable(),
  fatos: z.object({ ocorrencia: z.unknown().nullable(), realizacao: z.unknown().nullable() }).passthrough(),
  fonte: z.object({ propostaSegundaChamadaId: z.string(), alocacaoId: z.string(), turmaId: z.string(), regraId: z.string(), codigoAvaliacao: z.string(), disponibilizacaoId: z.string().nullable(), prazoAte: z.string().nullable(), matriculaStatus: z.string(), situacaoMatricula: z.string(), alocacaoAtiva: z.boolean() }).passthrough().nullable(),
  designacaoAtual: z.unknown().nullable(),
  substitutoId: z.string().nullable(),
  calendarioFonte: z.unknown().nullable(),
  calendarioAtual: z.unknown().nullable(),
}).passthrough();
type Estado = z.infer<typeof estadoSchema>;

type ReservaBloqueada = { reservaId: string; matriculaId: string; alocacaoId: string; turmaId: string };

function jsonEstavel(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonEstavel).join(",")}]`;
  if (valor && typeof valor === "object") return `{${Object.entries(valor as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${jsonEstavel(v)}`).join(",")}}`;
  return JSON.stringify(valor);
}
const hashEstado = (estado: unknown) => createHash("sha256").update(jsonEstavel(estado)).digest("hex");
/** JSON de `timestamp without time zone` do PostgreSQL representa UTC neste domínio. */
function dataUtc(valor: string) {
  const data = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(valor) ? valor : `${valor}Z`);
  if (Number.isNaN(data.getTime())) throw new ErroRegra("Instante da agenda inválido.");
  return data;
}
const isoUtc = (valor: string) => dataUtc(valor).toISOString();

async function conferirPreparadorTx(tx: PrismaTypes.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.some((papel) => preparadores.includes(papel))) throw new ErroPermissao();
}

/** A reserva é sempre o primeiro bloqueio específico da troca. */
async function bloquearReservaTx(tx: PrismaTypes.TransactionClient, reservaId: string, conferirContexto = true): Promise<ReservaBloqueada> {
  const [reserva] = await tx.$queryRaw<ReservaBloqueada[]>(Prisma.sql`
    SELECT r.id AS "reservaId",r."matriculaId" AS "matriculaId",p."alocacaoId" AS "alocacaoId",p."turmaId" AS "turmaId"
    FROM "ReservaSegundaChamada" r JOIN "PropostaSegundaChamada" p ON p.id=r."propostaId"
    WHERE r.id=${reservaId} FOR UPDATE OF r
  `);
  if (!reserva) throw new ErroRegra("Reserva de segunda chamada não encontrada.");
  if (!conferirContexto) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
    return reserva;
  }
  // Ordem global: reserva, calendário, fonte. `bloquearLancamento` toma o bloqueio de calendário e fixa a fonte.
  const alocacao = await bloquearLancamento(tx, reserva.alocacaoId);
  if (alocacao.matriculaId !== reserva.matriculaId || alocacao.turmaId !== reserva.turmaId) {
    throw new ErroRegra("O vínculo da segunda chamada mudou. Atualize a conferência.");
  }
  return reserva;
}

async function estadoSubstituicaoTx(tx: PrismaTypes.TransactionClient, reservaId: string, substitutoId?: string) {
  const [linha] = await tx.$queryRaw<{ estado: unknown }[]>(Prisma.sql`
    SELECT estado_substituicao_agenda_segunda_chamada(${reservaId},${substitutoId ?? null}::text) AS estado
  `);
  if (!linha?.estado) throw new ErroRegra("Estado da agenda de segunda chamada não encontrado.");
  return estadoSchema.parse(linha.estado);
}

async function contextoSubstituicaoVigenteTx(tx: PrismaTypes.TransactionClient, reserva: ReservaBloqueada) {
  const [atual] = await tx.$queryRaw<{ confere: boolean }[]>(Prisma.sql`
    SELECT EXISTS(SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id=a."turmaId"
      JOIN "ReservaSegundaChamada" r ON r.id=${reserva.reservaId}
      WHERE a.id=${reserva.alocacaoId} AND a."matriculaId"=${reserva.matriculaId}
        AND a."turmaId"=${reserva.turmaId} AND t."regraAvaliacaoId"=r."regraId") AS confere
  `);
  return atual?.confere === true;
}

async function contextoDepoisDoCalendarioTx(tx: PrismaTypes.TransactionClient, reserva: ReservaBloqueada, estado: Estado) {
  // A função de estado consulta o calendário; depois dela, o bloqueio da fonte fixa matrícula/turma/regra.
  const alocacao = await bloquearLancamento(tx, reserva.alocacaoId);
  const segunda = await estadoSegundaChamadaTx(tx, reserva.alocacaoId, estado.reserva.codigoAvaliacao);
  if (!estado.fonte || alocacao.matriculaId !== reserva.matriculaId || alocacao.turmaId !== reserva.turmaId
    || segunda.matriculaId !== reserva.matriculaId || segunda.turmaId !== reserva.turmaId
    || segunda.regraId !== estado.reserva.regraId || segunda.codigoAvaliacao !== estado.reserva.codigoAvaliacao) {
    throw new ErroRegra("O vínculo da segunda chamada mudou. Atualize a conferência.");
  }
  return segunda;
}

function calendarioMantemCondicoesDoEncontro(estado: Estado) {
  const referencia = z.object({ calendarioId: z.string().min(1), fusoInstitucional: z.string().min(1), periodosNaoLetivos: z.array(z.string()) });
  const fonte = referencia.safeParse(estado.calendarioFonte), atual = referencia.safeParse(estado.calendarioAtual);
  return fonte.success && atual.success
    && fonte.data.fusoInstitucional === atual.data.fusoInstitucional
    && jsonEstavel(fonte.data.periodosNaoLetivos) === jsonEstavel(atual.data.periodosNaoLetivos);
}

function pendenciasBase(estado: Estado, segunda: Awaited<ReturnType<typeof estadoSegundaChamadaTx>>) {
  const pendencias: string[] = [];
  const encontro = estado.encontro;
  if (estado.reserva.status !== "RESERVADA") pendencias.push("A reserva não está mais vigente.");
  if (!estado.agenda || !encontro) pendencias.push("A reserva não possui agenda vinculada.");
  if (encontro?.finalidade !== "SEGUNDA_CHAMADA" || encontro.status !== "PREVISTO") pendencias.push("O encontro não está previsto para segunda chamada.");
  if (encontro && dataUtc(encontro.inicio) <= new Date()) pendencias.push("O encontro já iniciou ou não é futuro.");
  if (estado.fatos.ocorrencia || estado.fatos.realizacao) pendencias.push("A agenda já possui fato registrado.");
  if (!estado.fonte?.disponibilizacaoId || !estado.fonte.prazoAte || !encontro || dataUtc(encontro.fim) > dataUtc(estado.fonte.prazoAte)) pendencias.push("O prazo da segunda chamada não está vigente para todo o encontro.");
  if (!estado.fonte?.disponibilizacaoId || !segunda.pendente) pendencias.push("A avaliação não está disponível para segunda chamada.");
  if (!calendarioMantemCondicoesDoEncontro(estado)) pendencias.push("O calendário alterou as condições deste encontro. Confira a agenda pelo fluxo de remarcação antes da substituição.");
  return pendencias;
}

async function conferirPreviaTx(tx: PrismaTypes.TransactionClient, reserva: ReservaBloqueada, estado: Estado, substitutoId?: string) {
  const segunda = await contextoDepoisDoCalendarioTx(tx, reserva, estado);
  const pendencias = pendenciasBase(estado, segunda);
  const encontro = estado.encontro;
  if (encontro && estado.fonte) {
    const inicio = dataUtc(encontro.inicio);
    const fim = dataUtc(encontro.fim);
    const fimMenosUmMs = new Date(fim.getTime() - 1);
    const [situacao] = await tx.$queryRaw<{ inicio: string | null; fim: string | null }[]>(Prisma.sql`
      SELECT situacao_matricula_no_instante(${reserva.matriculaId},${instanteUtcSql(inicio)}) AS inicio,
        situacao_matricula_no_instante(${reserva.matriculaId},${instanteUtcSql(fimMenosUmMs)}) AS fim
    `);
    const conferirBorda = async (valor: string | null, quando: Date, nome: "início" | "fim") => {
      if (valor === "ATIVA" && estado.fonte?.alocacaoAtiva && segunda.ativa) return;
      if (["PAUSADA", "ENCERRADA"].includes(valor ?? "")
        && await autorizacaoEspecialSegundaChamadaVigente(tx, estado.fonte!.alocacaoId, estado.fonte!.codigoAvaliacao, quando)) return;
      pendencias.push(`A situação da matrícula no ${nome} do encontro não permite a substituição sem autorização especial vigente.`);
    };
    await conferirBorda(situacao?.inicio ?? null, inicio, "início");
    await conferirBorda(situacao?.fim ?? null, fimMenosUmMs, "fim");

    const [cobertura] = await tx.$queryRaw<{ cobre: boolean | null }[]>(Prisma.sql`
      SELECT situacao_autorizacao_segunda_chamada_cobre_intervalo(
        ${reserva.matriculaId},
        ${estado.fonte.alocacaoId},
        ${estado.fonte.codigoAvaliacao},
        ${instanteUtcSql(inicio)},
        ${instanteUtcSql(fim)}
      ) AS cobre
    `);
    if (
      cobertura?.cobre !== true &&
      !pendencias.some((pendencia) => pendencia.startsWith("A situação da matrícula no "))
    ) {
      pendencias.push(
        "Há transição contratual durante o encontro que exige autorização especial vigente.",
      );
    }
  }
  let substituto: { id: string; nome: string } | null = null;
  if (substitutoId && encontro) {
    const professor = await tx.usuario.findUnique({ where: { id: substitutoId }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!professor?.ativo || !professor.papeis.includes(Papel.PROFESSOR)) pendencias.push("O professor substituto precisa estar ativo.");
    else if (professor.id === encontro.professorId) pendencias.push("Escolha professor diferente do responsável atual.");
    else {
      substituto = { id: professor.id, nome: professor.nome };
      const disponibilidade = await disponibilidadeRecuperacaoTx(tx, {
        alunoId: reserva.matriculaId ? (await tx.matricula.findUniqueOrThrow({ where: { id: reserva.matriculaId }, select: { alunoId: true } })).alunoId : "",
        professorId: professor.id, inicio: dataUtc(encontro.inicio), fim: dataUtc(encontro.fim), ignorarEncontroId: encontro.id,
      });
      if (disponibilidade.encontros.length) pendencias.push("Há encontro conflitante para o aluno, turma ou professor no horário.");
      if (disponibilidade.indisponibilidades) pendencias.push("O professor possui indisponibilidade aprovada no horário.");
      if (disponibilidade.reservas) pendencias.push("Há reserva comercial conflitante no horário.");
    }
  }
  return { segunda, pendencias, substituto };
}

async function carregarPropostasTx(tx: PrismaTypes.TransactionClient, reservaId: string, antesVersao: number | undefined, usuarioId: string) {
  if (antesVersao) {
    const [cursor] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE "reservaId"=${reservaId} AND versao=${antesVersao}
    `);
    if (!cursor) throw new ErroRegra("Cursor de histórico não encontrado para esta reserva.");
  }
  const itens = await tx.$queryRaw<{ id: string; versao: number; autorId: string; autorNome: string; substitutoNome: string; professorAnteriorNome: string | null; motivo: string; evidencia: string; criadaEm: Date; entradaHash: string; inicioSnapshot: string | null; fimSnapshot: string | null; fusoSnapshot: string | null; decisaoId: string | null; aprovada: boolean | null; motivoDecisao: string | null; decisorNome: string | null; decididaEm: Date | null; aplicada: boolean }[]>(Prisma.sql`
    SELECT p.id,p.versao,p."autorId" AS "autorId",autor.nome AS "autorNome",substituto.nome AS "substitutoNome",anterior.nome AS "professorAnteriorNome",p.motivo,p.evidencia,p."criadaEm" AS "criadaEm",p."entradaHash" AS "entradaHash",p.snapshot->'encontro'->>'inicio' AS "inicioSnapshot",p.snapshot->'encontro'->>'fim' AS "fimSnapshot",p.snapshot->'encontro'->>'fusoOrigem' AS "fusoSnapshot",d.id AS "decisaoId",d.aprovada,d.motivo AS "motivoDecisao",decisor.nome AS "decisorNome",d."criadaEm" AS "decididaEm",(a.id IS NOT NULL) AS aplicada
    FROM "PropostaSubstituicaoAgendaSegundaChamada" p JOIN "Usuario" autor ON autor.id=p."autorId" JOIN "Usuario" substituto ON substituto.id=p."substitutoId"
    LEFT JOIN "Usuario" anterior ON anterior.id=p.snapshot->'encontro'->>'professorId'
    LEFT JOIN "DecisaoSubstituicaoAgendaSegundaChamada" d ON d."propostaId"=p.id LEFT JOIN "Usuario" decisor ON decisor.id=d."decisorId"
    LEFT JOIN "AplicacaoSubstituicaoAgendaSegundaChamada" a ON a."decisaoId"=d.id
    WHERE p."reservaId"=${reservaId} ${antesVersao ? Prisma.sql`AND p.versao < ${antesVersao}` : Prisma.empty}
    ORDER BY p.versao DESC,p.id DESC LIMIT 21
  `);
  const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { papeis: true } });
  const gestor = usuario.papeis.some((papel) => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR);
  const pagina = itens.slice(0, 20);
  return {
    itens: pagina.map((item) => ({ id: item.id, versao: item.versao, autorNome: item.autorNome, substitutoNome: item.substitutoNome, motivo: item.motivo, evidencia: item.evidencia, criadaEm: item.criadaEm.toISOString(),
      snapshot: { professorNome: item.professorAnteriorNome ?? "", inicio: item.inicioSnapshot ? isoUtc(item.inicioSnapshot) : "", fim: item.fimSnapshot ? isoUtc(item.fimSnapshot) : "", fusoOrigem: item.fusoSnapshot ?? "" },
      entradaHash: gestor && !item.decisaoId && item.autorId !== usuarioId ? item.entradaHash : null,
      podeDecidir: gestor && !item.decisaoId && item.autorId !== usuarioId,
      podeAprovar: gestor && !item.decisaoId && item.autorId !== usuarioId,
      impedimentoAprovacao: null,
      decisao: item.decisaoId ? { id: item.decisaoId, aprovada: item.aprovada!, motivo: item.motivoDecisao ?? "", decisorNome: item.decisorNome ?? "", decididaEm: item.decididaEm?.toISOString() ?? "", aplicada: item.aplicada } : null,
    })),
    proximaVersao: itens.length > 20 ? pagina.at(-1)!.versao : null,
  };
}

export async function consultarSubstituicaoAgendaSegundaChamada(input: z.input<typeof ConsultarSubstituicaoAgendaSegundaChamadaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(...preparadores);
    const d = ConsultarSubstituicaoAgendaSegundaChamadaSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await conferirPreparadorTx(tx, usuario.id);
      const reserva = await bloquearReservaTx(tx, d.reservaId, false);
      const contextoVigente = await contextoSubstituicaoVigenteTx(tx, reserva);
      const estado = await estadoSubstituicaoTx(tx, d.reservaId, d.substitutoId);
      const previa = contextoVigente
        ? await conferirPreviaTx(tx, reserva, estado, d.substitutoId)
        : { pendencias: ["O contexto da segunda chamada mudou; esta proposta pode ser rejeitada, mas não aprovada."], substituto: null };
      const professores = await tx.usuario.findMany({ where: { ativo: true, papeis: { has: Papel.PROFESSOR } }, select: { id: true, nome: true }, orderBy: [{ nome: "asc" }, { id: "asc" }] });
      const historico = await carregarPropostasTx(tx, d.reservaId, d.antesVersao, usuario.id);
      const encontro = estado.encontro;
      if (!encontro) throw new ErroRegra("A reserva não possui encontro de segunda chamada.");
      const atual = await tx.usuario.findUnique({ where: { id: encontro.professorId ?? "" }, select: { nome: true } });
      const podePropor = contextoVigente && previa.pendencias.length === 0;
      return {
        identificacao: { ...(await identificarMatriculaAvaliacao(tx, reserva.matriculaId, reserva.turmaId)), codigoAvaliacao: estado.reserva.codigoAvaliacao },
        encontro: { id: encontro.id, professorId: encontro.professorId, professorNome: atual?.nome ?? "", inicio: isoUtc(encontro.inicio), fim: isoUtc(encontro.fim), fusoOrigem: encontro.fusoOrigem, status: encontro.status },
        professores, contextoVigente, podePropor, podeDecidir: historico.itens.some((item) => item.podeDecidir),
        previa: d.substitutoId ? { estadoConferido: hashEstado(estado), pendencias: previa.pendencias, substituto: previa.substituto } : null,
        ...historico,
        itens: historico.itens.map((item) => ({
          ...item,
          podeAprovar: contextoVigente && item.podeDecidir,
          impedimentoAprovacao: contextoVigente ? null : "O contexto da segunda chamada mudou; esta proposta pode ser rejeitada, mas não aprovada.",
        })),
      };
    });
  });
}

export async function proporSubstituicaoAgendaSegundaChamada(input: z.input<typeof ProporSubstituicaoAgendaSegundaChamadaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(...preparadores);
    const entrada = canonicalizarSubstituicaoAgendaSegundaChamada(input);
    const entradaHash = hashSubstituicaoAgendaSegundaChamada(entrada);
    return prisma.$transaction(async (tx) => {
      await conferirPreparadorTx(tx, usuario.id);
      const reserva = await bloquearReservaTx(tx, entrada.reservaId);
      const [repetida] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`
        SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaSubstituicaoAgendaSegundaChamada"
        WHERE "autorId"=${usuario.id} AND "chaveIdempotencia"=${entrada.chaveIdempotencia} FOR SHARE
      `);
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada com outra proposta de substituição.");
        return { id: repetida.id, entradaHash };
      }
      const estado = await estadoSubstituicaoTx(tx, entrada.reservaId, entrada.substitutoId);
      const previa = await conferirPreviaTx(tx, reserva, estado, entrada.substitutoId);
      if (previa.pendencias.length) throw new ErroRegra(previa.pendencias[0]);
      if (hashEstado(estado) !== entrada.estadoConferido) throw new ErroRegra("A agenda mudou. Atualize a prévia antes de propor a substituição.");
      if (!previa.substituto || !estado.encontro) throw new ErroRegra("Informe professor ativo para a substituição.");
      const [ultima] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`SELECT versao FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE "reservaId"=${entrada.reservaId} ORDER BY versao DESC LIMIT 1 FOR UPDATE`);
      const propostaId = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "PropostaSubstituicaoAgendaSegundaChamada" (id,"reservaId","encontroId","autorId","substitutoId",versao,motivo,evidencia,snapshot,"entradaHash","chaveIdempotencia")
        VALUES (${propostaId},${entrada.reservaId},${estado.encontro.id},${usuario.id},${entrada.substitutoId},${(ultima?.versao ?? 0) + 1},${entrada.motivo},${entrada.evidencia},${JSON.stringify(estado)}::jsonb,${entradaHash},${entrada.chaveIdempotencia})
      `);
      await registrarEvento(tx, { tipo: "SubstituicaoAgendaSegundaChamadaProposta", agregadoTipo: "Matricula", agregadoId: reserva.matriculaId, autorId: usuario.id, payload: { propostaId, reservaId: entrada.reservaId, encontroId: estado.encontro.id, substitutoId: entrada.substitutoId } });
      return { id: propostaId, entradaHash };
    });
  });
}

export async function decidirSubstituicaoAgendaSegundaChamada(input: z.input<typeof DecidirSubstituicaoAgendaSegundaChamadaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const d = DecidirSubstituicaoAgendaSegundaChamadaSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      const [proposta] = await tx.$queryRaw<{ reservaId: string }[]>(Prisma.sql`
        SELECT "reservaId" AS "reservaId" FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE id=${d.propostaId}
      `);
      if (!proposta) throw new ErroRegra("Proposta de substituição não encontrada.");
      await conferirGestorAvaliacao(tx, usuario.id);
      const reservaHistorica = await bloquearReservaTx(tx, proposta.reservaId, false);
      const [replay] = await tx.$queryRaw<{
        autorId: string; entradaHash: string; decisaoId: string | null; decisorId: string | null; aprovada: boolean | null; motivo: string | null; aplicacaoId: string | null;
      }[]>(Prisma.sql`
        SELECT p."autorId" AS "autorId",p."entradaHash" AS "entradaHash",decisao.id AS "decisaoId",decisao."decisorId" AS "decisorId",decisao.aprovada,decisao.motivo,aplicacao.id AS "aplicacaoId"
        FROM "PropostaSubstituicaoAgendaSegundaChamada" p
        LEFT JOIN "DecisaoSubstituicaoAgendaSegundaChamada" decisao ON decisao."propostaId"=p.id
        LEFT JOIN "AplicacaoSubstituicaoAgendaSegundaChamada" aplicacao ON aplicacao."decisaoId"=decisao.id
        WHERE p.id=${d.propostaId}
      `);
      if (replay && replay.autorId !== usuario.id && replay.entradaHash === d.propostaHash && replay.decisaoId
        && replay.decisorId === usuario.id && replay.aprovada === d.aprovada && replay.motivo === d.motivo) {
        return { id: replay.decisaoId, aplicada: replay.aprovada && !!replay.aplicacaoId };
      }
      const reserva = d.aprovada
        ? await bloquearReservaTx(tx, proposta.reservaId)
        : reservaHistorica;
      const [p] = await tx.$queryRaw<{ id: string; reservaId: string; autorId: string; entradaHash: string; substitutoId: string; encontroId: string; snapshot: unknown; decisaoId: string | null; decisorId: string | null; aprovadaAnterior: boolean | null; motivoAnterior: string | null; aplicacaoId: string | null }[]>(Prisma.sql`
        SELECT p.id,p."reservaId" AS "reservaId",p."autorId" AS "autorId",p."entradaHash" AS "entradaHash",p."substitutoId" AS "substitutoId",p."encontroId" AS "encontroId",p.snapshot,
          decisao.id AS "decisaoId",decisao."decisorId" AS "decisorId",decisao.aprovada AS "aprovadaAnterior",decisao.motivo AS "motivoAnterior",aplicacao.id AS "aplicacaoId"
        FROM "PropostaSubstituicaoAgendaSegundaChamada" p
        LEFT JOIN "DecisaoSubstituicaoAgendaSegundaChamada" decisao ON decisao."propostaId"=p.id
        LEFT JOIN "AplicacaoSubstituicaoAgendaSegundaChamada" aplicacao ON aplicacao."decisaoId"=decisao.id
        WHERE p.id=${d.propostaId} FOR UPDATE OF p
      `);
      if (!p || p.autorId === usuario.id || p.entradaHash !== d.propostaHash) throw new ErroRegra("Confira uma proposta de outra pessoa antes de decidir.");
      if (p.decisaoId) {
        if (p.decisorId === usuario.id && p.aprovadaAnterior === d.aprovada && p.motivoAnterior === d.motivo) return { id: p.decisaoId, aplicada: p.aprovadaAnterior && !!p.aplicacaoId };
        throw new ErroRegra("A proposta já possui decisão.");
      }
      if (d.aprovada) {
        const estado = await estadoSubstituicaoTx(tx, p.reservaId, p.substitutoId);
        const previa = await conferirPreviaTx(tx, reserva, estado, p.substitutoId);
        if (previa.pendencias.length) throw new ErroRegra(previa.pendencias[0]);
        if (hashEstado(estado) !== hashEstado(p.snapshot) || estado.encontro?.id !== p.encontroId) {
          throw new ErroRegra("A agenda mudou. Refaça a conferência antes de aprovar.");
        }
      }
      const decisaoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "DecisaoSubstituicaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES (${decisaoId},${p.id},${usuario.id},${d.aprovada},${d.motivo})`);
      const aplicada = d.aprovada;
      await registrarEvento(tx, { tipo: d.aprovada ? "SubstituicaoAgendaSegundaChamadaAprovada" : "SubstituicaoAgendaSegundaChamadaRejeitada", agregadoTipo: "Matricula", agregadoId: reserva.matriculaId, autorId: usuario.id, payload: { propostaId: p.id, decisaoId, reservaId: p.reservaId, aplicada } });
      return { id: decisaoId, aplicada };
    });
  });
}
