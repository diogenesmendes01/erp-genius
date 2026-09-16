"use server";

import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra, exigirSessaoComPapel, executarAcao, type Resultado } from "@/server/_shared";

const papéis = [Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO] as const;

export async function registrarAutorizacaoComunicacaoAcademica(input: { matriculaId: string; responsavelId: string; evidencia: string }): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...papéis);
    if (!input.evidencia?.trim()) throw new ErroRegra("Informe a evidência da autorização acadêmica.");
    const vinculo = await prisma.matricula.findFirst({ where: { id: input.matriculaId, aluno: { responsaveis: { some: { responsavelId: input.responsavelId, papel: "PEDAGOGICO" } } } }, select: { id: true } });
    if (!vinculo) throw new ErroRegra("Responsável não possui vínculo pedagógico com esta matrícula.");
    const criada = await prisma.autorizacaoComunicacaoAcademica.create({ data: { matriculaId: input.matriculaId, responsavelId: input.responsavelId, autorizadaPorId: autor.id, evidencia: input.evidencia.trim() } });
    return { id: criada.id };
  });
}

export async function revogarAutorizacaoComunicacaoAcademica(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...papéis);
    const r = await prisma.autorizacaoComunicacaoAcademica.updateMany({ where: { id, revogadaEm: null }, data: { revogadaEm: new Date(), revogadaPorId: autor.id } });
    if (!r.count) throw new ErroRegra("Autorização vigente não encontrada.");
    return undefined;
  });
}

export async function listarAutorizacoesComunicacaoAcademica(matriculaId: string) {
  await exigirSessaoComPapel(...papéis);
  return prisma.autorizacaoComunicacaoAcademica.findMany({ where: { matriculaId }, include: { responsavel: { select: { nome: true, telefoneE164: true } }, autorizadaPor: { select: { nome: true } }, revogadaPor: { select: { nome: true } } }, orderBy: { vigenteEm: "desc" } });
}
