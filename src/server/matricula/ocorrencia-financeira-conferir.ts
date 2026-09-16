"use server";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarPreviaOcorrenciaFinanceiraTx } from "./ocorrencia-financeira-previa-tx";
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const Entrada = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1), ocorrenciaId: z.string().min(1), condicoesId: z.string().min(1),
  estadoPrevia: z.string().regex(/^[a-f0-9]{64}$/), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

export async function conferirOcorrenciaHoras(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Entrada.parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [d.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      if (!await tx.matricula.count({ where: { id: d.matriculaId, alunoId: d.alunoId } })) throw new ErroRegra("Matrícula não encontrada para este aluno.");
      const existente = await tx.conferenciaOcorrenciaHoras.findUnique({ where: { conferenteId_chaveIdempotencia: { conferenteId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (existente) {
        if (existente.entradaHash !== hash(d)) throw new ErroRegra("Chave usada para outra conferência.");
        return { id: existente.id, emiteCobranca: false as const };
      }
      const previa = await carregarPreviaOcorrenciaFinanceiraTx(tx, d);
      if (hash(previa) !== d.estadoPrevia) throw new ErroRegra("As origens mudaram. Confira uma nova prévia.");
      if (previa.pendencias.length) throw new ErroRegra(previa.pendencias.join(" "));
      const encontroId = previa.classificacao.origem.referenciaEncontro;
      if (await tx.conferenciaOcorrenciaHoras.count({ where: { encontroId } })) throw new ErroRegra("Encontro já conferido. Alterações exigem revisão dos efeitos financeiros.");
      const c = await tx.conferenciaOcorrenciaHoras.create({ data: { encontroId, ocorrenciaId: d.ocorrenciaId, condicoesId: d.condicoesId,
        conferenteId: autor.id, minutos: previa.minutos, valor: previa.valorApurado, moeda: previa.moeda, desfecho: previa.classificacao.desfecho,
        snapshot: previa, estadoPrevia: d.estadoPrevia, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash(d) } });
      await registrarEvento(tx, { tipo: "OcorrenciaHorasConferida", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id,
        payload: { conferenciaId: c.id, encontroId, ocorrenciaId: d.ocorrenciaId, condicoesId: d.condicoesId, valor: previa.valorApurado, moeda: previa.moeda, emiteCobranca: false } });
      return { id: c.id, emiteCobranca: false as const };
    });
  });
}
