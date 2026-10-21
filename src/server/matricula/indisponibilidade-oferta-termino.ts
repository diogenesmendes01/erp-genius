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

const DataPersistivelSchema = DataCivilSchema.refine(
  (data) => data >= "0001-01-01",
  "Data fora do intervalo persistível.",
);
const TextoMotivoSchema = z.string().trim().min(5).max(2_000);
const TextoEvidenciaSchema = z.string().trim().min(5).max(4_000);

const ProporTerminoSchema = z
  .object({
    registroId: z.string().min(1),
    fim: DataPersistivelSchema,
    motivo: TextoMotivoSchema,
    evidenciaTexto: TextoEvidenciaSchema,
    chaveIdempotencia: z.string().trim().min(8).max(100),
  })
  .strict();

const DecidirTerminoSchema = z
  .object({
    propostaId: z.string().min(1),
    aprovada: z.boolean(),
    motivo: TextoMotivoSchema,
    evidenciaTexto: TextoEvidenciaSchema,
  })
  .strict();

const ConsultarTerminosSchema = z
  .object({
    registroId: z.string().min(1),
    pagina: z.number().int().min(1).max(100_000).default(1),
  })
  .strict();

function dataUtc(data: string): Date {
  return new Date(`${data}T00:00:00.000Z`);
}

function dataCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function podePropor(papeis: Papel[]): boolean {
  return papeis.some(
    (papel) =>
      papel === Papel.SECRETARIA_ACADEMICA ||
      papel === Papel.GERENTE_PEDAGOGICO ||
      papel === Papel.ADMINISTRADOR,
  );
}

function podeDecidir(papeis: Papel[]): boolean {
  return papeis.includes(Papel.GERENTE_PEDAGOGICO) || papeis.includes(Papel.ADMINISTRADOR);
}

function podeConsultar(papeis: Papel[]): boolean {
  return podePropor(papeis) || papeis.includes(Papel.FINANCEIRO);
}

async function conferirAutorAtual(
  tx: Prisma.TransactionClient,
  autorId: string,
  acao: "PROPOR" | "DECIDIR" | "CONSULTAR",
) {
  if (acao !== "CONSULTAR") {
    await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  }
  const autor = await tx.usuario.findUnique({
    where: { id: autorId },
    select: { ativo: true, papeis: true },
  });
  const autorizado =
    acao === "PROPOR"
      ? podePropor(autor?.papeis ?? [])
      : acao === "DECIDIR"
        ? podeDecidir(autor?.papeis ?? [])
        : podeConsultar(autor?.papeis ?? []);
  if (!autor?.ativo || !autorizado) {
    throw new ErroPermissao();
  }
  return autor;
}

function projetarDecisao(decisao: {
  id: string;
  aprovada: boolean;
  motivo: string;
  evidenciaTexto: string;
  decididaEm: Date;
}) {
  return {
    id: decisao.id,
    aprovada: decisao.aprovada,
    motivo: decisao.motivo,
    evidenciaTexto: decisao.evidenciaTexto,
    decididaEm: decisao.decididaEm.toISOString(),
  };
}

function projetarProposta(proposta: {
  id: string;
  registroId: string;
  fim: Date;
  motivo: string;
  evidenciaTexto: string;
  criadaEm: Date;
  decisao?: {
    id: string;
    aprovada: boolean;
    motivo: string;
    evidenciaTexto: string;
    decididaEm: Date;
  } | null;
}) {
  return {
    id: proposta.id,
    registroId: proposta.registroId,
    fim: dataCivil(proposta.fim),
    motivo: proposta.motivo,
    evidenciaTexto: proposta.evidenciaTexto,
    criadaEm: proposta.criadaEm.toISOString(),
    decisao: proposta.decisao ? projetarDecisao(proposta.decisao) : null,
  };
}

function relatoPodeReceberTermino(relato: {
  inicio: Date;
  fim: Date | null;
  confirmacao: { confirmada: boolean } | null;
}): boolean {
  return relato.fim === null && relato.confirmacao?.confirmada === true;
}

function conferirFonteTermino(
  relato: {
    inicio: Date;
    fim: Date | null;
    confirmacao: { confirmada: boolean } | null;
  },
  fim: Date,
) {
  if (!relatoPodeReceberTermino(relato)) {
    throw new ErroRegra("O término exige um relato confirmado como indisponível e originalmente sem fim.");
  }
  if (fim < relato.inicio) {
    throw new ErroRegra("O fim proposto não pode ser anterior ao início do relato.");
  }
}

async function bloquearContextoRegistro(
  tx: Prisma.TransactionClient,
  registroId: string,
  matriculaId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [matriculaId]);
  await tx.$queryRaw`SELECT id FROM "RegistroIndisponibilidadeOfertaMatricula" WHERE id = ${registroId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "PropostaTerminoIndisponibilidadeOferta" WHERE "registroId" = ${registroId} FOR UPDATE`;
}

/** Propõe um término para relato positivo aberto; não altera o relato nem qualquer cobrança. */
export async function proporTerminoIndisponibilidadeOferta(
  input: z.input<typeof ProporTerminoSchema>,
) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(
      Papel.SECRETARIA_ACADEMICA,
      Papel.GERENTE_PEDAGOGICO,
      Papel.ADMINISTRADOR,
    );
    const dados = ProporTerminoSchema.parse(input);
    const entradaHash = hashSubstituicao(dados);
    const referencia = await prisma.registroIndisponibilidadeOfertaMatricula.findUnique({
      where: { id: dados.registroId },
      select: { matriculaId: true },
    });
    if (!referencia) {
      throw new ErroRegra("Relato de indisponibilidade não encontrado.");
    }

    return prisma.$transaction(async (tx) => {
      await bloquearContextoRegistro(tx, dados.registroId, referencia.matriculaId);
      const relato = await tx.registroIndisponibilidadeOfertaMatricula.findFirst({
        where: { id: dados.registroId, matriculaId: referencia.matriculaId },
        select: {
          id: true,
          matriculaId: true,
          inicio: true,
          fim: true,
          confirmacao: { select: { confirmada: true } },
        },
      });
      if (!relato) {
        throw new ErroRegra("Relato de indisponibilidade não encontrado nesta matrícula.");
      }
      await conferirAutorAtual(tx, sessao.id, "PROPOR");

      const repetida = await tx.propostaTerminoIndisponibilidadeOferta.findUnique({
        where: {
          autorId_chaveIdempotencia: {
            autorId: sessao.id,
            chaveIdempotencia: dados.chaveIdempotencia,
          },
        },
        include: { decisao: true },
      });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) {
          throw new ErroRegra("Chave de idempotência já usada para outra proposta de término.");
        }
        return projetarProposta(repetida);
      }

      conferirFonteTermino(relato, dataUtc(dados.fim));
      const propostaRelevante = await tx.propostaTerminoIndisponibilidadeOferta.findFirst({
        where: {
          registroId: relato.id,
          OR: [{ decisao: null }, { decisao: { is: { aprovada: true } } }],
        },
        select: { decisao: { select: { aprovada: true } } },
      });
      if (propostaRelevante?.decisao === null) {
        throw new ErroRegra("Já existe uma proposta de término pendente para este relato.");
      }
      if (propostaRelevante?.decisao?.aprovada) {
        throw new ErroRegra("Este relato já possui um término aprovado.");
      }

      const proposta = await tx.propostaTerminoIndisponibilidadeOferta.create({
        data: {
          registroId: relato.id,
          fim: dataUtc(dados.fim),
          motivo: dados.motivo,
          evidenciaTexto: dados.evidenciaTexto,
          autorId: sessao.id,
          chaveIdempotencia: dados.chaveIdempotencia,
          entradaHash,
        },
      });
      await registrarEvento(tx, {
        tipo: "TerminoIndisponibilidadeOfertaProposto",
        agregadoTipo: "Matricula",
        agregadoId: relato.matriculaId,
        autorId: sessao.id,
        payload: { relatoId: relato.id, propostaId: proposta.id, fim: dados.fim },
      });
      return projetarProposta(proposta);
    }, { timeout: 20_000 });
  });
}

/** Decide uma proposta de término. A aprovação continua sendo somente um fato, sem alterar o relato. */
export async function decidirTerminoIndisponibilidadeOferta(
  input: z.input<typeof DecidirTerminoSchema>,
) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const dados = DecidirTerminoSchema.parse(input);
    const entradaHash = hashSubstituicao(dados);
    const referencia = await prisma.propostaTerminoIndisponibilidadeOferta.findUnique({
      where: { id: dados.propostaId },
      select: { registroId: true, registro: { select: { matriculaId: true } } },
    });
    if (!referencia) {
      throw new ErroRegra("Proposta de término não encontrada.");
    }

    return prisma.$transaction(async (tx) => {
      await bloquearContextoRegistro(tx, referencia.registroId, referencia.registro.matriculaId);
      await tx.$queryRaw`SELECT id FROM "PropostaTerminoIndisponibilidadeOferta" WHERE id = ${dados.propostaId} FOR UPDATE`;
      const proposta = await tx.propostaTerminoIndisponibilidadeOferta.findFirst({
        where: { id: dados.propostaId, registro: { matriculaId: referencia.registro.matriculaId } },
        select: {
          id: true,
          registroId: true,
          autorId: true,
          fim: true,
          motivo: true,
          evidenciaTexto: true,
          criadaEm: true,
          decisao: true,
          registro: {
            select: {
              matriculaId: true,
              inicio: true,
              fim: true,
              confirmacao: { select: { confirmada: true } },
            },
          },
        },
      });
      if (!proposta) {
        throw new ErroRegra("Proposta de término não encontrada nesta matrícula.");
      }
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id IN (${sessao.id}, ${proposta.autorId}) FOR SHARE`;
      await conferirAutorAtual(tx, sessao.id, "DECIDIR");
      if (proposta.autorId === sessao.id) {
        throw new ErroRegra("Outra pessoa deve decidir a proposta de término.");
      }
      if (proposta.decisao) {
        if (
          proposta.decisao.decisorId === sessao.id &&
          proposta.decisao.entradaHash === entradaHash &&
          proposta.decisao.aprovada === dados.aprovada &&
          proposta.decisao.motivo === dados.motivo &&
          proposta.decisao.evidenciaTexto === dados.evidenciaTexto
        ) {
          return projetarDecisao(proposta.decisao);
        }
        throw new ErroRegra("A proposta já possui decisão imutável divergente.");
      }

      conferirFonteTermino(proposta.registro, proposta.fim);
      const aprovadaAnterior = await tx.propostaTerminoIndisponibilidadeOferta.findFirst({
        where: { registroId: proposta.registroId, decisao: { is: { aprovada: true } } },
        select: { id: true },
      });
      if (aprovadaAnterior) {
        throw new ErroRegra("Este relato já possui um término aprovado.");
      }

      const decisao = await tx.decisaoTerminoIndisponibilidadeOferta.create({
        data: {
          propostaId: proposta.id,
          decisorId: sessao.id,
          aprovada: dados.aprovada,
          motivo: dados.motivo,
          evidenciaTexto: dados.evidenciaTexto,
          entradaHash,
        },
      });
      await registrarEvento(tx, {
        tipo: "TerminoIndisponibilidadeOfertaDecidido",
        agregadoTipo: "Matricula",
        agregadoId: proposta.registro.matriculaId,
        autorId: sessao.id,
        payload: {
          relatoId: proposta.registroId,
          propostaId: proposta.id,
          decisaoId: decisao.id,
          aprovada: decisao.aprovada,
        },
      });
      return projetarDecisao(decisao);
    }, { timeout: 20_000 });
  });
}

/** Lista propostas de término sem transformar aprovação em mudança do relato ou do financeiro. */
export async function consultarTerminosIndisponibilidadeOferta(
  input: z.input<typeof ConsultarTerminosSchema>,
) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(
      Papel.SECRETARIA_ACADEMICA,
      Papel.GERENTE_PEDAGOGICO,
      Papel.FINANCEIRO,
      Papel.ADMINISTRADOR,
    );
    const dados = ConsultarTerminosSchema.parse(input);

    return prisma.$transaction(async (tx) => {
      const autor = await conferirAutorAtual(tx, sessao.id, "CONSULTAR");
      const relato = await tx.registroIndisponibilidadeOfertaMatricula.findUnique({
        where: { id: dados.registroId },
        select: {
          id: true,
          inicio: true,
          fim: true,
          confirmacao: { select: { confirmada: true } },
        },
      });
      if (!relato) {
        throw new ErroRegra("Relato de indisponibilidade não encontrado.");
      }
      const propostaRelevante = await tx.propostaTerminoIndisponibilidadeOferta.findFirst({
        where: {
          registroId: relato.id,
          OR: [{ decisao: null }, { decisao: { is: { aprovada: true } } }],
        },
        select: { decisao: { select: { aprovada: true } } },
      });
      const propostas = await tx.propostaTerminoIndisponibilidadeOferta.findMany({
        where: { registroId: relato.id },
        orderBy: [{ criadaEm: "desc" }, { id: "desc" }],
        skip: (dados.pagina - 1) * 20,
        take: 21,
        select: {
          id: true,
          registroId: true,
          autorId: true,
          fim: true,
          motivo: true,
          evidenciaTexto: true,
          criadaEm: true,
          decisao: {
            select: {
              id: true,
              aprovada: true,
              motivo: true,
              evidenciaTexto: true,
              decididaEm: true,
            },
          },
        },
      });
      const fonteAberta = relatoPodeReceberTermino(relato);
      const existePendente = propostaRelevante?.decisao === null;
      const existeAprovada = propostaRelevante?.decisao?.aprovada === true;
      return {
        pagina: dados.pagina,
        temProxima: propostas.length > 20,
        podePropor: podePropor(autor.papeis) && fonteAberta && !existePendente && !existeAprovada,
        propostas: propostas.slice(0, 20).map((proposta) => ({
          ...projetarProposta(proposta),
          podeDecidir:
            podeDecidir(autor.papeis) &&
            fonteAberta &&
            proposta.decisao === null &&
            proposta.autorId !== sessao.id &&
            !existeAprovada,
        })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
