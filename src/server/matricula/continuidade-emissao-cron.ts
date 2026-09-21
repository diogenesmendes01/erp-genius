import { prisma } from "@/lib/prisma";
import { ErroRegra } from "@/server/_shared";
import { emitirContinuidadeMensalTx } from "./continuidade-emissao-tx";

const LIMITE = 50;
export async function rodarEmissaoMensalContinuidade(cursor?: string) {
  let depois = cursor, avaliadas = 0, emitidas = 0, repetidas = 0, pendentes = 0, falhas = 0, proximoCursor: string | null = null;
  do {
    const matriculas = await prisma.matricula.findMany({ where: { status: "ATIVA", preparacaoComercial: { regime: "MENSALIDADE" }, ...(depois ? { id: { gt: depois } } : {}) }, orderBy: { id: "asc" }, take: LIMITE, select: { id: true, cobrancas: { where: { tipo: "MENSALIDADE", coberturaFim: { not: null } }, orderBy: [{ coberturaFim: "desc" }, { id: "desc" }], take: 1, select: { id: true } } } });
    if (!matriculas.length) { proximoCursor = null; break; }
    for (const m of matriculas) {
      avaliadas++; depois = m.id;
      if (!m.cobrancas[0]) { pendentes++; continue; }
      try { const resultado = await prisma.$transaction(tx => emitirContinuidadeMensalTx(tx, { matriculaId: m.id, ultimaCobrancaIdEsperada: m.cobrancas[0].id })); if (resultado.repetida) repetidas++; else emitidas++; }
      catch (e) { if (e instanceof ErroRegra) pendentes++; else { falhas++; console.error("[continuidade mensal] falha ao emitir", e); } }
    }
    proximoCursor = matriculas.length === LIMITE ? matriculas.at(-1)!.id : null;
  } while (proximoCursor);
  return { executou: true, avaliadas, emitidas, repetidas, pendentes, falhas, proximoCursor };
}
