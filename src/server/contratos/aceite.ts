"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { carregarRevisaoAceite } from "./aceite-estado";
import { Alvo, Confirmar } from "./aceite-schema";
import { confirmarAceiteOriginalTx } from "./aceite-tx";

export async function consultarAceiteOriginal(input: z.input<typeof Alvo>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Alvo.parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, u.id);
      if (!await tx.conclusaoAssinaturaContratual.count({ where: { id: d.conclusaoId, processo: { matriculaId: d.matriculaId } } })) throw new ErroRegra("Conclusão indisponível nesta matrícula.");
      const aceite = await tx.aceiteOriginalContratual.findFirst({ where: d, select: { id: true, criadaEm: true, motivo: true, autor: { select: { nome: true } } } });
      if (aceite) return { aceite, revisao: null, pendencia: null };
      try {
        const r = await carregarRevisaoAceite(tx, d.matriculaId, d.conclusaoId);
        return { aceite: null, revisao: { ...r.dados, hash: r.revisaoHash }, pendencia: null };
      } catch (e) { if (!(e instanceof ErroRegra)) throw e; return { aceite: null, revisao: null, pendencia: e.message }; }
    }, { timeout: 20000 });
  });
}

export async function confirmarAceiteOriginal(input: z.input<typeof Confirmar>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Confirmar.parse(input);
    const resultado = await prisma.$transaction(tx => confirmarAceiteOriginalTx(tx, u.id, d), { timeout: 20000 });
    revalidatePath("/secretaria"); revalidatePath(`/matriculas/${d.matriculaId}/contrato`, "layout");
    return resultado;
  });
}
