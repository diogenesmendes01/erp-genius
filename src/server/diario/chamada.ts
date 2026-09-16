"use server";
import { z } from "zod";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { docenteAtual, vinculoCobre } from "./permissoes";
import { carregarChamadaTx } from "./chamada-tx";

const schema = z.object({ turmaId: z.string().trim().min(1), ocorridaEm: z.string().datetime({ offset: true }) }).strict();
export async function listarAlunosParaChamada(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR);
    const dados = schema.parse(input), instante = new Date(dados.ocorridaEm);
    if (instante > new Date()) throw new ErroRegra("Escolha uma aula já ocorrida.");
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.includes(Papel.PROFESSOR)) throw new ErroPermissao();
      const turma = await tx.turma.findUnique({ where: { id: dados.turmaId }, select: { professorId: true, status: true, vinculosDocentes: true } });
      if (!turma || !docenteAtual(autor.id, turma) || !turma.vinculosDocentes.some((v) => v.professorId === autor.id && v.fim === null && vinculoCobre(v, instante))) throw new ErroPermissao("Sem atribuição docente para esta aula.");
      return carregarChamadaTx(tx, dados.turmaId, instante);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
