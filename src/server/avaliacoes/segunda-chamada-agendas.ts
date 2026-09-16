"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel } from "@/server/_shared";

const entrada = z.object({
  cursor: z.string().trim().min(1).max(100).optional(),
}).strict();

/**
 * Fila administrativa de agendas de segunda chamada. A consulta não expõe
 * lançamentos, notas, prazos, motivos, evidências ou qualquer dado financeiro.
 */
export async function listarAgendasSegundaChamada(input: z.input<typeof entrada> = {}) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(
      Papel.SECRETARIA_ACADEMICA,
      Papel.GERENTE_PEDAGOGICO,
      Papel.ADMINISTRADOR,
    );
    const d = entrada.parse(input);
    return prisma.$transaction(async (tx) => {
      const escopo = { agenda: { isNot: null } };
      const cursor = d.cursor
        ? await tx.reservaSegundaChamada.findFirst({
            where: { ...escopo, id: d.cursor },
            select: { id: true, reservadaEm: true },
          })
        : null;
      if (d.cursor && !cursor) {
        throw new ErroRegra("O cursor não pertence à fila de agendas de segunda chamada.");
      }

      const reservas = await tx.reservaSegundaChamada.findMany({
        where: {
          ...escopo,
          ...(cursor
            ? {
                OR: [
                  { reservadaEm: { lt: cursor.reservadaEm } },
                  { reservadaEm: cursor.reservadaEm, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ reservadaEm: "desc" }, { id: "desc" }],
        take: 21,
        select: {
          id: true,
          status: true,
          codigoAvaliacao: true,
          reservadaEm: true,
          matricula: {
            select: {
              codigo: true,
              aluno: { select: { primeiroNome: true, sobrenome: true, nomePreferido: true } },
            },
          },
          proposta: {
            select: {
              turma: { select: { codigo: true, nome: true } },
            },
          },
          agenda: {
            select: {
              encontro: {
                select: { inicio: true, fim: true, fusoOrigem: true, status: true },
              },
            },
          },
        },
      });

      return {
        itens: reservas.slice(0, 20).map((reserva) => {
          const aluno = reserva.matricula.aluno;
          const nomeAluno = aluno.nomePreferido || [aluno.primeiroNome, aluno.sobrenome]
            .filter((parte): parte is string => Boolean(parte))
            .join(" ");
          const encontro = reserva.agenda?.encontro;
          return {
            reservaId: reserva.id,
            statusReserva: reserva.status,
            codigoAvaliacao: reserva.codigoAvaliacao,
            reservadaEm: reserva.reservadaEm.toISOString(),
            matricula: { codigo: reserva.matricula.codigo },
            aluno: nomeAluno || "Aluno sem nome informado",
            turma: {
              codigo: reserva.proposta.turma.codigo,
              nome: reserva.proposta.turma.nome,
            },
            agenda: encontro
              ? {
                  inicio: encontro.inicio.toISOString(),
                  fim: encontro.fim.toISOString(),
                  fusoOrigem: encontro.fusoOrigem,
                  status: encontro.status,
                }
              : null,
          };
        }),
        proximoCursor: reservas.length > 20 ? reservas[19].id : null,
      };
    });
  });
}
