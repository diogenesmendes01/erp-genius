"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { permiteAulasRegulares } from "./acesso-aulas-regras";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";

export async function carregarGestaoAcessoAulas(input: { matriculaId?: string; alunoId?: string } = {}) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);
    const filtro = z.object({ matriculaId: z.string().min(1).optional(), alunoId: z.string().min(1).optional() }).parse(input);
    const global = !filtro.matriculaId && !filtro.alunoId;
    if (global && !usuario.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.FINANCEIRO)) throw new ErroPermissao("Consulte o acesso pela ficha individual do aluno.");
    const podeAprovar = usuario.papeis.includes(Papel.ADMINISTRADOR);
    const matriculas = await prisma.matricula.findMany({
      where: {
        ...(filtro.matriculaId ? { id: filtro.matriculaId } : {}), ...(filtro.alunoId ? { alunoId: filtro.alunoId } : {}),
        ...(global ? { OR: [{ acessoBloqueioManual: true }, { acessoBloqueioAutomatico: true }, { solicitacoesAcessoAulas: { some: { status: "PENDENTE" as const } } }] } : {}),
      },
      orderBy: { criadoEm: "desc" }, take: 100,
      select: {
        id: true, codigo: true, status: true, acessoBloqueado: true, acessoBloqueioManual: true, acessoBloqueioAutomatico: true,
        aluno: { select: { primeiroNome: true, sobrenome: true } },
        solicitacoesAcessoAulas: { orderBy: { criadoEm: "desc" }, take: 10, select: {
          id: true, bloquear: true, motivo: true, status: true, criadoEm: true, decididoEm: true, motivoDecisao: true,
          solicitanteId: true, solicitante: { select: { nome: true } }, aprovador: { select: { nome: true } },
        } },
      },
    });
    return { podeAprovar, matriculas: matriculas.map((m) => ({
      id: m.id, codigo: m.codigo, status: m.status, aluno: nomeCompleto(m.aluno),
      bloqueado: m.acessoBloqueado, manual: m.acessoBloqueioManual, automatico: m.acessoBloqueioAutomatico,
      aulasRegularesPermitidas: permiteAulasRegulares(m),
      solicitacoes: m.solicitacoesAcessoAulas.map((p) => ({
        id: p.id, bloquear: p.bloquear, motivo: p.motivo, status: p.status, criadoEm: p.criadoEm.toISOString(),
        decididoEm: p.decididoEm?.toISOString() ?? null, motivoDecisao: p.motivoDecisao,
        solicitante: p.solicitante.nome, aprovador: p.aprovador?.nome ?? null,
        podeDecidir: podeAprovar && p.status === "PENDENTE" && p.solicitanteId !== usuario.id,
      })),
    })) };
  });
}

export type GestaoAcessoAulas = NonNullable<Extract<Awaited<ReturnType<typeof carregarGestaoAcessoAulas>>, { ok: true }>["dado"]>;
