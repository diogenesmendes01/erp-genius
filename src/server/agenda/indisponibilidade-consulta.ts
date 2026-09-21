"use server";
import { hashImpactoAusencia } from "./indisponibilidade-impacto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";

const Filtro = z.object({
  professorId: z.string().min(1).optional(),
  situacao: z.enum(["TODAS", "PENDENTE", "APROVADA", "REJEITADA"]).default("TODAS"),
  cursor: z.string().min(1).optional(),
  limite: z.number().int().min(1).max(100).default(30),
}).strict();

export async function consultarIndisponibilidadesDocentes(input: z.input<typeof Filtro> = {}) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = Filtro.parse(input);
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo) throw new ErroPermissao();
      const equipe = u.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p));
      if (!equipe && (!u.papeis.includes("PROFESSOR") || (d.professorId && d.professorId !== autor.id))) throw new ErroPermissao();
      const where: Prisma.IndisponibilidadeDocenteWhereInput = {
        professorId: equipe ? d.professorId : autor.id,
        ...(d.situacao === "PENDENTE" ? { decisao: { is: null } } : {}),
        ...(["APROVADA", "REJEITADA"].includes(d.situacao) ? { decisao: { aprovada: d.situacao === "APROVADA" } } : {}),
      };
      const registros = await tx.indisponibilidadeDocente.findMany({ where,
        orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: d.limite + 1,
        ...(d.cursor ? { cursor: { id: d.cursor }, skip: 1 } : {}),
        include: { decisao: true, professor: { select: { nome: true } } },
      });
      const pagina = registros.slice(0, d.limite);
      const emAnaliseOuAprovadas = pagina.filter((r) => !r.decisao || r.decisao.aprovada);
      const encontros = emAnaliseOuAprovadas.length ? await tx.encontroAgenda.findMany({ where: { status: "PREVISTO",
        OR: emAnaliseOuAprovadas.map((a) => ({ professorId: a.professorId, inicio: { lt: a.fim }, fim: { gt: a.inicio } })),
      }, orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, professorId: true, inicio: true, fim: true } }) : [];
      const reservas = emAnaliseOuAprovadas.length ? await tx.horarioReservaParticular.findMany({ where: { reserva: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } },
        OR: emAnaliseOuAprovadas.map((a) => ({ professorId: a.professorId, inicio: { lt: a.fim }, fim: { gt: a.inicio } })),
      }, orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, reservaId: true, professorId: true, inicio: true, fim: true } }) : [];
      const reservasNoPeriodo = (r: typeof pagina[number]) => reservas.filter((h) => h.professorId === r.professorId && h.inicio < r.fim && r.inicio < h.fim)
        .map((h) => ({ id: h.id, reservaId: h.reservaId, inicio: h.inicio.toISOString(), fim: h.fim.toISOString() }));
      return { itens: pagina.map((r) => ({ id: r.id, professorId: r.professorId, professorNome: r.professor.nome,
        inicio: r.inicio.toISOString(), fim: r.fim.toISOString(), fusoOrigem: r.fusoOrigem, motivo: r.motivo,
        preparadorId: r.preparadorId, criadoEm: r.criadoEm.toISOString(),
        situacao: r.decisao ? (r.decisao.aprovada ? "APROVADA" : "REJEITADA") : "PENDENTE",
        podeDecidir: !r.decisao && r.preparadorId !== autor.id && r.professorId !== autor.id && u.papeis.some((p) => ["GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p)),
        decisao: r.decisao ? { decisorId: r.decisao.decisorId, motivo: r.decisao.motivo, decididaEm: r.decisao.decididaEm.toISOString(), encontrosNaDecisao: r.decisao.encontrosAfetados, reservasNaDecisao: r.decisao.reservasAfetadas } : null,
        impactoHash: !r.decisao ? hashImpactoAusencia(r, encontros.filter((e) => e.professorId === r.professorId && e.inicio < r.fim && r.inicio < e.fim), reservasNoPeriodo(r)) : null,
        reservasParaConferencia: !r.decisao ? reservasNoPeriodo(r) : [],
        reservasPendentes: r.decisao?.aprovada ? reservasNoPeriodo(r) : [],
        encontrosParaConferencia: !r.decisao ? encontros.filter((e) => e.professorId === r.professorId && e.inicio < r.fim && r.inicio < e.fim)
          .map((e) => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString() })) : [],
        encontrosPendentes: r.decisao?.aprovada ? encontros.filter((e) => e.professorId === r.professorId && e.inicio < r.fim && r.inicio < e.fim)
          .map((e) => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString() })) : [],
      })), proximoCursor: registros.length > d.limite ? pagina[pagina.length - 1].id : null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
