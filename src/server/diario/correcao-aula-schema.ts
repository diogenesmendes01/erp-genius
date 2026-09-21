import { createHash } from "node:crypto";
import { z } from "zod";

const participacao = z.enum(["PRESENTE", "FALTA", "IMPEDIDO_POR_RESTRICAO"]);
const observacao = z.string().trim().max(3000).nullable().transform(v => v || null);
export const alteracaoAulaSchema = z.object({
  conteudo: z.string().trim().min(1).max(20000),
  registros: z.array(z.object({ registroId: z.string().min(1), participacao, observacao }).strict()).min(1).max(1000),
}).strict();
export const propostaCorrecaoAulaSchema = z.object({
  encontroId: z.string().min(1), estadoHash: z.string().regex(/^[a-f0-9]{64}$/),
  versaoEsperada: z.number().int().nonnegative().safe(), alteracao: alteracaoAulaSchema,
  motivo: z.string().trim().min(5).max(3000), evidencia: z.string().trim().min(5).max(3000),
  chaveIdempotencia: z.string().min(8).max(100),
}).strict();

export type SnapshotCorrecaoAula = {
  versao: 1; encontroId: string; diarioId: string; conteudo: string;
  registros: { registroId: string; alunoId: string; matriculaId: string; nomeAluno: string;
    presente: boolean; participacao: z.infer<typeof participacao>; observacao: string | null }[];
  gravacao: { tipo: "EXCECAO"; decisaoId: string } | { tipo: "OFICIAL"; publicacaoId: string } | null;
};

export const snapshotCorrecaoAulaSchema = z.object({
  versao: z.literal(1), encontroId: z.string().min(1), diarioId: z.string().min(1), conteudo: z.string().min(1),
  registros: z.array(z.object({ registroId: z.string().min(1), alunoId: z.string().min(1), matriculaId: z.string().min(1),
    nomeAluno: z.string(), presente: z.boolean(), participacao, observacao: z.string().nullable() }).strict()
    .refine(r => r.presente === (r.participacao === "PRESENTE"), "Presença incompatível com classificação")).min(1),
  gravacao: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("EXCECAO"), decisaoId: z.string().min(1) }).strict(),
    z.object({ tipo: z.literal("OFICIAL"), publicacaoId: z.string().min(1) }).strict(),
  ]).nullable(),
}).strict();

export function hashCorrecaoAula(valor: unknown) {
  return createHash("sha256").update(JSON.stringify(valor)).digest("hex");
}

/** A entrada não recebe identidades de aluno/contrato nem cria registros. */
export function prepararSnapshotCorrecaoAula(anterior: SnapshotCorrecaoAula, entrada: z.input<typeof alteracaoAulaSchema>): SnapshotCorrecaoAula {
  const d = alteracaoAulaSchema.parse(entrada);
  const porId = new Map(d.registros.map(r => [r.registroId, r]));
  if (porId.size !== d.registros.length || porId.size !== anterior.registros.length
    || anterior.registros.some(r => !porId.has(r.registroId))) {
    throw new Error("A correção deve identificar exatamente os registros da chamada original, sem duplicar, omitir ou incluir alunos.");
  }
  return { ...anterior, conteudo: d.conteudo, registros: anterior.registros.map(r => {
    const novo = porId.get(r.registroId)!;
    return { ...r, participacao: novo.participacao, presente: novo.participacao === "PRESENTE", observacao: novo.observacao };
  }) };
}
