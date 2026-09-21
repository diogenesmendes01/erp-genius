"use server";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { PropostaCalendarioSchema } from "./calendario-schema";

/** Versão candidata do calendário único; a aprovação/aplicação tem fluxo próprio. */
export async function prepararCalendarioEscolar(input: z.input<typeof PropostaCalendarioSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const original = PropostaCalendarioSchema.parse(input), d = { ...original, periodos: [...original.periodos].sort((a, b) => a.id.localeCompare(b.id)) };
    const hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const repetida = await tx.versaoCalendarioEscolar.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } }, include: { decisao: true } });
      if (repetida) {
        if (repetida.entradaHash !== hash) throw new ErroRegra("Chave utilizada para outra proposta de calendário.");
        return { id: repetida.id, versao: repetida.versao, publicada: repetida.decisao?.aprovada === true };
      }
      const ultima = await tx.versaoCalendarioEscolar.findFirst({ orderBy: { versao: "desc" } });
      if ((ultima?.versao ?? 0) !== d.versaoAnterior) throw new ErroRegra("Existe outra versão. Atualize a proposta antes de salvar.");
      await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE`;
      const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" } });
      const fuso = FusoInstitucionalSchema.safeParse(config?.fusoInstitucional);
      if (!fuso.success) throw new ErroRegra("Configure o fuso institucional da escola antes de preparar o calendário.");
      if (fuso.data !== d.fusoConferido) throw new ErroRegra("O fuso institucional mudou desde a conferência. Atualize o formulário antes de preparar o calendário.");
      const c = await tx.versaoCalendarioEscolar.create({ data: { versao: d.versaoAnterior + 1, preparadorId: autor.id, fusoInstitucional: fuso.data, periodos: d.periodos, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash } });
      await registrarEvento(tx, { tipo: "CalendarioEscolarPreparado", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: autor.id, payload: { calendarioId: c.id, versao: c.versao } });
      return { id: c.id, versao: c.versao, publicada: false as const };
    });
  });
}
