"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { carregarJanelaAdmissaoVigente } from "./janela-admissao-tx";

export async function consultarJanelasAdmissao(input: { turmaId: string; pagina?: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ turmaId: z.string().min(1), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const turma = await tx.turma.findUnique({ where: { id: d.turmaId }, select: { id: true, codigo: true, nome: true, status: true } });
      if (!turma) throw new ErroRegra("Turma não encontrada.");
      const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
      const ultima = await tx.janelaAdmissaoTurma.findFirst({ where: { turmaId: d.turmaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const registros = await tx.janelaAdmissaoTurma.findMany({ where: { turmaId: d.turmaId }, orderBy: { versao: "desc" }, skip: (d.pagina - 1) * 30, take: 31,
        select: { id: true, versao: true, limiteEntrada: true, fusoAdmissao: true, motivo: true, criadoEm: true, preparadorId: true, preparador: { select: { nome: true } },
          decisao: { select: { aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } } } });
      return { turma, fusoInstitucional: config?.fusoInstitucional ?? null, ultimaVersao: ultima?.versao ?? 0, vigente: await carregarJanelaAdmissaoVigente(tx, d.turmaId),
        pagina: d.pagina, possuiMais: registros.length > 30, registros: registros.slice(0, 30).map(({ preparadorId, limiteEntrada, ...r }) => ({ ...r,
          limiteEntrada: limiteEntrada.toISOString().slice(0, 10),
          podeDecidir: !r.decisao && preparadorId !== autor.id && u.papeis.some((p) => p === "GERENTE_PEDAGOGICO" || p === "ADMINISTRADOR"),
          podeAprovar: turma.status !== "CONCLUIDA" && r.versao === ultima?.versao && r.fusoAdmissao === config?.fusoInstitucional,
        })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
