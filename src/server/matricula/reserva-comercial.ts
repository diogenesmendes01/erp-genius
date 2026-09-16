"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { conferirTurmaParaReserva } from "./reserva-disponibilidade";
import { reservarVagaMatriculaTx } from "./reserva-vaga-tx";

const permitidos: Papel[] = [Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL];
const Entrada = z.object({ matriculaId: z.string().min(1), turmaId: z.string().min(1), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

/** Reserva uma contratação já preparada; não cria a matrícula nem emite cobranças. */
export async function reservarVagaContratacao(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
    const dados = Entrada.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${dados.matriculaId} FOR UPDATE`;
      const matricula = await tx.matricula.findUnique({ where: { id: dados.matriculaId }, select: { leadId: true } });
      if (!matricula) throw new ErroRegra("Contratação não encontrada ou fora do acesso permitido.");
      if (matricula.leadId) await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${matricula.leadId} FOR UPDATE`;
      const autor = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { id: true, nome: true, ativo: true, papeis: true } });
      if (!autor?.ativo || !autor.papeis.some((p) => permitidos.includes(p))) throw new ErroPermissao();
      if (!autor.papeis.includes(Papel.ADMINISTRADOR) && !autor.papeis.includes(Papel.SECRETARIA_ACADEMICA)) {
        const autorizado = matricula.leadId && await tx.lead.findFirst({ where: { AND: [{ id: matricula.leadId }, await escopoComercialAtual(autor, tx)] }, select: { id: true } });
        if (!autorizado) throw new ErroPermissao();
      }
      return reservarVagaMatriculaTx(tx, { ...dados, autorId: autor.id });
    }, { timeout: 20000 });
  });
}

export async function consultarTurmasParaReserva(input: { matriculaId: string; pagina?: number }) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ matriculaId: z.string().min(1), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const autor = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { id: true, nome: true, ativo: true, papeis: true } });
      if (!autor?.ativo || !autor.papeis.some((p) => permitidos.includes(p))) throw new ErroPermissao();
      const equipe = autor.papeis.includes(Papel.ADMINISTRADOR) || autor.papeis.includes(Papel.SECRETARIA_ACADEMICA);
      const m = await tx.matricula.findFirst({ where: { id: d.matriculaId, ...(!equipe ? { lead: { is: await escopoComercialAtual(autor, tx) } } : {}) },
        select: { id: true, codigo: true, status: true, produto: { select: { modalidadeId: true, idiomaId: true } },
          reservasVaga: { where: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, select: { id: true, expiraEm: true, status: true, turma: { select: { codigo: true, nome: true } }, janela: { select: { fusoAdmissao: true } } } },
          _count: { select: { alocacoes: { where: { ativa: true } } } } } });
      if (!m) throw new ErroRegra("Contratação não encontrada ou fora do acesso permitido.");
      const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { prazoReservaMinutos: true } });
      const podeReservar = ["RASCUNHO", "AGUARDANDO"].includes(m.status) && !m.reservasVaga.length && !m._count.alocacoes && !!config?.prazoReservaMinutos;
      const turmas = podeReservar ? await tx.turma.findMany({ where: { modalidadeId: m.produto.modalidadeId, nivel: { idiomaId: m.produto.idiomaId }, status: { not: "CONCLUIDA" } },
        orderBy: [{ codigo: "asc" }, { id: "asc" }], skip: (d.pagina - 1) * 10, take: 11, select: { id: true, codigo: true, nome: true, status: true, capacidade: true } }) : [];
      const registros = [];
      for (const turma of turmas.slice(0, 10)) {
        const { janela, conferencia } = await conferirTurmaParaReserva(tx, turma);
        registros.push({ id: turma.id, codigo: turma.codigo, nome: turma.nome, elegivel: conferencia.elegivel, impedimentos: conferencia.impedimentos, vagas: conferencia.vagas, limiteEntrada: janela?.limiteEntrada ?? null, fuso: janela?.fusoAdmissao ?? null });
      }
      return { matricula: { id: m.id, codigo: m.codigo, status: m.status }, reservas: m.reservasVaga, prazoMinutos: config?.prazoReservaMinutos ?? null, podeReservar, registros, pagina: d.pagina, possuiMais: turmas.length > 10 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
  });
}
