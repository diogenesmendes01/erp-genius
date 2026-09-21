"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";

export async function consultarConclusaoContratual(input: { matriculaId: string; artefatoId: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ matriculaId: z.string().min(1).max(100), artefatoId: z.string().min(1).max(100) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx,u.id);
      const p = await tx.processoAssinaturaContratual.findFirst({ where: { matriculaId: d.matriculaId, artefatoId: d.artefatoId }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
        select: { id: true, estado: true, fornecedor: true, ambiente: true, artefato: { select: { conferencia: { select: { snapshot: true } } } },
          conclusao: { select: { id: true, concluidaEm: true, registradaEm: true, assinaturas: true } } } });
      if (!p) return null;
      const pessoas = z.object({ participantes: z.array(z.object({ papel: z.string(), identidade: z.object({ nome: z.string() }) })) }).parse(p.artefato.conferencia.snapshot).participantes;
      return { processoId: p.id, estadoEnvio: p.estado, fornecedor: p.fornecedor, ambiente: p.ambiente,
        conclusao: p.conclusao ? { id: p.conclusao.id, concluidaEm: p.conclusao.concluidaEm.toISOString(), registradaEm: p.conclusao.registradaEm.toISOString(),
          assinaturas: z.array(z.object({ papel: z.string(), etapa: z.enum(["CLIENTE","ESCOLA"]), assinadaEm: z.string() })).parse(p.conclusao.assinaturas).map(a => ({ ...a, nome: pessoas.find(p => p.papel === a.papel)?.identidade.nome ?? "Participante a conferir" })) } : null };
    });
  });
}
