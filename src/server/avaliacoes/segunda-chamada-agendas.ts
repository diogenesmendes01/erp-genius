"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { janelaDaPagina, PAGINA_MAXIMA, recorteDaPagina } from "@/lib/pagina-url";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";

const entrada = z.object({
  pagina: z.number().int().min(1).max(PAGINA_MAXIMA).default(1),
}).strict();

/**
 * Fila administrativa de agendas de segunda chamada. A consulta não expõe
 * lançamentos, notas, prazos, motivos, evidências ou qualquer dado financeiro.
 * Paginada por número (E4), em ordem estável (reservadaEm, id).
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
      const lidas = await tx.reservaSegundaChamada.findMany({
        where: { agenda: { isNot: null } },
        orderBy: [{ reservadaEm: "desc" }, { id: "desc" }],
        ...janelaDaPagina(d.pagina, 20),
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

      const { registros: reservas, temProxima } = recorteDaPagina(lidas, 20);
      return {
        itens: reservas.map((reserva) => {
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
        pagina: d.pagina,
        temProxima,
      };
    });
  });
}
