"use server";
import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento, salvarLancamentoTx } from "./lancamento-tx";
import { SalvarLancamentoSchema } from "./lancamento-schema";
import { docenteAtual, vinculoCobre } from "@/server/diario/permissoes";
import { carregarSituacoesNaAula } from "@/server/diario/historico-contratual";
import { autorizacaoEspecialSegundaChamadaVigente } from "./segunda-chamada-autorizacao-especial";
import { instanteUtcSql } from "./segunda-chamada-utc";

const realizarSchema = z.object({ reservaId: z.string().min(1).max(100), realizadaEm: z.string().datetime({ offset: true }), evidencia: z.string().trim().min(5).max(4000) }).strict();
const notaSchema = z.object({ realizacaoId: z.string().min(1).max(100), lancamento: SalvarLancamentoSchema }).strict();

/** Q146/Q148: registra fato realizado e consome sem lançar zero; a nota é uma versão normal da avaliação original. */
export async function registrarRealizacaoSegundaChamada(input: z.input<typeof realizarSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR), d = realizarSchema.parse(input);
    return prisma.$transaction(async tx => {
      const [r] = await tx.$queryRaw<{ id: string; propostaId: string; matriculaId: string; alocacaoId: string; codigoAvaliacao: string; status: string; reservadaEm: Date; encontroStatus: string | null; inicio: Date | null; fim: Date | null; encontroProfessorId: string | null; realizacaoId: string | null }[]>(Prisma.sql`
        SELECT r.id,r."propostaId" AS "propostaId",r."matriculaId" AS "matriculaId",p."alocacaoId" AS "alocacaoId",p."codigoAvaliacao" AS "codigoAvaliacao",r.status,r."reservadaEm" AS "reservadaEm",e.status AS "encontroStatus",e.inicio,e.fim,e."professorId" AS "encontroProfessorId",sc.id AS "realizacaoId"
        FROM "ReservaSegundaChamada" r JOIN "PropostaSegundaChamada" p ON p.id=r."propostaId" LEFT JOIN "AgendaSegundaChamada" a ON a."reservaId"=r.id LEFT JOIN "EncontroAgenda" e ON e.id=a."encontroId" LEFT JOIN "RealizacaoSegundaChamada" sc ON sc."reservaId"=r.id WHERE r.id=${d.reservaId} FOR UPDATE OF r
      `);
      if (!r) throw new ErroRegra("Reserva de segunda chamada não encontrada.");
      const a = await bloquearLancamento(tx, r.alocacaoId);
      const turma = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { vinculosDocentes: true } });
      const [designacao] = await tx.$queryRaw<{ professorId: string | null }[]>(Prisma.sql`SELECT professor_segunda_chamada_no_instante(${r.propostaId},(clock_timestamp() AT TIME ZONE 'UTC')) AS "professorId"`);
      if ((!docenteAtual(u.id, turma) && designacao?.professorId !== u.id) || r.encontroProfessorId !== u.id) throw new ErroPermissao("Professor sem atribuição vigente ou designação limitada para o encontro de segunda chamada.");
      const quando = new Date(d.realizadaEm);
      if (r.realizacaoId) {
        const anterior = await tx.realizacaoSegundaChamada.findUniqueOrThrow({ where: { id: r.realizacaoId }, select: { id: true, realizadaEm: true, evidencia: true, professorId: true } });
        if (anterior.professorId === u.id && anterior.realizadaEm.getTime() === quando.getTime() && anterior.evidencia === d.evidencia) return { id: anterior.id };
        throw new ErroRegra("A realização já foi registrada; use a nota ou correção normal.");
      }
      if (r.status !== "RESERVADA" || r.encontroStatus !== "PREVISTO" || quando < r.reservadaEm || !r.inicio || !r.fim || quando < r.inicio || quando >= r.fim || quando > new Date()) throw new ErroRegra("A realização deve ocorrer no encontro reservado e já iniciado.");
      const [historica] = await tx.$queryRaw<{ professorId: string | null }[]>`SELECT professor_segunda_chamada_no_instante(${r.propostaId},${instanteUtcSql(quando)}) AS "professorId"`;
      if (!turma.vinculosDocentes.some(v => v.professorId === u.id && vinculoCobre(v, quando)) && historica?.professorId !== u.id) throw new ErroPermissao("A realização exige atribuição docente também na data informada.");
      const situacao = (await carregarSituacoesNaAula(tx, [a.matriculaId], quando)).get(a.matriculaId);
      if (situacao !== "ATIVA" && (!(situacao === "PAUSADA" || situacao === "ENCERRADA") || !await autorizacaoEspecialSegundaChamadaVigente(tx, a.id, r.codigoAvaliacao, quando))) throw new ErroRegra("A realização exige situação contratual comprovada e, durante pausa ou encerramento, autorização já vigente na data.");
      if (await tx.indisponibilidadeDocente.findFirst({ where: { professorId: u.id, decisao: { aprovada: true }, inicio: { lte: quando }, fim: { gt: quando } }, select: { id: true } })) throw new ErroRegra("Não registre realização durante indisponibilidade docente.");
      const realizacaoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`UPDATE "ReservaSegundaChamada" SET status='CONSUMIDA_REALIZACAO' WHERE id=${r.id}`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "RealizacaoSegundaChamada" (id,"reservaId","professorId","registradaPorId","realizadaEm",evidencia) VALUES (${realizacaoId},${r.id},${u.id},${u.id},${instanteUtcSql(quando)},${d.evidencia})`);
      await registrarEvento(tx, { tipo: "SegundaChamadaRealizada", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: u.id, payload: { reservaId: r.id, realizacaoId, realizadaEm: quando.toISOString() } });
      return { id: realizacaoId };
    });
  });
}

/** A versão submetida é a nota original e ainda exige oficialização independente Q142. */
export async function salvarNotaOriginalSegundaChamada(input: z.input<typeof notaSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR), d = notaSchema.parse(input);
    return prisma.$transaction(async tx => {
      const [r] = await tx.$queryRaw<{ id: string; alocacaoId: string; matriculaId: string; turmaId: string; regraId: string; codigoAvaliacao: string; professorId: string; realizadaEm: Date; lancamentoOriginalId: string | null; rejeitada: boolean | null; oficial: boolean | null }[]>(Prisma.sql`
        SELECT s.id,p."alocacaoId" AS "alocacaoId",p."matriculaId" AS "matriculaId",p."turmaId" AS "turmaId",p."regraId" AS "regraId",p."codigoAvaliacao" AS "codigoAvaliacao",s."professorId" AS "professorId",s."realizadaEm" AS "realizadaEm",v.id AS "lancamentoOriginalId",v.rejeitada,v.oficial
        FROM "RealizacaoSegundaChamada" s JOIN "ReservaSegundaChamada" r ON r.id=s."reservaId" JOIN "PropostaSegundaChamada" p ON p.id=r."propostaId"
        LEFT JOIN LATERAL (SELECT l.id,d.aprovada AS oficial,COALESCE(d.aprovada=false,false) AS rejeitada FROM "VersaoLancamentoAvaliacao" l LEFT JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId"=l.id WHERE l."segundaChamadaRealizacaoId"=s.id ORDER BY l.versao DESC LIMIT 1) v ON true
        WHERE s.id=${d.realizacaoId} FOR UPDATE OF s
      `);
      if (!r) throw new ErroRegra("Realização de segunda chamada não encontrada.");
      if (r.professorId !== u.id) {
        const [designacao] = await tx.$queryRaw<{ professorId: string | null }[]>(Prisma.sql`SELECT d."professorId" AS "professorId" FROM "RegistroAvaliacaoMatricula" registro JOIN LATERAL (SELECT "professorId" FROM "DesignacaoAvaliacao" WHERE "registroId"=registro.id ORDER BY versao DESC LIMIT 1) d ON true WHERE registro."matriculaId"=${r.matriculaId} AND registro."alocacaoId"=${r.alocacaoId} AND registro."turmaId"=${r.turmaId} AND registro."regraId"=${r.regraId} AND registro."codigoAvaliacao"=${r.codigoAvaliacao} FOR SHARE OF registro`);
        if (designacao?.professorId !== u.id || !d.lancamento.motivoRegularizacao || !d.lancamento.evidenciasRegularizacao) throw new ErroPermissao("Regularização exige designação vigente, motivo e evidências para esta avaliação.");
      }
      if (d.lancamento.alocacaoId !== r.alocacaoId || d.lancamento.codigoAvaliacao !== r.codigoAvaliacao || !d.lancamento.submetida || new Date(d.lancamento.realizadaEm).getTime() !== r.realizadaEm.getTime() || (d.lancamento.realizadaPorId && d.lancamento.realizadaPorId !== r.professorId)) throw new ErroRegra("Submeta a nota original exata, realizada pela mesma pessoa e vinculada à realização.");
      const repetida = await tx.versaoLancamentoAvaliacao.findUnique({ where: { autorId_chaveIdempotencia: { autorId: u.id, chaveIdempotencia: d.lancamento.chaveIdempotencia } }, select: { id: true } });
      if (r.lancamentoOriginalId && !r.rejeitada && !repetida) throw new ErroRegra(r.oficial ? "Nova versão exige devolução; nota oficial usa correção." : "A nota original aguarda decisão; reenvie somente a mesma chave ou aguarde rejeição.");
      const lancamento = await salvarLancamentoTx(tx, u.id, { ...d.lancamento, realizadaEm: r.realizadaEm.toISOString(), realizadaPorId: r.professorId }, { segundaChamada: { realizacaoId: r.id, realizadaEm: r.realizadaEm, realizadaPorId: r.professorId } });
      if (!repetida) await registrarEvento(tx, { tipo: "NotaOriginalSegundaChamadaSubmetida", agregadoTipo: "Matricula", agregadoId: (await tx.alocacaoTurma.findUniqueOrThrow({ where: { id: r.alocacaoId }, select: { matriculaId: true } })).matriculaId!, autorId: u.id, payload: { realizacaoId: r.id, lancamentoId: lancamento.id } });
      return lancamento;
    });
  });
}





