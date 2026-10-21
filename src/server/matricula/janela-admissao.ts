"use server";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { DataCivilSchema } from "./cobertura";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";

const Entrada = z.object({ turmaId: z.string().min(1), limiteEntrada: DataCivilSchema, fusoConferido: FusoInstitucionalSchema,
  versaoAnterior: z.number().int().nonnegative(), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

async function conferirAutor(tx: Prisma.TransactionClient, id: string, decisao = false) {
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some((p) => p === "ADMINISTRADOR" || p === "GERENTE_PEDAGOGICO" || (!decisao && p === "SECRETARIA_ACADEMICA"))) throw new ErroPermissao();
}

export async function prepararJanelaAdmissao(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = Entrada.parse(input), hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${d.turmaId} FOR UPDATE`;
      await conferirAutor(tx, autor.id);
      const repetida = await tx.janelaAdmissaoTurma.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== hash) throw new ErroRegra("Chave utilizada para outra proposta de janela.");
        return { id: repetida.id, versao: repetida.versao };
      }
      const turma = await tx.turma.findUnique({ where: { id: d.turmaId }, select: { status: true } });
      if (!turma) throw new ErroRegra("Turma não encontrada.");
      if (turma.status === "CONCLUIDA") throw new ErroRegra("Turma concluída não admite nova janela de entrada.");
      const ultima = await tx.janelaAdmissaoTurma.findFirst({ where: { turmaId: d.turmaId }, orderBy: { versao: "desc" } });
      if ((ultima?.versao ?? 0) !== d.versaoAnterior) throw new ErroRegra("Existe outra versão da janela; confira novamente.");
      await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE`;
      const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
      if (config?.fusoInstitucional !== d.fusoConferido) throw new ErroRegra("Confira o fuso institucional atual antes de preparar a janela.");
      const r = await tx.janelaAdmissaoTurma.create({ data: { turmaId: d.turmaId, preparadorId: autor.id, versao: d.versaoAnterior + 1,
        limiteEntrada: new Date(`${d.limiteEntrada}T00:00:00Z`), fusoAdmissao: d.fusoConferido, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash } });
      await registrarEvento(tx, { tipo: "JanelaAdmissaoPreparada", agregadoTipo: "Turma", agregadoId: d.turmaId, autorId: autor.id, payload: { propostaId: r.id, versao: r.versao, limiteEntrada: d.limiteEntrada, fusoAdmissao: r.fusoAdmissao } });
      return { id: r.id, versao: r.versao };
    });
  });
}

export async function decidirJanelaAdmissao(input: { propostaId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const p = await tx.janelaAdmissaoTurma.findUnique({ where: { id: d.propostaId } });
      if (!p) throw new ErroRegra("Proposta de janela não encontrada.");
      await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${p.turmaId} FOR UPDATE`;
      await conferirAutor(tx, autor.id, true);
      if (p.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a janela.");
      const anterior = await tx.decisaoJanelaAdmissao.findUnique({ where: { propostaId: p.id } });
      if (anterior) {
        if (anterior.decisorId === autor.id && anterior.aprovada === d.aprovar && anterior.motivo === d.motivo) return { id: anterior.id, aprovada: anterior.aprovada };
        throw new ErroRegra("A janela já possui decisão.");
      }
      if (d.aprovar) {
        const turma = await tx.turma.findUniqueOrThrow({ where: { id: p.turmaId }, select: { status: true } });
        if (turma.status === "CONCLUIDA") throw new ErroRegra("Turma concluída não admite nova janela de entrada.");
        if (await tx.janelaAdmissaoTurma.count({ where: { turmaId: p.turmaId, versao: { gt: p.versao } } })) throw new ErroRegra("Confira a versão mais recente da janela.");
        await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE`;
        const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
        if (config?.fusoInstitucional !== p.fusoAdmissao) throw new ErroRegra("O fuso institucional mudou; prepare nova versão da janela.");
      }
      const r = await tx.decisaoJanelaAdmissao.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: d.aprovar, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: "JanelaAdmissaoDecidida", agregadoTipo: "Turma", agregadoId: p.turmaId, autorId: autor.id, payload: { propostaId: p.id, versao: p.versao, aprovada: d.aprovar } });
      return { id: r.id, aprovada: r.aprovada };
    });
  });
}
