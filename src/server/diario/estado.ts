import { createHash } from "node:crypto";

/** Inclui conteúdo e chamada para detectar mudanças mesmo com timestamps iguais. */
export function estadoDiario(diario: { id: string; conteudo: string; atualizadoEm: Date;
  registros: { alunoId: string; nomeAluno: string; presente: boolean | null; observacao: string | null; matriculaId?: string | null; participacao?: string | null }[] }) {
  return createHash("sha256").update(JSON.stringify({ id: diario.id, conteudo: diario.conteudo,
    atualizadoEm: diario.atualizadoEm.toISOString(), registros: [...diario.registros].sort((a, b) => a.alunoId.localeCompare(b.alunoId))
      .map((r) => ({ alunoId: r.alunoId, nomeAluno: r.nomeAluno, presente: r.presente, observacao: r.observacao,
        ...(r.matriculaId ? { matriculaId: r.matriculaId, participacao: r.participacao ?? null } : {}) })),
  })).digest("hex");
}
