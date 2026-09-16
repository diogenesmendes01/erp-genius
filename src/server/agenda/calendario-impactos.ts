"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { PeriodosCalendarioSchema } from "./calendario-schema";
import { conferirDiasNaoLetivos } from "./calendario-intervalo";

/** Foto de revisão, sem remarcação/publicação; deve ser revalidada ao aplicar. */
export async function preverImpactosCalendario(input: { calendarioId: string }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ calendarioId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const proposta = await tx.versaoCalendarioEscolar.findUnique({ where: { id: d.calendarioId }, include: { decisao: true } });
      if (!proposta) throw new ErroRegra("Proposta de calendário não encontrada.");
      const vigente = await tx.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" } });
      const datas = (p: { id: string; inicio: string; fim: string }) => ({ id: p.id, inicio: p.inicio, fim: p.fim });
      const novos = PeriodosCalendarioSchema.parse(proposta.periodos).map(datas), anteriores = vigente ? PeriodosCalendarioSchema.parse(vigente.periodos).map(datas) : [];
      const encontros = await tx.encontroAgenda.findMany({ where: { status: { in: ["PREVISTO", "MINISTRADO"] } }, orderBy: [{ inicio: "asc" }, { id: "asc" }],
        select: { id: true, turmaId: true, matriculaId: true, professorId: true, inicio: true, fim: true, fusoOrigem: true, status: true } });
      const agora = new Date();
      const revisao = encontros.map((e) => {
        const intervalo = { inicio: e.inicio.toISOString(), fim: e.fim.toISOString() };
        const antes = conferirDiasNaoLetivos({ ...intervalo, fusoEscola: vigente?.fusoInstitucional ?? proposta.fusoInstitucional, periodos: anteriores });
        const depois = conferirDiasNaoLetivos({ ...intervalo, fusoEscola: proposta.fusoInstitucional, periodos: novos });
        return { ...e, ...intervalo, preservarRegistro: e.status === "MINISTRADO" || e.inicio <= agora,
          periodosAntes: antes.periodosAfetados, periodosPropostos: depois.periodosAfetados,
          situacao: depois.periodosAfetados.length ? "ATINGE_DIA_NAO_LETIVO" as const : antes.periodosAfetados.length ? "DIA_LIBERADO_NA_PROPOSTA" as const : "SEM_INTERSECAO" as const };
      });
      return { calendarioId: proposta.id, versao: proposta.versao, calendarioVigenteId: vigente?.id ?? null,
        fusoAnterior: vigente?.fusoInstitucional ?? null, fusoProposto: proposta.fusoInstitucional,
        encontros: revisao, totalEncontros: revisao.length, totalComIntersecao: revisao.filter((e) => e.situacao !== "SEM_INTERSECAO").length,
        pendencias: [
          ...(proposta.decisao ? ["Esta versão já possui decisão; consulte o histórico antes de preparar alterações."] : []),
          ...(revisao.some((e) => !e.preservarRegistro) ? ["Revisar conjuntamente os cronogramas futuros, incluindo oportunidades criadas por remoção de dias não letivos."] : []),
        ],
        // Não basta ausência de colisão: tirar um recesso pode antecipar encontros futuros.
        revisaoCompleta: false as const, aplicada: false as const, conferidoEm: agora.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
