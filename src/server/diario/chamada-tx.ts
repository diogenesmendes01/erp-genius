import type { Prisma } from "@prisma/client";
import { nomeCompleto } from "@/lib/nome";
import { carregarSituacoesNaAula } from "./historico-contratual";
import { alocacaoCobreAula, alunosComVinculosSobrepostos } from "./alocacoes";

export async function carregarChamadaTx(tx: Prisma.TransactionClient, turmaId: string, instante: Date) {
  // A importação pode ocorrer após a aula: a vigência, e não criadoEm, é a âncora.
  // Vínculos sem proveniência conservam integralmente o predicado legado.
  const candidatas = await tx.alocacaoTurma.findMany({ where: { turmaId, OR: [
    { provenienciaVinculo: "MIGRACAO", matriculaId: { not: null } },
    { provenienciaVinculo: null, criadoEm: { lte: instante }, AND: [
      { OR: [{ encerradaEm: { gt: instante } }, { encerradaEm: null, ativa: true }] },
      { OR: [{ matriculaId: null, aluno: { status: "ATIVO" } }, { matriculaId: { not: null } }] },
    ] },
  ] }, select: {
    alunoId: true, matriculaId: true, criadoEm: true, encerradaEm: true, ativa: true,
    provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true,
    aluno: { select: { primeiroNome: true, sobrenome: true } },
  } });
  const alocacoes = candidatas.filter((a) => alocacaoCobreAula(a, instante));
  const situacoes = await carregarSituacoesNaAula(tx, alocacoes.flatMap((a) => a.matriculaId ? [a.matriculaId] : []), instante);
  const alunos = new Map<string, { alunoId: string; nomeAluno: string }>();
  const ambiguos = alunosComVinculosSobrepostos(alocacoes);
  let exigeConferencia = ambiguos.size > 0;
  for (const a of alocacoes) {
    if (ambiguos.has(a.alunoId)) continue;
    const situacao = a.matriculaId ? situacoes.get(a.matriculaId) : "ATIVA";
    if (!situacao || situacao === "A_CONFERIR") exigeConferencia = true;
    if (situacao === "ATIVA") alunos.set(a.alunoId, { alunoId: a.alunoId, nomeAluno: nomeCompleto(a.aluno) });
  }
  return { alunos: [...alunos.values()].sort((a, b) => a.nomeAluno.localeCompare(b.nomeAluno)), exigeConferencia };
}
