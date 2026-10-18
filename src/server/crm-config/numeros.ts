"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento, type Resultado } from "@/server/_shared";
import { setoresDoNumero } from "@/server/whatsapp/numero-setor";
import { SETORES, podeTriarSetores, type Setor } from "@/server/whatsapp/setor";

const SetoresSchema = z.object({
  numeroId: z.string().trim().min(1),
  setores: z
    .array(z.enum(SETORES as unknown as [Setor, ...Setor[]], { message: "Setor inválido." }))
    .min(1, "Escolha ao menos um setor para o número."),
});

/**
 * Define os setores que o número atende (só ADMINISTRADOR). Com menos de 2 setores a triagem
 * deixa de existir e o responsável volta a null (= administrador, Q2): vira `NumeroTriagemAlterada`.
 */
export async function definirSetoresDoNumero(i: { numeroId: string; setores: Setor[] }): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = SetoresSchema.parse(i);
    const para = SETORES.filter((s) => dados.setores.includes(s));
    await prisma.$transaction(async (tx) => {
      const numero = await tx.numeroWhatsApp.findUnique({ where: { id: dados.numeroId }, select: { id: true, triagemResponsavelId: true } });
      if (!numero) throw new ErroRegra("Número não encontrado.");
      const de = await setoresDoNumero(tx, numero.id);
      await tx.numeroSetorWhatsApp.deleteMany({ where: { numeroId: numero.id } });
      await tx.numeroSetorWhatsApp.createMany({ data: para.map((finalidade) => ({ numeroId: numero.id, finalidade })) });
      await registrarEvento(tx, { tipo: "NumeroSetoresAlterados", agregadoTipo: "NumeroWhatsApp", agregadoId: numero.id, autorId: autor.id, payload: { de, para } });
      if (para.length < 2 && numero.triagemResponsavelId) {
        await tx.numeroWhatsApp.update({ where: { id: numero.id }, data: { triagemResponsavelId: null } });
        await registrarEvento(tx, { tipo: "NumeroTriagemAlterada", agregadoTipo: "NumeroWhatsApp", agregadoId: numero.id, autorId: autor.id, payload: { de: numero.triagemResponsavelId, para: null } });
      }
    });
    revalidatePath("/configuracao/whatsapp", "layout");
    revalidatePath("/inbox");
    return undefined;
  });
}

/** Responsável pela triagem: só com 2+ setores e usuário ativo com papel de um deles; null = administrador. */
export async function definirResponsavelTriagem(i: { numeroId: string; usuarioId: string | null }): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = z.object({ numeroId: z.string().trim().min(1), usuarioId: z.string().trim().min(1).nullable() }).parse(i);
    await prisma.$transaction(async (tx) => {
      const numero = await tx.numeroWhatsApp.findUnique({ where: { id: dados.numeroId }, select: { id: true, triagemResponsavelId: true } });
      if (!numero) throw new ErroRegra("Número não encontrado.");
      if (dados.usuarioId) {
        const setores = await setoresDoNumero(tx, numero.id);
        if (setores.length < 2) throw new ErroRegra("A triagem só existe quando o número atende dois ou mais setores.");
        const resp = await tx.usuario.findFirst({ where: { id: dados.usuarioId, ativo: true }, select: { papeis: true } });
        if (!resp) throw new ErroRegra("Responsável pela triagem inválido (usuário inexistente ou inativo).");
        if (!podeTriarSetores(resp.papeis, setores)) throw new ErroRegra("O responsável pela triagem precisa ter papel de um dos setores do número.");
      }
      if (numero.triagemResponsavelId === dados.usuarioId) return;
      await tx.numeroWhatsApp.update({ where: { id: numero.id }, data: { triagemResponsavelId: dados.usuarioId } });
      await registrarEvento(tx, { tipo: "NumeroTriagemAlterada", agregadoTipo: "NumeroWhatsApp", agregadoId: numero.id, autorId: autor.id, payload: { de: numero.triagemResponsavelId, para: dados.usuarioId } });
    });
    revalidatePath("/configuracao/whatsapp", "layout");
    return undefined;
  });
}
