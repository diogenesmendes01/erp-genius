"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";

/** Atribuição por encontro não concede acesso ao cadastro, financeiro ou restante da turma. */
export async function consultarEncontrosDocente(input: { encontroId?: string; cursor?: string; limite?: number } = {}) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ encontroId: z.string().min(1).optional(), cursor: z.string().min(1).optional(), limite: z.number().int().min(1).max(100).default(30) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: usuario.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo) throw new ErroPermissao();
      const gestao = u.papeis.some((p) => p === "GERENTE_PEDAGOGICO" || p === "ADMINISTRADOR" || p === "SECRETARIA_ACADEMICA");
      if (!gestao && !u.papeis.includes("PROFESSOR")) throw new ErroPermissao();
      const escopo: Prisma.EncontroAgendaWhereInput = { finalidade: "AULA", status: { in: ["PREVISTO", "MINISTRADO", "CANCELADO"] }, ...(gestao ? {} : { professorId: usuario.id }) };
      if (d.encontroId && !await tx.encontroAgenda.count({ where: { ...escopo, id: d.encontroId } })) throw new ErroPermissao("Encontro indisponível para seu acesso.");
      if (d.cursor && !await tx.encontroAgenda.count({ where: { ...escopo, id: d.cursor } })) throw new ErroPermissao("Página indisponível para seu acesso.");
      const registros = await tx.encontroAgenda.findMany({ where: { ...escopo, ...(d.encontroId ? { id: d.encontroId } : {}) },
        orderBy: [{ inicio: "asc" }, { id: "asc" }], take: d.limite + 1, ...(d.cursor ? { cursor: { id: d.cursor }, skip: 1 } : {}),
        select: { id: true, matriculaId: true, inicio: true, fim: true, fusoOrigem: true, status: true, professorId: true,
          professor: { select: { nome: true } }, turma: { select: { codigo: true, nome: true } } },
      });
      const pagina = registros.slice(0, d.limite);
      return { encontros: pagina.map((e) => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), fusoOrigem: e.fusoOrigem,
        status: e.status, particular: !!e.matriculaId, professor: e.professor?.nome ?? "Sem professor", atribuicaoPropria: e.professorId === usuario.id,
        turma: e.turma ? [e.turma.codigo, e.turma.nome].filter(Boolean).join(" · ") || "Turma" : "Encontro individual",
      })), proximoCursor: registros.length > d.limite ? pagina[pagina.length - 1].id : null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
