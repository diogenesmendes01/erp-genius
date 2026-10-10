"use server";

import { Papel, Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { janelaDaPagina, PAGINA_MAXIMA, recorteDaPagina } from "@/lib/pagina-url";
import { ErroPermissao, executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { estadoSegundaChamadaTx } from "./segunda-chamada-tx";

const schema = z.object({
  pagina: z.number().int().min(1).max(PAGINA_MAXIMA).default(1),
}).strict();
const papeisFila: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR];

async function conferirFilaAgendaTx(tx: PrismaTypes.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.some((papel) => papeisFila.includes(papel))) {
    throw new ErroPermissao();
  }
}

/** Fila administrativa: sinaliza pendência e saldo atuais, mas a prévia continua obrigatória para agenda.
 * Paginada por número (E4), em ordem estável (criadaEm, id): ida e volta trazem as mesmas fontes. */
export async function listarSegundasChamadasSemAgenda(input: z.input<typeof schema> = {}) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const d = schema.parse(input), janela = janelaDaPagina(d.pagina, 20);
    return prisma.$transaction(async (tx) => {
      await conferirFilaAgendaTx(tx, usuario.id);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const fontes = await tx.$queryRaw<{
        propostaSegundaChamadaId: string; alocacaoId: string; matriculaId: string; turmaId: string; codigoAvaliacao: string;
        aluno: string; matriculaCodigo: string | null; turma: string | null; prazoAte: Date; criadaEm: Date; possuiReservaTerminal: boolean; possuiPendenciaEscola: boolean;
      }[]>(Prisma.sql`
        SELECT p.id AS "propostaSegundaChamadaId",p."alocacaoId" AS "alocacaoId",p."matriculaId" AS "matriculaId",p."turmaId" AS "turmaId",p."codigoAvaliacao" AS "codigoAvaliacao",
          COALESCE(NULLIF(aluno."nomePreferido",''),NULLIF(concat_ws(' ',aluno."primeiroNome",aluno.sobrenome),''),'Aluno sem nome informado') AS aluno,
          m.codigo AS "matriculaCodigo",COALESCE(t.nome,t.codigo,'Turma sem identificação') AS turma,
          COALESCE((SELECT prorrogacao."novoPrazo" FROM "PropostaProrrogacaoSegundaChamada" prorrogacao
            JOIN "DecisaoProrrogacaoSegundaChamada" decisaoProrrogacao ON decisaoProrrogacao."propostaId"=prorrogacao.id AND decisaoProrrogacao.aprovada
            WHERE prorrogacao."disponibilizacaoId"=disponibilizacao.id ORDER BY prorrogacao.versao DESC LIMIT 1),disponibilizacao."prazoAte") AS "prazoAte",p."criadaEm" AS "criadaEm",
          EXISTS(SELECT 1 FROM "ReservaSegundaChamada" anterior WHERE anterior."propostaId"=p.id AND anterior.status<>'RESERVADA') AS "possuiReservaTerminal",
          EXISTS(SELECT 1 FROM "ReservaSegundaChamada" anterior WHERE anterior."propostaId"=p.id AND anterior.status='PENDENCIA_ESCOLA') AS "possuiPendenciaEscola"
        FROM "PropostaSegundaChamada" p
        JOIN "DecisaoSegundaChamada" decisao ON decisao."propostaId"=p.id AND decisao.aprovada
        JOIN "DisponibilizacaoSegundaChamada" disponibilizacao ON disponibilizacao."propostaId"=p.id
        JOIN "Matricula" m ON m.id=p."matriculaId" JOIN "Aluno" aluno ON aluno.id=m."alunoId" JOIN "Turma" t ON t.id=p."turmaId"
        WHERE NOT EXISTS(SELECT 1 FROM "ReservaSegundaChamada" vigente WHERE vigente."propostaId"=p.id AND vigente.status='RESERVADA')
          AND NOT EXISTS(SELECT 1 FROM "ReservaSegundaChamada" realizada WHERE realizada."propostaId"=p.id AND realizada.status='CONSUMIDA_REALIZACAO')
        ORDER BY p."criadaEm" DESC,p.id DESC LIMIT ${janela.take} OFFSET ${janela.skip}
      `);
      const { registros: pagina, temProxima } = recorteDaPagina(fontes, 20);
      const itens = [];
      for (const fonte of pagina) {
        const estado = await estadoSegundaChamadaTx(tx, fonte.alocacaoId, fonte.codigoAvaliacao);
        itens.push({
          propostaSegundaChamadaId: fonte.propostaSegundaChamadaId,
          aluno: fonte.aluno,
          matriculaCodigo: fonte.matriculaCodigo,
          turma: fonte.turma ?? "Turma sem nome",
          codigoAvaliacao: fonte.codigoAvaliacao,
          prazoAte: fonte.prazoAte.toISOString(),
          situacao: {
            pendente: estado.pendente,
            saldo: estado.saldo,
            statusMatricula: estado.statusMatricula,
            alocacaoAtiva: estado.ativa,
            possuiReservaTerminal: fonte.possuiReservaTerminal,
            possuiPendenciaEscola: fonte.possuiPendenciaEscola,
            requerPrevia: true,
          },
        });
      }
      return { itens, pagina: d.pagina, temProxima };
    });
  });
}
