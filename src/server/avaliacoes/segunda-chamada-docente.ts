"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { carregarSituacoesNaAula } from "@/server/diario/historico-contratual";
import { autorizacaoEspecialSegundaChamadaVigente } from "./segunda-chamada-autorizacao-especial";
import { instanteUtcSql } from "./segunda-chamada-utc";

const id = z.string().min(1).max(100);
const filaSchema = z.object({ depoisId: id.optional() }).strict();
const detalheSchema = z.object({ reservaId: id }).strict();

type ReservaDocente = {
  reservaId: string; propostaId: string; matriculaId: string; turmaId: string; alocacaoId: string; codigoAvaliacao: string; status: string;
  aluno: string; matriculaCodigo: string | null; turma: string; inicio: Date; fim: Date; fusoOrigem: string; encontroStatus: string; encontroProfessorId: string | null;
  realizacaoId: string | null; realizadaEm: Date | null; realizadorId: string | null; realizadorNome: string | null; lancamentoId: string | null; versaoNota: number | null; submetida: boolean | null; oficial: boolean | null; rejeitada: boolean | null; motivoDecisao: string | null;
  regraConteudo?: unknown;
};

const escopoDocente = (professorId: string) => Prisma.sql`
  ((e."professorId"=${professorId} AND (
    (t."professorId"=${professorId} AND t.status<>'CONCLUIDA' AND EXISTS (
      SELECT 1 FROM "VinculoDocente" vd WHERE vd."turmaId"=t.id AND vd."professorId"=${professorId}
        AND vd.inicio<=(clock_timestamp() AT TIME ZONE 'UTC') AND vd.fim IS NULL
    ))
    OR COALESCE(professor_segunda_chamada_no_instante(p.id,(clock_timestamp() AT TIME ZONE 'UTC')),'')=${professorId}
  )) OR (realizada.id IS NOT NULL AND EXISTS (SELECT 1 FROM "RegistroAvaliacaoMatricula" registro JOIN "DesignacaoAvaliacao" designacao ON designacao."registroId"=registro.id WHERE registro."matriculaId"=p."matriculaId" AND registro."alocacaoId"=p."alocacaoId" AND registro."turmaId"=p."turmaId" AND registro."regraId"=p."regraId" AND registro."codigoAvaliacao"=r."codigoAvaliacao" AND designacao."professorId"=${professorId} AND NOT EXISTS (SELECT 1 FROM "DesignacaoAvaliacao" nova WHERE nova."registroId"=registro.id AND nova.versao>designacao.versao))))`;

async function exigirProfessorAtivo(tx: Prisma.TransactionClient, professorId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${professorId} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id: professorId }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.includes(Papel.PROFESSOR)) throw new ErroPermissao();
}

function estadoNota(r: ReservaDocente) {
  if (!r.lancamentoId) return null;
  return { id: r.lancamentoId, versao: r.versaoNota!, motivoDecisao: r.motivoDecisao, status: r.oficial ? "OFICIALIZADA" : r.rejeitada ? "REJEITADA" : r.submetida ? "SUBMETIDA" : "RASCUNHO" } as const;
}

async function podeRealizarTx(tx: Prisma.TransactionClient, r: ReservaDocente, professorId: string) {
  const agora = new Date();
  return !r.realizacaoId && r.status === "RESERVADA" && r.encontroStatus === "PREVISTO" && r.encontroProfessorId === professorId && agora >= r.inicio;
}

async function podeLancarNotaTx(tx: Prisma.TransactionClient, r: ReservaDocente, professorId: string) {
  if (!r.realizacaoId || !r.realizadaEm || r.status !== "CONSUMIDA_REALIZACAO" || (r.lancamentoId && !r.rejeitada) || !r.realizadorId) return false;
  const [historico] = await tx.$queryRaw<{ professorId: string | null }[]>`SELECT professor_segunda_chamada_no_instante(${r.propostaId},${instanteUtcSql(r.realizadaEm)}) AS "professorId"`;
  let atribuicaoHistorica = historico?.professorId === r.realizadorId || !!await tx.vinculoDocente.findFirst({ where: { turmaId: r.turmaId, professorId: r.realizadorId, inicio: { lte: r.realizadaEm }, OR: [{ fim: null }, { fim: { gt: r.realizadaEm } }] }, select: { professorId: true } });
  if (!atribuicaoHistorica) {
    const [designacaoAvaliacao] = await tx.$queryRaw<{ id: string }[]>`SELECT designacao.id FROM "RegistroAvaliacaoMatricula" registro JOIN "DesignacaoAvaliacao" designacao ON designacao."registroId"=registro.id WHERE registro."matriculaId"=${r.matriculaId} AND registro."alocacaoId"=${r.alocacaoId} AND registro."turmaId"=${r.turmaId} AND registro."regraId"=(SELECT "regraId" FROM "PropostaSegundaChamada" WHERE id=${r.propostaId}) AND registro."codigoAvaliacao"=${r.codigoAvaliacao} AND designacao."professorId"=${r.realizadorId} AND designacao."criadaEm"<=${instanteUtcSql(r.realizadaEm)} AND NOT EXISTS (SELECT 1 FROM "DesignacaoAvaliacao" nova WHERE nova."registroId"=registro.id AND nova."criadaEm"<=${instanteUtcSql(r.realizadaEm)} AND nova.versao>designacao.versao) FOR SHARE`;
    atribuicaoHistorica = !!designacaoAvaliacao;
  }
  if (!atribuicaoHistorica) return false;
  if (r.realizadorId !== professorId) {
    const [regularizador] = await tx.$queryRaw<{ id: string }[]>`SELECT designacao.id FROM "RegistroAvaliacaoMatricula" registro JOIN "DesignacaoAvaliacao" designacao ON designacao."registroId"=registro.id WHERE registro."matriculaId"=${r.matriculaId} AND registro."alocacaoId"=${r.alocacaoId} AND registro."turmaId"=${r.turmaId} AND registro."regraId"=(SELECT "regraId" FROM "PropostaSegundaChamada" WHERE id=${r.propostaId}) AND registro."codigoAvaliacao"=${r.codigoAvaliacao} AND designacao."professorId"=${professorId} AND NOT EXISTS (SELECT 1 FROM "DesignacaoAvaliacao" nova WHERE nova."registroId"=registro.id AND nova.versao>designacao.versao) FOR SHARE`;
    if (!regularizador) return false;
  }
  const situacao = (await carregarSituacoesNaAula(tx, [r.matriculaId], r.realizadaEm)).get(r.matriculaId);
  return situacao === "ATIVA" || ((situacao === "PAUSADA" || situacao === "ENCERRADA") && await autorizacaoEspecialSegundaChamadaVigente(tx, r.alocacaoId, r.codigoAvaliacao, r.realizadaEm));
}

const selecionarReserva = Prisma.sql`
  SELECT r.id AS "reservaId",p.id AS "propostaId",p."matriculaId" AS "matriculaId",p."alocacaoId" AS "alocacaoId",p."turmaId" AS "turmaId",r."codigoAvaliacao" AS "codigoAvaliacao",r.status,
    aluno."primeiroNome"||CASE WHEN aluno.sobrenome IS NULL THEN '' ELSE ' '||aluno.sobrenome END AS aluno,m.codigo AS "matriculaCodigo",COALESCE(t.nome,t.codigo,'Turma sem identificação') AS turma,
    e.inicio,e.fim,e."fusoOrigem",e.status AS "encontroStatus",e."professorId" AS "encontroProfessorId",realizada.id AS "realizacaoId",realizada."realizadaEm" AS "realizadaEm",realizada."professorId" AS "realizadorId",realizador.nome AS "realizadorNome",
    lancamento.id AS "lancamentoId",lancamento.versao AS "versaoNota",lancamento.submetida,lancamento.oficial,lancamento.rejeitada,lancamento."motivoDecisao" AS "motivoDecisao",regra.conteudo AS "regraConteudo"
  FROM "ReservaSegundaChamada" r JOIN "PropostaSegundaChamada" p ON p.id=r."propostaId" JOIN "Matricula" m ON m.id=p."matriculaId" JOIN "Aluno" aluno ON aluno.id=m."alunoId"
  JOIN "Turma" t ON t.id=p."turmaId" JOIN "VersaoRegraAvaliacao" regra ON regra.id=p."regraId" JOIN "AgendaSegundaChamada" agenda ON agenda."reservaId"=r.id JOIN "EncontroAgenda" e ON e.id=agenda."encontroId"
  LEFT JOIN "RealizacaoSegundaChamada" realizada ON realizada."reservaId"=r.id LEFT JOIN "Usuario" realizador ON realizador.id=realizada."professorId"
  LEFT JOIN LATERAL (SELECT l.id,l.versao,l.submetida,d.aprovada AS oficial,COALESCE(d.aprovada=false,false) AS rejeitada,d.motivo AS "motivoDecisao"
    FROM "VersaoLancamentoAvaliacao" l LEFT JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId"=l.id
    WHERE l."segundaChamadaRealizacaoId"=realizada.id ORDER BY l.versao DESC LIMIT 1) lancamento ON true`;

export async function listarSegundasChamadasDocente(input: { depoisId?: string } = {}) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR), d = filaSchema.parse(input);
    return prisma.$transaction(async tx => {
      await exigirProfessorAtivo(tx, u.id);
      const reservas = await tx.$queryRaw<ReservaDocente[]>(Prisma.sql`${selecionarReserva} WHERE ${escopoDocente(u.id)} AND r.id>${d.depoisId ?? ""} ORDER BY r.id ASC LIMIT 21`);
      const itens = await Promise.all(reservas.slice(0,20).map(async r => ({ reservaId: r.reservaId, codigoAvaliacao: r.codigoAvaliacao, inicio: r.inicio.toISOString(), fim: r.fim.toISOString(), fusoOrigem: r.fusoOrigem, status: r.status,
        aluno: r.aluno, matriculaCodigo: r.matriculaCodigo, turma: r.turma, realizacao: r.realizacaoId && r.realizadaEm ? { id: r.realizacaoId, realizadaEm: r.realizadaEm.toISOString() } : null,
        podeRealizar: await podeRealizarTx(tx, r, u.id) })));
      return { itens, proximoId: reservas.length > 20 ? reservas[19].reservaId : null };
    });
  });
}

export async function consultarSegundaChamadaDocente(input: { reservaId: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR), d = detalheSchema.parse(input);
    return prisma.$transaction(async tx => {
      await exigirProfessorAtivo(tx, u.id);
      const [r] = await tx.$queryRaw<ReservaDocente[]>(Prisma.sql`${selecionarReserva} WHERE r.id=${d.reservaId} AND ${escopoDocente(u.id)} FOR SHARE OF r,p,e`);
      if (!r) throw new ErroRegra("Reserva de segunda chamada não encontrada ou não atribuída a você.");
      const regra = ConteudoRegraAvaliacaoSchema.parse(r.regraConteudo);
      const avaliacao = regra.avaliacoes.find(a => a.codigo === r.codigoAvaliacao);
      if (!avaliacao) throw new ErroRegra("Avaliação da segunda chamada não pertence à regra vigente.");
      return { reservaId: r.reservaId, alocacaoId: r.alocacaoId, identificacao: await identificarMatriculaAvaliacao(tx, r.matriculaId, r.turmaId), codigoAvaliacao: r.codigoAvaliacao,
        horario: { inicio: r.inicio.toISOString(), fim: r.fim.toISOString(), fusoOrigem: r.fusoOrigem }, status: r.status,
        realizacao: r.realizacaoId && r.realizadaEm ? { id: r.realizacaoId, realizadaEm: r.realizadaEm.toISOString() } : null, realizador: r.realizadorId ? { nome: r.realizadorNome ?? "Professor não identificado" } : null,
        regularizacao: !!r.realizacaoId && r.realizadorId !== u.id, notaOriginal: estadoNota(r), escala: regra.escala,
        habilidadesNecessarias: avaliacao.habilidades, versaoEsperada: r.versaoNota ?? 0, podeRealizar: await podeRealizarTx(tx, r, u.id), podeLancarNota: await podeLancarNotaTx(tx, r, u.id) };
    });
  });
}
