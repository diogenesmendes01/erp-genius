"use server";

import { Papel } from "@prisma/client";
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

const TextoConfirmacaoSchema = z.string().trim().min(5).max(4_000);
const ConfirmarRelatoSchema = z
  .object({
    registroId: z.string().min(1),
    confirmada: z.boolean(),
    motivo: TextoConfirmacaoSchema.max(2000),
    evidenciaTexto: TextoConfirmacaoSchema,
  })
  .strict();

function podeConfirmar(papeis: Papel[]): boolean {
  return papeis.includes(Papel.GERENTE_PEDAGOGICO) || papeis.includes(Papel.ADMINISTRADOR);
}

function projetarConfirmacao(confirmacao: {
  id: string;
  confirmada: boolean;
  motivo: string;
  evidenciaTexto: string;
  confirmadaEm: Date;
}) {
  return {
    id: confirmacao.id,
    confirmada: confirmacao.confirmada,
    motivo: confirmacao.motivo,
    evidenciaTexto: confirmacao.evidenciaTexto,
    confirmadaEm: confirmacao.confirmadaEm.toISOString(),
  };
}

/** Confirmação é um fato imutável e não cria efeito financeiro ou acadêmico. */
export async function confirmarRelatoIndisponibilidadeOferta(
  input: z.input<typeof ConfirmarRelatoSchema>,
) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const dados = ConfirmarRelatoSchema.parse(input);
    const entradaHash = hashSubstituicao(dados);

    const referencia = await prisma.registroIndisponibilidadeOfertaMatricula.findUnique({
      where: { id: dados.registroId },
      select: { matriculaId: true },
    });
    if (!referencia) {
      throw new ErroRegra("Relato de indisponibilidade não encontrado.");
    }

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [referencia.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "RegistroIndisponibilidadeOfertaMatricula" WHERE id = ${dados.registroId} FOR UPDATE`;
      const relato = await tx.registroIndisponibilidadeOfertaMatricula.findFirst({
        where: { id: dados.registroId, matriculaId: referencia.matriculaId },
        select: {
          id: true,
          matriculaId: true,
          autorId: true,
          confirmacao: true,
        },
      });
      if (!relato) {
        throw new ErroRegra("Relato de indisponibilidade não encontrado nesta matrícula.");
      }

      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${sessao.id} FOR SHARE`;
      const autor = await tx.usuario.findUnique({
        where: { id: sessao.id },
        select: { ativo: true, papeis: true },
      });
      if (!autor?.ativo || !podeConfirmar(autor.papeis)) {
        throw new ErroPermissao();
      }
      if (relato.autorId === sessao.id) {
        throw new ErroRegra("Outra pessoa deve confirmar ou recusar o relato.");
      }

      if (relato.confirmacao) {
        if (
          relato.confirmacao.confirmadorId === sessao.id &&
          relato.confirmacao.entradaHash === entradaHash &&
          relato.confirmacao.confirmada === dados.confirmada &&
          relato.confirmacao.motivo === dados.motivo &&
          relato.confirmacao.evidenciaTexto === dados.evidenciaTexto
        ) {
          return projetarConfirmacao(relato.confirmacao);
        }
        throw new ErroRegra("O relato já possui confirmação imutável divergente.");
      }

      const confirmacao = await tx.confirmacaoIndisponibilidadeOfertaMatricula.create({
        data: {
          registroId: relato.id,
          confirmadorId: sessao.id,
          confirmada: dados.confirmada,
          motivo: dados.motivo,
          evidenciaTexto: dados.evidenciaTexto,
          entradaHash,
        },
      });
      await registrarEvento(tx, {
        tipo: "RelatoIndisponibilidadeOfertaConfirmado",
        agregadoTipo: "Matricula",
        agregadoId: relato.matriculaId,
        autorId: sessao.id,
        payload: {
          relatoId: relato.id,
          confirmacaoId: confirmacao.id,
          confirmada: confirmacao.confirmada,
        },
      });
      return projetarConfirmacao(confirmacao);
    }, { timeout: 20_000 });
  });
}
