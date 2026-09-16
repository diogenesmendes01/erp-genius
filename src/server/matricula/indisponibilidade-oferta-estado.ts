import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";

const EntradaEstadoSchema = z
  .object({
    matriculaId: z.string().min(1),
    inicio: z.date(),
    fim: z.date(),
  })
  .strict();

function validarDataCivil(data: Date): void {
  if (
    !Number.isFinite(data.getTime()) ||
    data.getUTCHours() !== 0 ||
    data.getUTCMinutes() !== 0 ||
    data.getUTCSeconds() !== 0 ||
    data.getUTCMilliseconds() !== 0
  ) {
    throw new ErroRegra("A consulta de indisponibilidade exige datas civis UTC.");
  }
  const ano = data.getUTCFullYear();
  if (ano < 1 || ano > 9_999) {
    throw new ErroRegra("A consulta de indisponibilidade exige datas persistíveis entre 0001 e 9999.");
  }
}

/**
 * Consulta relatos pendentes e decisões. SEM_RELATO não prova que a oferta esteve
 * disponível; efeitos financeiros e de cobertura pertencem a outro fluxo.
 */
export async function conferirIndisponibilidadeOfertaTx(
  tx: Prisma.TransactionClient,
  input: z.input<typeof EntradaEstadoSchema>,
) {
  const dados = EntradaEstadoSchema.parse(input);
  validarDataCivil(dados.inicio);
  validarDataCivil(dados.fim);
  if (dados.fim < dados.inicio) {
    throw new ErroRegra("Intervalo de consulta de indisponibilidade inválido.");
  }

  const matricula = await tx.matricula.findUnique({
    where: { id: dados.matriculaId },
    select: { id: true },
  });
  if (!matricula) {
    throw new ErroRegra("Matrícula não encontrada.");
  }

  const sobreposicao: Prisma.RegistroIndisponibilidadeOfertaMatriculaWhereInput = {
    matriculaId: matricula.id,
    inicio: { lte: dados.fim },
    OR: [
      { fim: { gte: dados.inicio } },
      { fim: null, propostasTermino: { none: { decisao: { is: { aprovada: true } } } } },
      { fim: null, propostasTermino: { some: { fim: { gte: dados.inicio }, decisao: { is: { aprovada: true } } } } },
    ],
  };
  // A existência é consultada separadamente da projeção limitada: registros
  // antigos jamais podem ocultar uma confirmação positiva posterior.
  const [positivo, pendente, projetados] = await Promise.all([
    tx.registroIndisponibilidadeOfertaMatricula.findFirst({
      where: { ...sobreposicao, confirmacao: { is: { confirmada: true } } },
      select: { id: true },
    }),
    tx.registroIndisponibilidadeOfertaMatricula.findFirst({
      where: { ...sobreposicao, confirmacao: { is: null } },
      select: { id: true },
    }),
    tx.registroIndisponibilidadeOfertaMatricula.findMany({
      where: { ...sobreposicao, confirmacao: { is: { confirmada: true } } },
    orderBy: [{ inicio: "asc" }, { id: "asc" }],
      take: 21,
    select: {
      id: true,
      inicio: true,
      fim: true,
      propostasTermino: {
        where: { decisao: { is: { aprovada: true } } },
        take: 1,
        select: { id: true, fim: true },
      },
      confirmacao: {
        select: {
          id: true,
          confirmada: true,
          confirmadaEm: true,
        },
      },
    },
    }),
  ]);

  return {
    estado:
      positivo
        ? ("INDISPONIVEL" as const)
        : pendente
          ? ("PENDENTE_CONFERENCIA" as const)
          : ("SEM_RELATO" as const),
    temMais: projetados.length > 20,
    registros: projetados.slice(0, 20).map((relato) => ({
      id: relato.id,
      inicio: relato.inicio.toISOString().slice(0, 10),
      fim: (relato.propostasTermino[0]?.fim ?? relato.fim)?.toISOString().slice(0, 10) ?? null,
      fimOriginal: relato.fim?.toISOString().slice(0, 10) ?? null,
      terminoPropostaId: relato.propostasTermino[0]?.id ?? null,
      confirmacaoId: relato.confirmacao!.id,
      confirmadaEm: relato.confirmacao!.confirmadaEm.toISOString(),
    })),
  };
}
