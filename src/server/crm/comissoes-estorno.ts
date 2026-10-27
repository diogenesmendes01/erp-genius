import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirSessao } from "@/server/_shared/sessao";
import { exigirCapacidadeCrm } from "./permissoes";
import { ultimoEventoDoAutor } from "@/server/_shared/idempotencia";

export const MOTIVOS_ESTORNO = ["CANCELAMENTO_MATRICULA", "DESISTENCIA_7_DIAS", "ERRO_LANCAMENTO", "OUTRO"] as const;
export type MotivoEstorno = (typeof MOTIVOS_ESTORNO)[number];

const schema = z.object({
  id: z.string().min(1),
  motivo: z.enum(MOTIVOS_ESTORNO),
  detalhe: z.string().max(1000).optional(),
});

export async function estornarComissao(input: { id: string; motivo: MotivoEstorno; detalhe?: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "comissoes.estornar");
    const dados = schema.parse(input);
    const detalhe = dados.detalhe?.trim() || undefined;
    if (dados.motivo === "OUTRO" && !detalhe) throw new ErroRegra("Descreva o motivo.");
    await prisma.$transaction(async (tx) => {
      const [atual] = await tx.$queryRaw<{ status: string }[]>`SELECT status::text AS status FROM "Comissao" WHERE id = ${dados.id} FOR UPDATE`;
      if (!atual) throw new ErroRegra("Comissão não encontrada.");
      if (atual.status === "PAGA") throw new ErroRegra("Comissão já paga: o desconto no próximo fechamento ainda não existe.");
      if (atual.status === "ESTORNADA") {
        const p = await ultimoEventoDoAutor(tx, { tipo: "ComissaoEstornada", agregadoTipo: "Comissao", agregadoId: dados.id, autorId: autor.id });
        if (p && p.motivo === dados.motivo && (p.detalhe ?? undefined) === detalhe) return;
        throw new ErroRegra("Comissão já estornada.");
      }
      const r = await tx.comissao.updateMany({ where: { id: dados.id, status: { in: ["PENDENTE", "APROVADA"] } }, data: { status: "ESTORNADA" } });
      if (r.count === 0) throw new ErroRegra("A comissão mudou de situação. Atualize a tela.");
      await registrarEvento(tx, {
        tipo: "ComissaoEstornada",
        agregadoTipo: "Comissao",
        agregadoId: dados.id,
        autorId: autor.id,
        payload: { de: atual.status, motivo: dados.motivo, ...(detalhe ? { detalhe } : {}) },
      });
    });
  });
}
