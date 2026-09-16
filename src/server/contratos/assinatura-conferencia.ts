"use server";
import { z } from "zod";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { carregarRevisaoAssinatura } from "./assinatura-estado";
import { hashPrevia } from "./previa-estado";

const Alvo = z.object({ matriculaId: z.string().min(1), artefatoId: z.string().min(1) }).strict();
const Conferir = Alvo.extend({ revisaoHash: z.string().regex(/^[a-f0-9]{64}$/), dadosConferidos: z.literal(true), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

export async function consultarConferenciaAssinatura(input: z.input<typeof Alvo> & { pagina?: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = Alvo.extend({ pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await conferirAutor(tx, autor.id);
      if (!await tx.artefatoContratual.count({ where: { id: d.artefatoId, previa: { matriculaId: d.matriculaId } } })) throw new ErroRegra("Original indisponível nesta matrícula.");
      const historico = await tx.conferenciaAssinaturaContratual.findMany({ where: { artefatoId: d.artefatoId }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], skip: (d.pagina - 1) * 20, take: 21,
        select: { id: true, criadaEm: true, motivo: true, revisaoHash: true, autor: { select: { nome: true } } } });
      let revisao: Awaited<ReturnType<typeof carregarRevisaoAssinatura>> | null = null, pendencia: string | null = null;
      try { revisao = await carregarRevisaoAssinatura(tx, d.matriculaId, d.artefatoId); }
      catch (e) { if (!(e instanceof ErroRegra)) throw e; pendencia = e.message; }
      return { revisao: revisao ? { dados: revisao.dados, hash: revisao.revisaoHash } : null, pendencia, historico: historico.slice(0, 20), pagina: d.pagina, temProxima: historico.length > 20 };
    }, { timeout: 20000 });
  });
}

export async function registrarConferenciaAssinatura(input: z.input<typeof Conferir>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Conferir.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`assinatura-conferencia:${autor.id}`}, 0))`;
      await conferirAutor(tx, autor.id);
      const anterior = await tx.conferenciaAssinaturaContratual.findUnique({ where: { autorId_chaveIdempotencia: { autorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== hashPrevia(d)) throw new ErroRegra("Chave já utilizada para outra conferência.");
        return { id: anterior.id, envioRealizado: false as const };
      }
      const r = await carregarRevisaoAssinatura(tx, d.matriculaId, d.artefatoId);
      if (r.revisaoHash !== d.revisaoHash) throw new ErroRegra("As condições mudaram desde a revisão. Atualize a conferência antes de continuar.");
      // A mesma revisão já registrada não cria novas autorizações por repetição.
      const equivalente = await tx.conferenciaAssinaturaContratual.findFirst({ where: { artefatoId: d.artefatoId, revisaoHash: r.revisaoHash }, select: { id: true } });
      if (equivalente) return { id: equivalente.id, envioRealizado: false as const };
      const c = await tx.conferenciaAssinaturaContratual.create({ data: { artefatoId: d.artefatoId, autorId: autor.id, revisaoHash: r.revisaoHash, snapshot: r.snapshot,
        motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hashPrevia(d) } });
      await registrarEvento(tx, { tipo: "ConferenciaParaAssinaturaRegistrada", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id,
        payload: { conferenciaId: c.id, artefatoId: d.artefatoId, revisaoHash: r.revisaoHash } });
      return { id: c.id, envioRealizado: false as const };
    }, { timeout: 20000 });
  });
}
