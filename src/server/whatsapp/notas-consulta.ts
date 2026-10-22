import { prisma } from "@/lib/prisma";
import type { NotaInternaThread } from "./consultas-inbox";

/** Uso interno somente após a ação ou rota comprovar o escopo do atendimento. */
export async function notasInternasDoAtendimento(atendimentoId: string): Promise<NotaInternaThread[]> {
  const notas = await prisma.evento.findMany({
    where: { agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, tipo: "NotaInterna" },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 50, include: { autor: { select: { nome: true } } },
  });
  // Nota da Aria desfeita fica arquivada: o Evento original permanece, mas a nota sai da lista.
  const arquivadas = new Set(
    (await prisma.evento.findMany({ where: { agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, tipo: "NotaInternaArquivada" }, select: { payload: true } }))
      .map((e) => (e.payload as { eventoId?: unknown } | null)?.eventoId)
      .filter((v): v is string => typeof v === "string"),
  );
  return notas.filter((e) => !arquivadas.has(e.id)).map((e) => ({ id: e.id, nota: typeof (e.payload as { nota?: unknown })?.nota === "string" ? (e.payload as { nota: string }).nota : "", autorNome: e.autor?.nome ?? null, criadoEm: e.criadoEm.toISOString(), origem: "atendimento" }));
}
