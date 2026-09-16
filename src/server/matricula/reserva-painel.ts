"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";
import { conferirVencimentoReservaTx } from "./reserva-vencimento-tx";
import { conferirVencimentoParticularTx } from "./reserva-particular-vencimento-tx";

async function conferirAutor(tx: Prisma.TransactionClient, id: string) {
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some((p) => p === "SECRETARIA_ACADEMICA" || p === "ADMINISTRADOR")) throw new ErroPermissao();
}
export async function listarReservasSecretaria(input: { pagina?: number; matriculaId?: string; historico?: boolean }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ pagina: z.number().int().min(1).max(100000).default(1), matriculaId: z.string().min(1).optional(), historico: z.boolean().default(false) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await conferirAutor(tx, autor.id);
      const agora = new Date();
      const registros = await tx.reservaVagaMatricula.findMany({ where: { ...(d.matriculaId ? { matriculaId: d.matriculaId } : {}), ...(!d.historico ? { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] as const } } : {}) },
        orderBy: [{ expiraEm: "asc" }, { id: "asc" }], skip: (d.pagina - 1) * 30, take: 31,
        select: { id: true, status: true, criadaEm: true, expiraEm: true, motivo: true, matriculaId: true,
          turma: { select: { codigo: true, nome: true } }, janela: { select: { fusoAdmissao: true } },
          matricula: { select: { codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } } } });
      return { pagina: d.pagina, possuiMais: registros.length > 30, registros: registros.slice(0, 30).map((r) => ({ ...r,
        particular: false, referencia: r.turma.codigo ?? r.turma.nome ?? "Turma sem código", fuso: r.janela.fusoAdmissao, quantidadeHorarios: null as number | null,
        prazoVencido: r.expiraEm <= agora, podeConferir: r.status === "ATIVA" && r.expiraEm <= agora })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
export async function conferirReservaSecretaria(input: { reservaId: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ reservaId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await conferirAutor(tx, autor.id);
      return conferirVencimentoReservaTx(tx, d.reservaId, autor.id);
    }, { timeout: 20000 });
  });
}

export async function listarReservasParticularesSecretaria(input: { pagina?: number; matriculaId?: string; historico?: boolean }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ pagina: z.number().int().min(1).max(100000).default(1), matriculaId: z.string().min(1).optional(), historico: z.boolean().default(false) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await conferirAutor(tx, autor.id);
      const agora = new Date();
      const registros = await tx.reservaAgendaParticular.findMany({ where: {
        ...(d.matriculaId ? { matriculaId: d.matriculaId } : {}),
        ...(!d.historico ? { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] as const } } : {}),
      }, orderBy: [{ expiraEm: "asc" }, { id: "asc" }], skip: (d.pagina - 1) * 30, take: 31,
        select: { id: true, status: true, criadaEm: true, expiraEm: true, motivo: true, matriculaId: true,
          horarios: { orderBy: [{ inicio: "asc" }, { id: "asc" }], take: 1, select: { fusoOrigem: true, professor: { select: { nome: true } } } },
          _count: { select: { horarios: true } },
          matricula: { select: { codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } },
        },
      });
      return { pagina: d.pagina, possuiMais: registros.length > 30, registros: registros.slice(0, 30).map(({ horarios, _count, ...r }) => ({ ...r,
        particular: true, referencia: `Particular · ${horarios[0]?.professor.nome ?? "Professor não identificado"}`, fuso: horarios[0]?.fusoOrigem ?? null,
        quantidadeHorarios: _count.horarios, prazoVencido: r.expiraEm <= agora, podeConferir: r.status === "ATIVA" && r.expiraEm <= agora,
      })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

export async function conferirReservaParticularSecretaria(input: { reservaId: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ reservaId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await conferirAutor(tx, autor.id);
      return conferirVencimentoParticularTx(tx, d.reservaId, autor.id);
    }, { timeout: 20000 });
  });
}
