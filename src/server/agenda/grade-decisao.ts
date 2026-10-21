"use server";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { carregarGradeInicialTx } from "./grade-turma-tx";
import { conferirDisponibilidadeGrade } from "./grade-disponibilidade";

export async function decidirGradeInicialTurma(input: { propostaId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => ["GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const p = await tx.propostaGradeTurma.findUnique({ where: { id: d.propostaId }, include: { decisao: true } });
      if (!p) throw new ErroRegra("Proposta de grade não encontrada.");
      if (p.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a grade.");
      if (p.decisao) {
        if (p.decisao.decisorId === autor.id && p.decisao.aprovada === d.aprovar && p.decisao.motivo === d.motivo) return { id: p.decisao.id, publicada: p.decisao.aprovada };
        throw new ErroRegra("A proposta já possui decisão.");
      }
      if (d.aprovar) {
        await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${p.turmaId} FOR UPDATE`;
        await tx.$queryRaw`SELECT m.id FROM "Modalidade" m JOIN "Turma" t ON t."modalidadeId" = m.id WHERE t.id = ${p.turmaId} FOR SHARE OF m`;
        await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE`;
        const ultima = await tx.propostaGradeTurma.findFirstOrThrow({ where: { turmaId: p.turmaId }, orderBy: { versao: "desc" } });
        if (ultima.id !== p.id) throw new ErroRegra("Existe outra versão da grade; revise a proposta mais recente.");
        const atual = await carregarGradeInicialTx(tx, p);
        if (!isDeepStrictEqual(p.snapshot, atual)) throw new ErroRegra("Os parâmetros da grade mudaram; prepare uma nova proposta.");
        const professorId = atual.origem.professorId;
        if (!professorId) throw new ErroRegra("Defina o professor antes de publicar a grade.");
        await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${professorId} FOR SHARE`;
        const disponibilidade = await conferirDisponibilidadeGrade(tx, atual);
        if (!disponibilidade.professorApto || disponibilidade.reservas.length || disponibilidade.conflitos.length || disponibilidade.conflitosInternos.length || disponibilidade.indisponibilidades.length)
          throw new ErroRegra("Resolva os conflitos ou a indisponibilidade docente antes de publicar a grade.");
        if (!atual.grade.encontros.length || atual.grade.encontros.some((e) => Date.parse(e.inicio) <= Date.now()))
          throw new ErroRegra("A publicação inicial exige encontros futuros; confira a data inicial da turma.");
        await tx.encontroAgenda.createMany({ data: atual.grade.encontros.map((e, indice) => ({
          turmaId: p.turmaId, professorId, preparadorId: p.preparadorId, propostaGradeId: p.id,
          inicio: new Date(e.inicio), fim: new Date(e.fim), fusoOrigem: p.fusoOrigem, status: "PREVISTO",
          motivo: p.motivo, chaveIdempotencia: `grade:${p.id}:${indice}`,
          entradaHash: createHash("sha256").update(JSON.stringify({ propostaId: p.id, indice, encontro: e })).digest("hex"),
        })) });
      }
      const decisao = await tx.decisaoGradeTurma.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: d.aprovar, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: "GradeInicialTurmaDecidida", agregadoTipo: "Turma", agregadoId: p.turmaId, autorId: autor.id,
        payload: { propostaId: p.id, versao: p.versao, aprovada: d.aprovar, motivo: d.motivo } });
      return { id: decisao.id, publicada: decisao.aprovada };
    }, { timeout: 20000 });
  });
}
