import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";

const EntradaApuracaoSchema = z
  .object({
    matriculaId: z.string().min(1),
    inicio: z.date(),
    fim: z.date(),
  })
  .strict();

const DiaMs = 86_400_000;

function conferirDataCivil(data: Date): void {
  if (
    !Number.isFinite(data.getTime()) ||
    data.getUTCHours() !== 0 ||
    data.getUTCMinutes() !== 0 ||
    data.getUTCSeconds() !== 0 ||
    data.getUTCMilliseconds() !== 0
  ) {
    throw new ErroRegra("A apuração de indisponibilidade exige datas civis UTC.");
  }
  const ano = data.getUTCFullYear();
  if (ano < 1 || ano > 9_999) {
    throw new ErroRegra("A apuração de indisponibilidade exige datas entre 0001 e 9999.");
  }
}

function diaCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function somarDia(data: Date): Date {
  const proximo = new Date(data);
  proximo.setUTCDate(proximo.getUTCDate() + 1);
  return proximo;
}

/**
 * Apura dias confirmados sem consultar a projeção limitada da UI. Términos
 * aprovados encurtam relatos originalmente abertos, mas não escrevem nada.
 */
export async function apurarDiasIndisponibilidadeCoberturaTx(
  tx: Prisma.TransactionClient,
  input: z.input<typeof EntradaApuracaoSchema>,
) {
  const dados = EntradaApuracaoSchema.parse(input);
  conferirDataCivil(dados.inicio);
  conferirDataCivil(dados.fim);
  if (dados.fim < dados.inicio) {
    throw new ErroRegra("Intervalo de apuração de indisponibilidade inválido.");
  }
  const totalDias = (dados.fim.getTime() - dados.inicio.getTime()) / DiaMs + 1;
  if (!Number.isInteger(totalDias) || totalDias > 366) {
    throw new ErroRegra("A apuração de indisponibilidade aceita no máximo 366 dias civis.");
  }

  const matricula = await tx.matricula.findUnique({
    where: { id: dados.matriculaId },
    select: { id: true },
  });
  if (!matricula) {
    throw new ErroRegra("Matrícula não encontrada.");
  }

  const relatos = await tx.registroIndisponibilidadeOfertaMatricula.findMany({
    where: {
      matriculaId: matricula.id,
      inicio: { lte: dados.fim },
      confirmacao: { is: { confirmada: true } },
      OR: [{ fim: null }, { fim: { gte: dados.inicio } }],
    },
    orderBy: [{ inicio: "asc" }, { id: "asc" }],
    take: 1_001,
    select: {
      inicio: true,
      fim: true,
      propostasTermino: {
        where: { decisao: { is: { aprovada: true } } },
        orderBy: [{ criadaEm: "asc" }, { id: "asc" }],
        take: 2,
        select: { fim: true },
      },
    },
  });
  if (relatos.length > 1_000) {
    throw new ErroRegra("Há mais de 1000 relatos para esta apuração; faça conferência específica sem autorizar cálculo parcial.");
  }

  const dias = new Set<string>();
  for (const relato of relatos) {
    conferirDataCivil(relato.inicio);
    if (relato.propostasTermino.length > 1) {
      throw new ErroRegra("O relato possui mais de um término aprovado e precisa de conferência específica.");
    }
    const fimEfetivo = relato.propostasTermino[0]?.fim ?? relato.fim ?? dados.fim;
    if (fimEfetivo < dados.inicio) {
      continue;
    }
    conferirDataCivil(fimEfetivo);
    if (fimEfetivo < relato.inicio) {
      throw new ErroRegra("O relato confirmado possui término anterior ao próprio início.");
    }
    const inicioClipado = relato.inicio > dados.inicio ? relato.inicio : dados.inicio;
    const fimClipado = fimEfetivo < dados.fim ? fimEfetivo : dados.fim;
    for (let dia = new Date(inicioClipado); dia <= fimClipado; dia = somarDia(dia)) {
      dias.add(diaCivil(dia));
    }
  }

  const diasConfirmados = [...dias].sort();
  return {
    diasConfirmados,
    classificacao:
      diasConfirmados.length === 0
        ? ("NENHUMA" as const)
        : diasConfirmados.length === totalDias
          ? ("INTEGRAL" as const)
          : ("PARCIAL" as const),
    totalDias,
  };
}
