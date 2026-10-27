import { StatusCobranca, type ModoDegrau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { montarReguaPorCobranca, type ReguaCalculada } from "@/server/cobrancas/consultas";
import type { PoliticaCarregada } from "@/server/cobrancas/politica";
import type { PassoRegua } from "@/server/cobrancas/regua";
import { INCLUDE_DESTINO, resolverDestinoCobranca, type CobrancaComDestino, type DestinoCobranca } from "./identidade";

export type DecisaoEnvioCron =
  | { tipo: "sem_acao" }
  | { tipo: "nao_automatico"; passo: PassoRegua; modo: ModoDegrau | null }
  | { tipo: "sem_destino"; passo: PassoRegua }
  | { tipo: "enfileirar"; passo: PassoRegua; destino: DestinoCobranca };

export function decidirEnvioCron(
  cobranca: CobrancaComDestino,
  calc: ReguaCalculada | undefined,
  modoPorPasso: PoliticaCarregada["modoPorPasso"],
): DecisaoEnvioCron {
  if (!calc || calc.estado !== "acao_devida" || !calc.passo) return { tipo: "sem_acao" };
  const passo = calc.passo;
  if (calc.tipoAcao === "bloquear") return { tipo: "nao_automatico", passo, modo: null };
  const modo = modoPorPasso.get(passo) ?? null;
  if (modo !== "AUTOMATICO") return { tipo: "nao_automatico", passo, modo };
  const destino = resolverDestinoCobranca(cobranca);
  if (!destino) return { tipo: "sem_destino", passo };
  return { tipo: "enfileirar", passo, destino };
}

export async function carregarCobrancasDaRegua(agora: Date, degraus: PoliticaCarregada["degraus"]) {
  const cobrancas = await prisma.cobranca.findMany({
    where: { status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] } },
    include: INCLUDE_DESTINO,
  });
  const regua = await montarReguaPorCobranca(
    cobrancas.map((c) => ({ id: c.id, vencimento: c.vencimento, cicloRegua: c.cicloRegua, acessoBloqueado: c.matricula.acessoBloqueado })),
    agora,
    degraus,
  );
  return { cobrancas, regua };
}

export interface AlcanceRegua {
  pessoas: number;
  cobrancas: number;
  semDestino: number;
  emLote: number;
}

export async function contarAlcanceRegua(
  politica: Pick<PoliticaCarregada, "degraus" | "modoPorPasso">,
  agora: Date = new Date(),
): Promise<AlcanceRegua> {
  const { cobrancas, regua } = await carregarCobrancasDaRegua(agora, politica.degraus);
  const telefones = new Set<string>();
  const alcance: AlcanceRegua = { pessoas: 0, cobrancas: 0, semDestino: 0, emLote: 0 };
  for (const cobranca of cobrancas) {
    const decisao = decidirEnvioCron(cobranca, regua.get(cobranca.id), politica.modoPorPasso);
    if (decisao.tipo === "enfileirar") {
      alcance.cobrancas += 1;
      telefones.add(decisao.destino.telefoneE164);
    } else if (decisao.tipo === "sem_destino") {
      alcance.semDestino += 1;
    } else if (decisao.tipo === "nao_automatico" && decisao.modo === "LOTE" && resolverDestinoCobranca(cobranca)) {
      alcance.emLote += 1;
    }
  }
  alcance.pessoas = telefones.size;
  return alcance;
}
