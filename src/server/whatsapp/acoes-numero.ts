"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento, type Resultado } from "@/server/_shared";
import { setoresDoNumero } from "./numero-setor";
import { SETORES, podeTriarSetores, type Setor } from "./setor";

const SetoresNumeroSchema = z.object({
  numeroId: z.string().trim().min(1),
  setores: z
    .array(z.enum(SETORES as unknown as [Setor, ...Setor[]], { message: "Setor inválido." }))
    .min(1, "Escolha ao menos um setor para o número."),
  triagemResponsavelId: z.string().trim().min(1).nullable(),
});

export interface SetoresNumeroInput {
  numeroId: string;
  setores: Setor[];
  triagemResponsavelId: string | null;
}

/**
 * Define os setores que o número atende e quem faz a triagem (só com 2+ setores;
 * null = ADMINISTRADOR, Q2). NumeroSetorWhatsApp é tabela de configuração: recria-se
 * as linhas, e a auditoria fica no Evento.
 */
export async function salvarSetoresNumero(input: SetoresNumeroInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = SetoresNumeroSchema.parse(input);
    const para = SETORES.filter((s) => dados.setores.includes(s));
    const triagemResponsavelId = para.length >= 2 ? dados.triagemResponsavelId : null;

    await prisma.$transaction(async (tx) => {
      const numero = await tx.numeroWhatsApp.findUnique({ where: { id: dados.numeroId }, select: { id: true } });
      if (!numero) throw new ErroRegra("Número não encontrado.");
      if (triagemResponsavelId) {
        const resp = await tx.usuario.findFirst({ where: { id: triagemResponsavelId, ativo: true }, select: { papeis: true } });
        if (!resp) throw new ErroRegra("Responsável pela triagem inválido (usuário inexistente ou inativo).");
        if (!podeTriarSetores(resp.papeis, para)) throw new ErroRegra("O responsável pela triagem precisa ter papel de um dos setores do número.");
      }
      const de = await setoresDoNumero(tx, numero.id);
      await tx.numeroSetorWhatsApp.deleteMany({ where: { numeroId: numero.id } });
      await tx.numeroSetorWhatsApp.createMany({ data: para.map((finalidade) => ({ numeroId: numero.id, finalidade })) });
      await tx.numeroWhatsApp.update({ where: { id: numero.id }, data: { triagemResponsavelId } });
      await registrarEvento(tx, {
        tipo: "SetoresNumeroAlterados",
        agregadoTipo: "NumeroWhatsApp",
        agregadoId: numero.id,
        autorId: autor.id,
        payload: { de, para, triagemResponsavelId },
      });
    });
    revalidatePath("/configuracao/whatsapp", "layout");
    revalidatePath("/inbox");
    return undefined;
  });
}
