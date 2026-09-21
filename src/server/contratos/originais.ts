"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { conferirAutor } from "./modelos-tx";
import { hashPrevia } from "./previa-estado";
import { conferirBaseOriginalAtual } from "./original-estado";
import { gerarPdfOriginal } from "./pdf-previa";
import { TextoPreviaSchema } from "./previa-projecao";

const Gerar = z.object({ previaId: z.string().min(1), conferenciaId: z.string().min(1), motivo: z.string().trim().min(5).max(2000), conteudoConferido: z.literal(true) }).strict();
const metadados = { id: true, previaId: true, conferenciaId: true, pdfHash: true, baseHash: true, gerador: true, paginas: true, criadoEm: true, motivo: true } satisfies Prisma.ArtefatoContratualSelect;

/** Uma conferência gera um único original; repetição devolve a referência preservada. */
export async function preservarOriginalContratual(input: z.input<typeof Gerar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Gerar.parse(input);
    const resultado = await prisma.$transaction(async (tx) => {
      const previa = await tx.previaDocumentoContratual.findUnique({ where: { id: d.previaId } });
      if (!previa) throw new ErroRegra("Prévia não encontrada.");
      await bloquearMatriculas(tx, [previa.matriculaId]); await conferirAutor(tx, autor.id);
      const conferencia = await tx.conferenciaParticipantesContratuais.findUnique({ where: { id: d.conferenciaId } });
      if (!conferencia || conferencia.previaId !== previa.id) throw new ErroRegra("Conferência não pertence à prévia.");
      const anterior = await tx.artefatoContratual.findUnique({ where: { conferenciaId: conferencia.id }, select: metadados });
      if (anterior) return { registro: anterior };
      const ultima = await tx.conferenciaParticipantesContratuais.findFirst({ where: { previaId: previa.id }, orderBy: { versao: "desc" }, select: { id: true } });
      if (ultima?.id !== conferencia.id) throw new ErroRegra("Há outra conferência de participantes. Atualize a revisão.");
      await conferirBaseOriginalAtual(tx, previa, conferencia);
      // Nova conferência dos mesmos dados não deve criar outra versão binária.
      const baseHash = hashPrevia({ previaHash: previa.conteudoHash, conferencia: conferencia.snapshot });
      const equivalente = await tx.artefatoContratual.findFirst({ where: { previaId: previa.id, baseHash }, select: metadados });
      if (equivalente) return { registro: equivalente };
      let pdf;
      try {
        pdf = await gerarPdfOriginal({ previaId: previa.id, criadaEm: conferencia.criadaEm, conteudoHash: baseHash, snapshot: TextoPreviaSchema.parse(previa.snapshot) });
        if (pdf.bytes.length > 10485760) throw new Error("Limite de armazenamento");
      } catch {
        await registrarEvento(tx, { tipo: "GeracaoOriginalContratualFalhou", agregadoTipo: "Matricula", agregadoId: previa.matriculaId, autorId: autor.id,
          payload: { previaId: previa.id, conferenciaId: conferencia.id, baseHash } });
        return { erro: "Não foi possível gerar o PDF completo. Nenhum original foi liberado; a falha foi registrada para conferência." };
      }
      const registro = await tx.artefatoContratual.create({ data: { previaId: previa.id, conferenciaId: conferencia.id, pdf: pdf.bytes, pdfHash: pdf.sha256,
        baseHash, gerador: pdf.gerador, paginas: pdf.paginas, autorId: autor.id, motivo: d.motivo }, select: metadados });
      await registrarEvento(tx, { tipo: "OriginalContratualPreservado", agregadoTipo: "Matricula", agregadoId: previa.matriculaId, autorId: autor.id,
        payload: { artefatoId: registro.id, previaId: previa.id, conferenciaId: conferencia.id, pdfHash: pdf.sha256, baseHash } });
      return { registro };
    }, { timeout: 30000 });
    if (resultado.erro) throw new ErroRegra(resultado.erro);
    return resultado.registro!;
  });
}

export async function consultarOriginaisContratuais(input: { previaId: string; pagina?: number }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ previaId: z.string().min(1), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    const registros = await prisma.artefatoContratual.findMany({ where: { previaId: d.previaId }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], skip: (d.pagina - 1) * 20, take: 21, select: metadados });
    const conferencia = await prisma.conferenciaParticipantesContratuais.findFirst({ where: { previaId: d.previaId }, orderBy: { versao: "desc" }, select: { id: true, versao: true, snapshot: true, previa: { select: { conteudoHash: true } } } });
    const conferenciaJaPreservada = conferencia ? Boolean(await prisma.artefatoContratual.findFirst({ where: { previaId: d.previaId,
      baseHash: hashPrevia({ previaHash: conferencia.previa.conteudoHash, conferencia: conferencia.snapshot }) }, select: { id: true } })) : false;
    return { registros: registros.slice(0, 20), conferencia: conferencia ? { id: conferencia.id, versao: conferencia.versao } : null, conferenciaJaPreservada, pagina: d.pagina, temProxima: registros.length > 20 };
  });
}

/** Leitura interna de bytes, usada pela rota autenticada; não regenerar um original. */
export async function consultarPdfOriginal(input: { matriculaId: string; artefatoId: string }) {
  await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
  const d = z.object({ matriculaId: z.string().min(1), artefatoId: z.string().min(1) }).strict().parse(input);
  const a = await prisma.artefatoContratual.findFirst({ where: { id: d.artefatoId, previa: { matriculaId: d.matriculaId } }, select: { id: true, pdf: true, pdfHash: true } });
  if (!a) return null;
  if (createHash("sha256").update(a.pdf).digest("hex") !== a.pdfHash) throw new ErroRegra("Integridade do original divergente. Solicite conferência; o arquivo não será regenerado.");
  return a;
}
