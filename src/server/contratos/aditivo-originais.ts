"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { preservarOriginalAditivoTx } from "./aditivo-original-tx";

const id = z.string().trim().min(1).max(100);
const gerar = z.object({ matriculaId: id, propostaId: id, conferenciaId: id, conferenciaHash: z.string().regex(/^[a-f0-9]{64}$/), motivo: z.string().trim().min(5).max(2000), conteudoConferido: z.literal(true) }).strict();
export async function preservarOriginalAditivo(input: z.input<typeof gerar>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = gerar.parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      if (!await tx.propostaAditivoContratual.count({ where: { id: d.propostaId, matriculaId: d.matriculaId } })) throw new ErroRegra("Proposta indisponível nesta matrícula.");
      return preservarOriginalAditivoTx(tx, ator.id, { propostaId: d.propostaId, conferenciaId: d.conferenciaId, conferenciaHash: d.conferenciaHash, motivo: d.motivo, conteudoConferido: d.conteudoConferido });
    }, { timeout: 30000 });
  });
}

export async function consultarOriginaisAditivo(input: { matriculaId: string; propostaId: string; pagina?: number }) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ matriculaId: id, propostaId: id, pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      if (!await tx.propostaAditivoContratual.count({ where: { id: d.propostaId, matriculaId: d.matriculaId } })) throw new ErroRegra("Proposta indisponível nesta matrícula.");
      const registros = await tx.artefatoAditivoContratual.findMany({ where: { propostaId: d.propostaId }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
        skip: (d.pagina - 1) * 20, take: 21, select: { id: true, conferenciaId: true, pdfHash: true, paginas: true, criadoEm: true, motivo: true, autor: { select: { nome: true } } } });
      const conferencia = await tx.conferenciaParticipantesAditivo.findFirst({ where: { propostaId: d.propostaId }, orderBy: { versao: "desc" }, select: { id: true, versao: true, revisaoHash: true } });
      const preservada = conferencia ? await tx.artefatoAditivoContratual.count({ where: { conferenciaId: conferencia.id } }) > 0 : false;
      return { registros: registros.slice(0, 20), conferencia, preservada, pagina: d.pagina, temProxima: registros.length > 20 };
    }, { isolationLevel: "RepeatableRead" });
  });
}
