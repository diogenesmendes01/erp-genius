import { StatusCobranca, type ModoDegrau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { montarReguaPorCobranca, type ReguaCalculada } from "@/server/cobrancas/consultas";
import type { PoliticaCarregada } from "@/server/cobrancas/politica";
import type { PassoRegua } from "@/server/cobrancas/regua";
import { INCLUDE_DESTINO, resolverDestinoCobranca, type CobrancaComDestino, type DestinoCobranca } from "./identidade";

// QUEM A RÉGUA DE COBRANÇA ALCANÇA (doc 26 §Camada 1; docs/42 L2517). A regra de "quem recebe" do cron mora
// AQUI, numa função só, e serve aos dois lados: o cron (cron.ts) enfileira o que ela decide, e a estimativa de
// alcance da ativação (estimarAlcanceRegua, em acoes.ts) conta o que ela decide — nunca uma cópia da lógica.
// Só leitura: nada aqui grava intenção nem envia.

/** O que o cron faz com uma cobrança aberta, na régua de hoje. */
export type DecisaoEnvioCron =
  /** Nenhum degrau devido (fora da régua, promessa, conferência, já feito). */
  | { tipo: "sem_acao" }
  /** Degrau devido, mas não automático (manual, lote ou bloqueio: sempre humano). */
  | { tipo: "nao_automatico"; passo: PassoRegua; modo: ModoDegrau | null }
  /** Degrau automático devido, sem destinatário financeiro válido (S2: a intenção não nasce). */
  | { tipo: "sem_destino"; passo: PassoRegua }
  /** Degrau automático devido, com destino: o cron enfileira a mensagem. */
  | { tipo: "enfileirar"; passo: PassoRegua; destino: DestinoCobranca };

/**
 * A regra do cron para uma cobrança: degrau devido → D+15/bloquear nunca automático (lei) → só o modo
 * AUTOMATICO → precisa de destino financeiro. A ordem dos testes é a do cron (os contadores dependem dela).
 */
export function decidirEnvioCron(
  cobranca: CobrancaComDestino,
  calc: ReguaCalculada | undefined,
  modoPorPasso: PoliticaCarregada["modoPorPasso"],
): DecisaoEnvioCron {
  if (!calc || calc.estado !== "acao_devida" || !calc.passo) return { tipo: "sem_acao" };
  const passo = calc.passo;
  // D+15 (bloquear) nunca vira intenção automática — aprovação humana sempre (lei).
  if (calc.tipoAcao === "bloquear") return { tipo: "nao_automatico", passo, modo: null };
  const modo = modoPorPasso.get(passo) ?? null;
  if (modo !== "AUTOMATICO") return { tipo: "nao_automatico", passo, modo };
  const destino = resolverDestinoCobranca(cobranca);
  if (!destino) return { tipo: "sem_destino", passo };
  return { tipo: "enfileirar", passo, destino };
}

/** As cobranças abertas (pendentes e atrasadas), com o destino, e a régua de cada uma com os degraus dados. */
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

/** Quantas pessoas a régua alcança agora. */
export interface AlcanceRegua {
  /** Pessoas distintas (telefone do destinatário financeiro) que recebem mensagem automática na próxima rodada. */
  pessoas: number;
  /** Cobranças com degrau automático devido e destino: uma mensagem por cobrança. */
  cobrancas: number;
  /** Cobranças com degrau automático devido, mas sem destinatário financeiro válido: não recebem. */
  semDestino: number;
  /** Cobranças com degrau de lote devido e destino: só saem quando alguém aprova o lote na fila. */
  emLote: number;
}

/**
 * Conta, com a regra do cron (decidirEnvioCron), quem a régua alcança hoje com estes degraus. É uma estimativa
 * do momento: as travas do despachante (janela, teto por contato, silêncio depois de resposta, opt-out) ainda
 * podem adiar ou barrar uma parte, e pagamentos mudam a fila antes da próxima rodada.
 */
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
