"use server";
import { hashImpactoAusencia } from "./indisponibilidade-impacto";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { instanteDaGrade } from "./grade";

const Solicitar = z.object({ professorId: z.string().min(1), inicio: z.string().datetime({ offset: true }), fim: z.string().datetime({ offset: true }),
  fusoOrigem: FusoInstitucionalSchema, motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100),
}).strict().refine((d) => Date.parse(d.fim) > Date.parse(d.inicio), "O fim deve ser posterior ao início.");

export async function solicitarIndisponibilidadeLocal(input: { professorId: string; inicioLocal: string; fimLocal: string; fusoOrigem: string; motivo: string; chaveIdempotencia: string }) {
  const convertido = await executarAcao(async () => {
    await exigirSessaoComPapel(Papel.PROFESSOR, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const local = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const d = z.object({ professorId: z.string().min(1), inicioLocal: local, fimLocal: local, fusoOrigem: FusoInstitucionalSchema,
      motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict().parse(input);
    try {
      return { professorId: d.professorId, fusoOrigem: d.fusoOrigem, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia,
        inicio: instanteDaGrade(d.inicioLocal.slice(0, 10), d.inicioLocal.slice(11), d.fusoOrigem).toISOString(),
        fim: instanteDaGrade(d.fimLocal.slice(0, 10), d.fimLocal.slice(11), d.fusoOrigem).toISOString() };
    } catch { throw new ErroRegra("Confira as datas e horários no fuso informado. Horários inexistentes ou ambíguos precisam de revisão."); }
  });
  if (!convertido.ok) return convertido;
  return solicitarIndisponibilidadeDocente(convertido.dado!);
}

export async function solicitarIndisponibilidadeDocente(input: z.input<typeof Solicitar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = Solicitar.parse(input), hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id } });
      if (!u?.ativo) throw new ErroPermissao();
      const equipe = u.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p));
      if (!equipe && !(u.papeis.includes("PROFESSOR") && d.professorId === u.id)) throw new ErroPermissao();
      const repetida = await tx.indisponibilidadeDocente.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== hash) throw new ErroRegra("Chave utilizada para outra solicitação.");
        return { id: repetida.id };
      }
      const docente = await tx.usuario.findUnique({ where: { id: d.professorId } });
      if (!docente?.ativo || !docente.papeis.includes("PROFESSOR")) throw new ErroRegra("Informe um professor ativo.");
      const s = await tx.indisponibilidadeDocente.create({ data: { ...d, inicio: new Date(d.inicio), fim: new Date(d.fim), preparadorId: u.id, entradaHash: hash } });
      await registrarEvento(tx, { tipo: "IndisponibilidadeDocenteSolicitada", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: u.id, payload: { indisponibilidadeId: s.id, professorId: d.professorId } });
      return { id: s.id };
    });
  });
}

export async function decidirIndisponibilidadeDocente(input: { indisponibilidadeId: string; aprovar: boolean; motivo: string; impactoHash?: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ indisponibilidadeId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000), impactoHash: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict().parse(input);
    if (d.aprovar && !d.impactoHash) throw new ErroRegra("Confira o impacto antes de aprovar a ausência.");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id } });
      if (!u?.ativo || !u.papeis.some((p) => ["GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const s = await tx.indisponibilidadeDocente.findUnique({ where: { id: d.indisponibilidadeId }, include: { decisao: true } });
      if (!s) throw new ErroRegra("Solicitação não encontrada.");
      if (s.preparadorId === u.id || s.professorId === u.id) throw new ErroRegra("Outra pessoa deve decidir a indisponibilidade.");
      if (s.decisao) {
        if (s.decisao.decisorId === u.id && s.decisao.aprovada === d.aprovar && s.decisao.motivo === d.motivo && (!d.aprovar || d.impactoHash === hashImpactoAusencia(s, s.decisao.encontrosAfetados, s.decisao.reservasAfetadas))) return { id: s.decisao.id, aprovada: s.decisao.aprovada };
        throw new ErroRegra("Solicitação já decidida.");
      }
      const encontros = d.aprovar ? await tx.encontroAgenda.findMany({ where: { professorId: s.professorId, status: "PREVISTO", inicio: { lt: s.fim }, fim: { gt: s.inicio } }, orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true, fim: true } }) : [];
      const reservas = d.aprovar ? await tx.horarioReservaParticular.findMany({ where: { professorId: s.professorId, reserva: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, inicio: { lt: s.fim }, fim: { gt: s.inicio } }, orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, reservaId: true, inicio: true, fim: true } }) : [];
      const reservasAfetadas = reservas.map((r) => ({ id: r.id, reservaId: r.reservaId, inicio: r.inicio.toISOString(), fim: r.fim.toISOString() }));
      const impactoAtual = hashImpactoAusencia(s, encontros, reservasAfetadas);
      if (d.aprovar && d.impactoHash !== impactoAtual) throw new ErroRegra("O impacto da ausência mudou. Atualize a lista e confira as aulas e reservas antes de aprovar.");
      const decisao = await tx.decisaoIndisponibilidadeDocente.create({ data: { indisponibilidadeId: s.id, decisorId: u.id, aprovada: d.aprovar, motivo: d.motivo,
        reservasAfetadas, encontrosAfetados: encontros.map((e) => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString() })) } });
      await registrarEvento(tx, { tipo: "IndisponibilidadeDocenteDecidida", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: u.id, payload: { indisponibilidadeId: s.id, aprovada: d.aprovar, impactoHash: d.aprovar ? impactoAtual : null, encontrosPendentes: encontros.map((e) => e.id), reservasPendentes: reservas.map((r) => r.reservaId) } });
      return { id: decisao.id, aprovada: decisao.aprovada };
    });
  });
}
