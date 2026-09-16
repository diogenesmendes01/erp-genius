"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { hashSubstituicao } from "./substituicao-estado";
import { consultarEstadoAssinaturaAditivoTx } from "./aditivo-assinatura-estado";
import { registrarConferenciaAssinaturaAditivoTx } from "./aditivo-assinatura-tx";

const id = z.string().trim().min(1).max(100);
const alvo = z.object({ matriculaId: id, propostaId: id, artefatoId: id }).strict();
const conferir = alvo.extend({ revisaoHash: z.string().regex(/^[a-f0-9]{64}$/), dadosConferidos: z.literal(true), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().trim().min(8).max(100) }).strict();

export async function registrarConferenciaAssinaturaAditivo(input: z.input<typeof conferir>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = conferir.parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      return registrarConferenciaAssinaturaAditivoTx(tx, ator.id, d);
    }, { timeout: 30000 });
  });
}

export async function consultarAssinaturaAditivo(input: z.input<typeof alvo> & { pagina?: number }) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = alvo.extend({ pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      if (!await tx.artefatoAditivoContratual.count({ where: { id: d.artefatoId, propostaId: d.propostaId, proposta: { matriculaId: d.matriculaId } } })) throw new ErroRegra("Original indisponível nesta matrícula e proposta.");
      const registros = await tx.conferenciaAssinaturaAditivo.findMany({ where: { artefatoId: d.artefatoId }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], skip: (d.pagina - 1) * 20, take: 21,
        select: { id: true, revisaoHash: true, snapshot: true, criadaEm: true, motivo: true, autor: { select: { nome: true } } } });
      const historico = registros.slice(0, 20).map(r => {
        if (hashSubstituicao(r.snapshot) !== r.revisaoHash) throw new ErroRegra("A conferência preservada exige revisão de integridade.");
        return { id: r.id, revisaoHash: r.revisaoHash, criadaEm: r.criadaEm, motivo: r.motivo, autor: r.autor.nome };
      });
      let estado: Awaited<ReturnType<typeof consultarEstadoAssinaturaAditivoTx>> | null = null, pendencia: string | null = null;
      try { estado = await consultarEstadoAssinaturaAditivoTx(tx, { matriculaId: d.matriculaId, propostaId: d.propostaId, artefatoId: d.artefatoId }); }
      catch (e) { if (!(e instanceof ErroRegra)) throw e; pendencia = e.message; }
      return { revisao: estado ? { dados: estado.dados, hash: estado.revisaoHash } : null, pendencia, historico, pagina: d.pagina, temProxima: registros.length > 20 };
    }, { timeout: 30000 });
  });
}
