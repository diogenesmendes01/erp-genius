import { prisma } from "@/lib/prisma";

export type PreferenciaDoAtendimento = { fixada: boolean; silenciada: boolean; naoLidas: number };

export async function preferenciasDoUsuario(usuarioId: string, atendimentoIds: string[]): Promise<Map<string, PreferenciaDoAtendimento>> {
  const resultado = new Map<string, PreferenciaDoAtendimento>();
  if (!atendimentoIds.length) return resultado;
  const atendimentos = await prisma.atendimentoWhatsApp.findMany({
    where: { id: { in: atendimentoIds } }, select: { id: true, conversaId: true, naoLidas: true } });
  const prefs = await prisma.preferenciaConversaUsuario.findMany({
    where: { usuarioId, conversaId: { in: atendimentos.map((a) => a.conversaId) } } });
  const porConversa = new Map(prefs.map((p) => [p.conversaId, p]));
  const agora = new Date();
  const contagens = new Map<string, number>();
  const porLidaAte = new Map<number, string[]>();
  for (const a of atendimentos) {
    const lidaAte = porConversa.get(a.conversaId)?.lidaAte;
    if (!lidaAte) continue;
    porLidaAte.set(lidaAte.getTime(), [...(porLidaAte.get(lidaAte.getTime()) ?? []), a.id]);
  }
  await Promise.all([...porLidaAte].map(async ([t, ids]) => {
    const grupos = await prisma.mensagemWhatsApp.groupBy({
      by: ["atendimentoId"], _count: { _all: true },
      where: { atendimentoId: { in: ids }, direcao: "ENTRADA", criadoEm: { gt: new Date(t) } } });
    for (const g of grupos) if (g.atendimentoId) contagens.set(g.atendimentoId, g._count._all);
  }));
  for (const a of atendimentos) {
    const p = porConversa.get(a.conversaId);
    const base = p?.lidaAte ? (contagens.get(a.id) ?? 0) : a.naoLidas;
    resultado.set(a.id, {
      fixada: !!p?.fixadaEm,
      silenciada: !!p?.silenciadaAte && p.silenciadaAte > agora,
      naoLidas: p?.marcadaNaoLida ? Math.max(1, base) : base,
    });
  }
  return resultado;
}
