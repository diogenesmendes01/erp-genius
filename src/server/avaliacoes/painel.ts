"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";
import { escopoTurmasDocente } from "@/server/diario/permissoes";

export async function listarVinculosAvaliacoes(input: { modo?: "atuais" | "historico" | "designadas"; pagina?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ modo: z.enum(["atuais", "historico", "designadas"]).default("atuais"), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const fresco = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      if (!fresco?.ativo) throw new ErroPermissao();
      const gestao = fresco.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      if (!gestao && !fresco.papeis.includes(Papel.PROFESSOR)) throw new ErroPermissao();
      const designadas = d.modo === "designadas" && fresco.papeis.includes(Papel.PROFESSOR)
        ? await tx.$queryRaw<{ id: string }[]>`SELECT a.id FROM "AlocacaoTurma" a WHERE a."matriculaId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "RegistroAvaliacaoMatricula" r JOIN "DesignacaoAvaliacao" d ON d."registroId" = r.id
            WHERE r."alocacaoId" = a.id AND d."professorId" = ${u.id}
            AND NOT EXISTS (SELECT 1 FROM "DesignacaoAvaliacao" nova WHERE nova."registroId" = r.id AND nova.versao > d.versao)
            AND NOT EXISTS (SELECT 1 FROM "VersaoLancamentoAvaliacao" v JOIN "DecisaoLancamentoAvaliacao" decisao ON decisao."lancamentoId" = v.id AND decisao.aprovada WHERE v."registroId" = r.id)
          ) ORDER BY a.id ASC OFFSET ${(d.pagina - 1) * 20} LIMIT 21`
        : [];
      const filtro: Prisma.AlocacaoTurmaWhereInput = d.modo === "designadas" ? { id: { in: designadas.map(a => a.id) } } : d.modo === "historico"
        ? { registrosAvaliacao: { some: gestao ? {} : { versoes: { some: { OR: [{ autorId: u.id }, { realizadaPorId: u.id }] } } } } }
        : { ativa: true, turma: gestao ? { status: { not: "CONCLUIDA" } } : escopoTurmasDocente(u.id) };
      const itens = await tx.alocacaoTurma.findMany({ where: { matriculaId: { not: null }, ...filtro }, orderBy: { id: "asc" }, skip: d.modo === "designadas" ? 0 : (d.pagina - 1) * 20, take: 21,
        select: { id: true, ativa: true, criadoEm: true, encerradaEm: true,
          aluno: { select: { primeiroNome: true, sobrenome: true } },
          matricula: { select: { codigo: true } },
          turma: { select: { nome: true, codigo: true, nivel: { select: { codigo: true, idioma: { select: { nome: true } } } } } },
        } });
      return { itens: itens.slice(0, 20), pagina: d.pagina, temProxima: itens.length > 20, modo: d.modo };
    });
  });
}
