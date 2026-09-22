import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";

// A fonte contratual de uma matrícula é exatamente uma: a conclusão assinada no sistema ou a origem contratual
// histórica aprovada (contrato legado: PDF + transcrição com conferência dupla). Os leitores da cadeia de
// aditivos consomem a prévia da mesma forma nas duas — na histórica, a "prévia" é a projeção da transcrição.
const RegimeSchema = z.object({ condicoes: z.object({ aulas: z.object({ regime: z.enum(["MENSALIDADE", "HORA_PARTICULAR"]) }) }) });

export type FonteContratual =
  | { tipo: "CONCLUSAO"; id: string; hash: string; previa: unknown; regime: "MENSALIDADE" | "HORA_PARTICULAR"; processoId: string; estado: string; ambiente: string; artefatoId: string }
  | { tipo: "ORIGEM_HISTORICA"; id: string; hash: string; previa: unknown; regime: "MENSALIDADE" | "HORA_PARTICULAR"; pdfHash: string; transcricaoHash: string; projecaoHash: string; referencia: string; assinadoEm: Date };

/** Lê a fonte contratual vigente da matrícula sem bloquear nada. `null` quando não há fonte única utilizável. */
export async function carregarFonteContratualTx(tx: Prisma.TransactionClient, matriculaId: string): Promise<{ fonte: FonteContratual | null; impedimento: string | null }> {
  const [conclusoes, origens] = await Promise.all([
    tx.conclusaoAssinaturaContratual.findMany({ where: { processo: { matriculaId } }, take: 2,
      select: { id: true, entradaHash: true, processo: { select: { id: true, estado: true, ambiente: true, artefato: { select: { id: true, previa: { select: { snapshot: true } } } } } } } }),
    tx.propostaOrigemContratualHistorica.findMany({ where: { matriculaId, decisao: { is: { aprovada: true } } }, take: 2,
      select: { id: true, entradaHash: true, pdfHash: true, transcricaoHash: true, projecaoHash: true, projecao: true, referencia: true, assinadoEm: true } }),
  ]);
  if (conclusoes.length && origens.length) return { fonte: null, impedimento: "A matrícula possui contrato assinado e origem histórica aprovada. A fonte contratual precisa de conferência." };
  if (conclusoes.length > 1) return { fonte: null, impedimento: "Há mais de um original assinado. A fonte contratual precisa de conferência." };
  if (origens.length > 1) return { fonte: null, impedimento: "Há mais de uma origem histórica aprovada. A fonte contratual precisa de conferência." };
  if (origens.length === 1) {
    const o = origens[0];
    return { fonte: { tipo: "ORIGEM_HISTORICA", id: o.id, hash: o.entradaHash, previa: o.projecao, regime: RegimeSchema.parse(o.projecao).condicoes.aulas.regime,
      pdfHash: o.pdfHash, transcricaoHash: o.transcricaoHash, projecaoHash: o.projecaoHash, referencia: o.referencia, assinadoEm: o.assinadoEm }, impedimento: null };
  }
  if (conclusoes.length === 1 && conclusoes[0].processo.estado === "ENVIADO") {
    const c = conclusoes[0];
    return { fonte: { tipo: "CONCLUSAO", id: c.id, hash: c.entradaHash, previa: c.processo.artefato.previa.snapshot, regime: RegimeSchema.parse(c.processo.artefato.previa.snapshot).condicoes.aulas.regime,
      processoId: c.processo.id, estado: c.processo.estado, ambiente: c.processo.ambiente, artefatoId: c.processo.artefato.id }, impedimento: null };
  }
  return { fonte: null, impedimento: "A preparação exige um original com todas as assinaturas concluídas e envio confirmado, ou uma origem contratual histórica aprovada." };
}

/** Bloqueia a fonte da proposta na ordem global (processo fonte ou origem histórica). */
export async function bloquearFontePropostaTx(tx: Prisma.TransactionClient, p: { conclusaoOriginalId: string | null; origemHistoricaId: string | null }) {
  if (p.origemHistoricaId) {
    const o = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "PropostaOrigemContratualHistorica" WHERE id = ${p.origemHistoricaId} FOR UPDATE`;
    if (!o.length) throw new ErroRegra("Origem contratual histórica indisponível.");
    return;
  }
  if (!p.conclusaoOriginalId) throw new ErroRegra("Proposta sem fonte contratual.");
  const c = await tx.conclusaoAssinaturaContratual.findUnique({ where: { id: p.conclusaoOriginalId }, select: { processoId: true } });
  if (!c) throw new ErroRegra("Conclusão original indisponível.");
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id = ${c.processoId} FOR UPDATE`;
}

/** Regime do contrato de origem (assinado ou histórico), para os resolvedores financeiros. */
export async function regimeFonteContratualTx(tx: Prisma.TransactionClient, matriculaId: string) {
  const { fonte } = await carregarFonteContratualTx(tx, matriculaId);
  return fonte?.regime ?? null;
}
