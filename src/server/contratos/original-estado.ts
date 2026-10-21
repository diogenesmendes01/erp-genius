import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { carregarBasePrevia, hashPrevia } from "./previa-estado";
import { ConferirParticipantesSchema, IdentidadeSignatarioSchema } from "./participantes-schema";
const Campos = ConferirParticipantesSchema.innerType().shape;
const Snapshot = z.object({ previaHash: z.string(), identificacoesConferidas: z.literal(true), maioridade: Campos.maioridade,
  participantes: z.array(Campos.participantes.element.extend({ etapa: z.enum(["CLIENTE", "ESCOLA"]), origem: z.enum(["ALUNO", "PAGADOR", "REPRESENTANTE_CONFERIDO"]) })),
  documentos: z.array(z.object({ id: z.string(), nome: z.string(), url: z.string(), categoria: z.string() })),
});
export async function conferirBaseOriginalAtual(tx: Prisma.TransactionClient,
  previa: { id: string; matriculaId: string; modeloId: string; conteudoHash: string },
  conferencia: { snapshot: Prisma.JsonValue }) {
      const m = await tx.matricula.findUniqueOrThrow({ where: { id: previa.matriculaId }, select: { alunoId: true, leadId: true } });
      await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${m.alunoId} FOR SHARE`;
      const base = await carregarBasePrevia(tx, previa.matriculaId, previa.modeloId);
      if (base.revisaoHash !== previa.conteudoHash) throw new ErroRegra("A prévia está desatualizada. Revise os dados antes de gerar o original.");
      const s = Snapshot.parse(conferencia.snapshot);
      if (s.previaHash !== previa.conteudoHash) throw new ErroRegra("Conferência incompatível com o conteúdo.");
      const aluno = await tx.aluno.findUniqueOrThrow({ where: { id: m.alunoId }, select: { primeiroNome: true, sobrenome: true, email: true, documento: true } });
      const pagador = await tx.pagadorPreparacaoMatricula.findUniqueOrThrow({ where: { id: base.snapshot.pagadorRegistroId } });
      for (const p of s.participantes) {
        const dados = p.origem === "ALUNO" ? { nome: [aluno.primeiroNome, aluno.sobrenome].filter(Boolean).join(" "), email: aluno.email, documento: aluno.documento } : p.origem === "PAGADOR" ? pagador.dados : null;
        if (dados && hashPrevia(IdentidadeSignatarioSchema.strip().parse(dados)) !== hashPrevia(p.identidade)) throw new ErroRegra("A identificação dos signatários mudou. Confira novamente os participantes.");
      }
      const ids = s.documentos.map((v) => v.id).sort();
      if (ids.length) await tx.$queryRaw`SELECT id FROM "Documento" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`;
      const documentos = await tx.documento.findMany({ where: { id: { in: ids }, arquivado: false,
        OR: [{ matriculaId: previa.matriculaId }, ...(m.leadId ? [{ matriculaId: null, leadId: m.leadId }] : [])] }, select: { id: true, nome: true, url: true, categoria: true } });
      if (documentos.length !== ids.length || s.documentos.some((v) => hashPrevia(v) !== hashPrevia(documentos.find((a) => a.id === v.id)))) throw new ErroRegra("As evidências dos participantes mudaram ou estão indisponíveis. Confira novamente.");
  return { base, participantes: s.participantes };
}
