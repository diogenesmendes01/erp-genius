"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ErroPermissao,
  ErroRegra,
  executarAcao,
  exigirSessaoComPapel,
  registrarEvento,
} from "@/server/_shared";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { DataCivilSchema } from "./cobertura";

const DataRelatoSchema = DataCivilSchema.refine(data => data >= "0001-01-01", "Data fora do intervalo persistível.");
const RegistrarRelatoSchema = z
  .object({
    matriculaId: z.string().min(1),
    inicio: DataRelatoSchema,
    fim: DataRelatoSchema.nullable().optional(),
    motivo: z.string().trim().min(5).max(2000),
    evidenciaTexto: z.string().trim().min(5).max(4000),
    chaveIdempotencia: z.string().trim().min(8).max(100),
  })
  .strict()
  .refine((dados) => !dados.fim || dados.inicio <= dados.fim, {
    message: "O fim do relato não pode ser anterior ao início.",
    path: ["fim"],
  });

const ConsultarRelatosSchema = z
  .object({
    matriculaId: z.string().min(1),
    pagina: z.number().int().min(1).max(100_000).default(1),
  })
  .strict();

function dataUtc(data: string): Date {
  return new Date(`${data}T00:00:00.000Z`);
}

function podeRegistrar(papeis: Papel[]): boolean {
  return papeis.some(
    (papel) =>
      papel === Papel.SECRETARIA_ACADEMICA ||
      papel === Papel.GERENTE_PEDAGOGICO ||
      papel === Papel.ADMINISTRADOR,
  );
}

function podeConsultar(papeis: Papel[]): boolean {
  return podeRegistrar(papeis) || papeis.includes(Papel.FINANCEIRO);
}

async function conferirAutorAtual(
  tx: Prisma.TransactionClient,
  autorId: string,
  modo: "REGISTRAR" | "CONSULTAR",
) {
  if (modo === "REGISTRAR") {
    await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  }
  const autor = await tx.usuario.findUnique({
    where: { id: autorId },
    select: { ativo: true, papeis: true },
  });
  if (!autor?.ativo || !(modo === "REGISTRAR" ? podeRegistrar(autor.papeis) : podeConsultar(autor.papeis))) {
    throw new ErroPermissao();
  }
  return autor;
}

function projetarRelato(relato: {
  id: string;
  inicio: Date;
  fim: Date | null;
  motivo: string;
  evidenciaTexto: string;
  criadaEm: Date;
}) {
  return {
    id: relato.id,
    inicio: relato.inicio.toISOString().slice(0, 10),
    fim: relato.fim?.toISOString().slice(0, 10) ?? null,
    motivo: relato.motivo,
    evidenciaTexto: relato.evidenciaTexto,
    criadaEm: relato.criadaEm.toISOString(),
  };
}

/** Registra um relato imutável. Relatar não confirma indisponibilidade nem altera cobranças. */
export async function registrarRelatoIndisponibilidadeOferta(
  input: z.input<typeof RegistrarRelatoSchema>,
) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(
      Papel.SECRETARIA_ACADEMICA,
      Papel.GERENTE_PEDAGOGICO,
      Papel.ADMINISTRADOR,
    );
    const dados = RegistrarRelatoSchema.parse(input);
    const entrada = { ...dados, fim: dados.fim ?? null };
    const entradaHash = hashSubstituicao(entrada);

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [dados.matriculaId]);
      const matricula = await tx.matricula.findUnique({
        where: { id: dados.matriculaId },
        select: { id: true },
      });
      if (!matricula) {
        throw new ErroRegra("Matrícula não encontrada.");
      }
      await conferirAutorAtual(tx, sessao.id, "REGISTRAR");

      const repetido = await tx.registroIndisponibilidadeOfertaMatricula.findUnique({
        where: {
          autorId_chaveIdempotencia: {
            autorId: sessao.id,
            chaveIdempotencia: dados.chaveIdempotencia,
          },
        },
      });
      if (repetido) {
        if (repetido.entradaHash !== entradaHash) {
          throw new ErroRegra("Chave de idempotência já usada para outro relato.");
        }
        return projetarRelato(repetido);
      }

      const relato = await tx.registroIndisponibilidadeOfertaMatricula.create({
        data: {
          matriculaId: matricula.id,
          inicio: dataUtc(dados.inicio),
          fim: dados.fim ? dataUtc(dados.fim) : null,
          motivo: dados.motivo,
          evidenciaTexto: dados.evidenciaTexto,
          autorId: sessao.id,
          chaveIdempotencia: dados.chaveIdempotencia,
          entradaHash,
        },
      });
      await registrarEvento(tx, {
        tipo: "RelatoIndisponibilidadeOfertaRegistrado",
        agregadoTipo: "Matricula",
        agregadoId: matricula.id,
        autorId: sessao.id,
        payload: {
          relatoId: relato.id,
          inicio: dados.inicio,
          fim: dados.fim ?? null,
        },
      });
      return projetarRelato(relato);
    }, { timeout: 20_000 });
  });
}

/** Histórico limitado para a equipe; não projeta aluno, pagador ou dados de contrato. */
export async function consultarRelatosIndisponibilidadeOferta(
  input: z.input<typeof ConsultarRelatosSchema>,
) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(
      Papel.SECRETARIA_ACADEMICA,
      Papel.GERENTE_PEDAGOGICO,
      Papel.FINANCEIRO,
      Papel.ADMINISTRADOR,
    );
    const dados = ConsultarRelatosSchema.parse(input);

    return prisma.$transaction(async (tx) => {
      const autor = await conferirAutorAtual(tx, sessao.id, "CONSULTAR");
      const matricula = await tx.matricula.findUnique({
        where: { id: dados.matriculaId },
        select: { id: true },
      });
      if (!matricula) {
        throw new ErroRegra("Matrícula não encontrada.");
      }

      const relatos = await tx.registroIndisponibilidadeOfertaMatricula.findMany({
        where: { matriculaId: matricula.id },
        orderBy: [{ criadaEm: "desc" }, { id: "desc" }],
        skip: (dados.pagina - 1) * 20,
        take: 21,
        select: {
          id: true,
          autorId: true,
          inicio: true,
          fim: true,
          motivo: true,
          evidenciaTexto: true,
          criadaEm: true,
          propostasTermino: {
            where: { decisao: { is: { aprovada: true } } },
            take: 1,
            select: { id: true, fim: true },
          },
          confirmacao: {
            select: {
              id: true,
              confirmada: true,
              motivo: true,
              evidenciaTexto: true,
              confirmadaEm: true,
            },
          },
        },
      });
      return {
        pagina: dados.pagina,
        podeRegistrar: podeRegistrar(autor.papeis),
        temProxima: relatos.length > 20,
        relatos: relatos.slice(0, 20).map((relato) => ({
          ...projetarRelato(relato),
          terminoAprovado: relato.propostasTermino[0]
            ? { propostaId: relato.propostasTermino[0].id, fim: relato.propostasTermino[0].fim.toISOString().slice(0, 10) }
            : null,
          confirmacao: relato.confirmacao
            ? {
                id: relato.confirmacao.id,
                confirmada: relato.confirmacao.confirmada,
                motivo: relato.confirmacao.motivo,
                evidenciaTexto: relato.confirmacao.evidenciaTexto,
                confirmadaEm: relato.confirmacao.confirmadaEm.toISOString(),
              }
            : null,
          podeConfirmar:
            relato.confirmacao === null &&
            relato.autorId !== sessao.id &&
            autor.papeis.some(
              (papel) =>
                papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR,
            ),
        })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
