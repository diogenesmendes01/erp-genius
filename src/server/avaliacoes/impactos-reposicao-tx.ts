import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import type { ImpactoMudancaProgressao } from "./impactos-progressao-tx";

export type ImpactosCorrecaoReposicao = {
  matriculaId: string;
  nivelId: string;
  alocacaoFonteId: string;
  impactos: ImpactoMudancaProgressao[];
};

/**
 * Q54/Q154: a frequência do nível inclui todos os vínculos conferidos da
 * mesma matrícula e nível, mesmo quando a troca de turma não teve
 * equivalência de notas. Este coletor reproduz esse escopo; não usa uma
 * cadeia de aplicações de equivalência como atalho.
 *
 * O vínculo da aula original é resolvido pelo mesmo intervalo semiaberto da
 * apuração de frequência. Para vínculos M01, a data técnica de criação é a
 * importação atual; a fonte é a vigência histórica semiaberta registrada.
 */
export async function carregarImpactosCorrecaoReposicaoTx(
  tx: Prisma.TransactionClient,
  entrada: { reposicaoId: string },
): Promise<ImpactosCorrecaoReposicao> {
  const reposicao = await tx.reposicaoIndividual.findUnique({
    where: { id: entrada.reposicaoId },
    select: {
      matriculaId: true,
      matricula: { select: { alunoId: true } },
      aulaOriginal: {
        select: { inicio: true, turmaId: true, turma: { select: { nivelId: true } } },
      },
    },
  });
  if (!reposicao?.aulaOriginal.turmaId || !reposicao.aulaOriginal.turma) {
    throw new ErroRegra("A aula original da reposição não possui turma e nível conferíveis.");
  }

  return carregarImpactosFrequenciaAulaTx(tx, {
    matriculaId: reposicao.matriculaId, alunoId: reposicao.matricula.alunoId,
    turmaId: reposicao.aulaOriginal.turmaId, nivelId: reposicao.aulaOriginal.turma.nivelId,
    inicio: reposicao.aulaOriginal.inicio,
  });
}

/** Compartilhado por Q23 e Q54: fonte conferida pelo chamador, sob lock da agenda. */
export async function carregarImpactosFrequenciaAulaTx(tx: Prisma.TransactionClient, fonte: {
  matriculaId: string; alunoId: string; turmaId: string; nivelId: string; inicio: Date;
}): Promise<ImpactosCorrecaoReposicao> {
  const reposicao = { matriculaId: fonte.matriculaId, matricula: { alunoId: fonte.alunoId } };
  const aula = fonte;
  const turmaId = fonte.turmaId;
  const nivelId = fonte.nivelId;
  const vinculos=await tx.$queryRaw<{id:string;ativa:boolean;criadoEm:Date;encerradaEm:Date|null;provenienciaVinculo:"MIGRACAO"|null;inicioVigencia:Date|null;fimVigencia:Date|null}[]>(Prisma.sql`SELECT id,ativa,"criadoEm","encerradaEm","provenienciaVinculo","inicioVigencia","fimVigencia" FROM "AlocacaoTurma" al WHERE al."matriculaId"=${reposicao.matriculaId} AND al."alunoId"=${reposicao.matricula.alunoId} AND al."turmaId"=${turmaId} AND alocacao_cobre_instante(al, ${aula.inicio}::timestamptz) ORDER BY id ASC`);
  if (vinculos.length !== 1) {
    throw new ErroRegra("A aula original não pertence a um único vínculo histórico conferido da matrícula.");
  }
  const vinculo = vinculos[0]!;
  const inicioVigente=vinculo.provenienciaVinculo==="MIGRACAO"?vinculo.inicioVigencia:vinculo.criadoEm;
  const fimVigente=vinculo.provenienciaVinculo==="MIGRACAO"?(vinculo.fimVigencia??vinculo.encerradaEm):vinculo.encerradaEm;
  if (!inicioVigente || (!vinculo.ativa && !fimVigente)
    || (fimVigente && fimVigente <= inicioVigente)) {
    throw new ErroRegra("O vínculo histórico da aula original não possui intervalo conferível.");
  }

  const impactos = await tx.solicitacaoMudancaAcademica.findMany({
    where: {
      matriculaId: reposicao.matriculaId,
      status: { in: ["APROVADA", "EXECUTADA"] },
      alocacaoOrigem: {
        matriculaId: reposicao.matriculaId,
        alunoId: reposicao.matricula.alunoId,
        turma: { nivelId },
      },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      status: true,
      turmaDestinoId: true,
      decididoEm: true,
      executadoEm: true,
      alocacaoOrigem: { select: { matriculaId: true, alunoId: true, turma: { select: { nivelId: true } } } },
    },
  });

  return {
    matriculaId: reposicao.matriculaId,
    nivelId,
    alocacaoFonteId: vinculo.id,
    impactos: impactos.map((impacto) => {
      if ((impacto.status !== "APROVADA" && impacto.status !== "EXECUTADA")
        || impacto.alocacaoOrigem.matriculaId !== reposicao.matriculaId
        || impacto.alocacaoOrigem.alunoId !== reposicao.matricula.alunoId
        || impacto.alocacaoOrigem.turma.nivelId !== nivelId) {
        throw new ErroRegra("A solicitação de mudança não pertence ao escopo de frequência da reposição.");
      }
      return {
        id: impacto.id,
        status: impacto.status,
        turmaDestinoId: impacto.turmaDestinoId,
        decididoEm: impacto.decididoEm?.toISOString() ?? null,
        executadoEm: impacto.executadoEm?.toISOString() ?? null,
      };
    }),
  };
}
