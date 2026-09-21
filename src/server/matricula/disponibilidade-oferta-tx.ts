import { Prisma } from "@prisma/client";
import { z } from "zod";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { DataCivilSchema } from "./cobertura";
import { carregarComprovacaoOfertaContinuidadeAgendaTx } from "./oferta-continuidade-agenda-tx";

const Entrada = z.object({ matriculaId: z.string().min(1), inicio: DataCivilSchema, fim: DataCivilSchema }).strict().refine((d) => d.inicio <= d.fim);
const civil = (data: Date) => data.toISOString().slice(0, 10);
const dataUtc = (data: string) => new Date(`${data}T00:00:00.000Z`);

export async function capturarFonteDisponibilidadeOfertaTx(tx: Prisma.TransactionClient, dados: { matriculaId: string; inicio: Date; fim: Date }) {
  const calendarioVigente = await tx.versaoCalendarioEscolar.findFirst({
    where: { decisao: { aprovada: true } },
    orderBy: [{ versao: "desc" }, { id: "desc" }],
    select: { id: true, versao: true },
  });
  const indisponibilidades = await tx.registroIndisponibilidadeOfertaMatricula.findMany({ where: { matriculaId: dados.matriculaId, inicio: { lte: dados.fim }, OR: [{ fim: { gte: dados.inicio } }, { fim: null, propostasTermino: { none: { decisao: { is: { aprovada: true } } } } }, { fim: null, propostasTermino: { some: { fim: { gte: dados.inicio }, decisao: { is: { aprovada: true } } } } }] }, orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true, fim: true, entradaHash: true, confirmacao: { select: { id: true, confirmada: true, entradaHash: true } }, propostasTermino: { where: { decisao: { is: { aprovada: true } } }, orderBy: { id: "asc" }, take: 1, select: { id: true, fim: true, decisao: { select: { id: true, entradaHash: true } } } } } });
  const agenda = await carregarComprovacaoOfertaContinuidadeAgendaTx(tx, { matriculaId: dados.matriculaId, inicio: dados.inicio, fim: dados.fim });
  return { matriculaId: dados.matriculaId, inicio: civil(dados.inicio), fim: civil(dados.fim), calendarioVigente: calendarioVigente ? { id: calendarioVigente.id, versao: calendarioVigente.versao } : null, indisponibilidades: indisponibilidades.map((registro) => ({ id: registro.id, inicio: civil(registro.inicio), fim: civil(registro.fim ?? registro.propostasTermino[0]?.fim ?? new Date("9999-12-31T00:00:00.000Z")), entradaHash: registro.entradaHash, confirmacao: registro.confirmacao ? { id: registro.confirmacao.id, confirmada: registro.confirmacao.confirmada, entradaHash: registro.confirmacao.entradaHash } : null, termino: registro.propostasTermino[0] ? { id: registro.propostasTermino[0].id, fim: civil(registro.propostasTermino[0].fim), decisaoId: registro.propostasTermino[0].decisao!.id, entradaHash: registro.propostasTermino[0].decisao!.entradaHash } : null })), agenda };
}

export function temFonteNegativaDisponibilidade(origem: Awaited<ReturnType<typeof capturarFonteDisponibilidadeOfertaTx>>) {
  return origem.indisponibilidades.some((registro) => registro.confirmacao === null || registro.confirmacao.confirmada);
}

/** Não soma intervalos: uma versão atual aprovada deve cobrir o período inteiro. */
export async function conferirDisponibilidadeOfertaTx(tx: Prisma.TransactionClient, input: z.input<typeof Entrada>) {
  const dados = Entrada.parse(input), inicio = dataUtc(dados.inicio), fim = dataUtc(dados.fim);
  const atual = await capturarFonteDisponibilidadeOfertaTx(tx, { matriculaId: dados.matriculaId, inicio, fim });
  if (temFonteNegativaDisponibilidade(atual)) return { disponivel: false as const, consumivel: false as const, motivo: "Há indisponibilidade relatada pendente ou confirmada para o período.", aprovacao: null };
  const todas = await tx.propostaDisponibilidadeOfertaMatricula.findMany({ where: { matriculaId: dados.matriculaId, inicio: { lte: inicio }, fim: { gte: fim } }, orderBy: [{ inicio: "asc" }, { fim: "asc" }, { versao: "desc" }], include: { decisao: true } });
  const atuais = todas.filter((proposta) => !todas.some((outra) => outra.inicio.getTime() === proposta.inicio.getTime() && outra.fim.getTime() === proposta.fim.getTime() && outra.versao > proposta.versao));
  const candidatas = atuais.filter((proposta) => proposta.decisao?.aprovada === true);
  for (const proposta of candidatas) {
    const fonte = await capturarFonteDisponibilidadeOfertaTx(tx, proposta);
    if (proposta.origemHash === hashSubstituicao(fonte)) return { disponivel: true as const, consumivel: true as const, motivo: "Oferta confirmada para o período; este estado ainda não emite cobrança.", aprovacao: { id: proposta.id, inicio: civil(proposta.inicio), fim: civil(proposta.fim), versao: proposta.versao, decididaEm: proposta.decisao!.decididaEm.toISOString() } };
  }
  return { disponivel: false as const, consumivel: false as const, motivo: candidatas.length ? "A fonte de indisponibilidade ou a agenda mudou; prepare nova versão." : "Não há uma aprovação única atual que cubra todo o período.", aprovacao: null };
}
