"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";
import { carregarContinuidadeMensalTx } from "./continuidade-estado-tx";

const MatriculaId = z.string().min(1);

/** Q30/Q64: consulta autenticada. O carregador interno não emite cobrança. */
export async function consultarPreviaContinuidadeMensal(matriculaId: string) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(
      Papel.SECRETARIA_ACADEMICA,
      Papel.FINANCEIRO,
      Papel.ADMINISTRADOR,
    );
    const id = MatriculaId.parse(matriculaId);
    return prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { id: autor.id },
        select: { ativo: true, papeis: true },
      });
      if (
        !usuario?.ativo ||
        !usuario.papeis.some(
          (papel) =>
            papel === Papel.SECRETARIA_ACADEMICA ||
            papel === Papel.FINANCEIRO ||
            papel === Papel.ADMINISTRADOR,
        )
      ) {
        throw new ErroPermissao();
      }
      const estado = await carregarContinuidadeMensalTx(tx, {
        matriculaId: id,
        agora: new Date(),
      });
      return {
        matriculaId: estado.matriculaId,
        fusoInstitucional: estado.fusoInstitucional,
        plano: estado.plano,
        memoriaPreco: estado.memoriaPreco,
        oferta: estado.oferta,
        comprovacaoOferta: estado.comprovacaoOferta,
        disponivel: estado.disponivel,
        podeEmitir: estado.podeEmitir,
        motivo: estado.motivo,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
