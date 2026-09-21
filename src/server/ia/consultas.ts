import { Papel } from "@prisma/client";
import { exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { prisma } from "@/lib/prisma";

// CONSULTAS do copiloto (C3): sugestões pendentes por lead (ficha/inbox) e a MÉTRICA-GATE
// (taxa de aceitação por tipo — doc 27: é ela que autoriza, ou não, auto-aplicação futura).

export interface SugestaoPendente {
  id: string;
  tipo: string;
  payload: unknown;
  justificativa: string | null;
  modelo: string;
  gatilho: string;
  criadoEm: string;
}

export async function sugestoesPendentesDoLead(leadId: string): Promise<SugestaoPendente[]> {
  const autor = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
  if (!await prisma.lead.count({ where: { AND: [{ id: leadId }, await escopoComercialAtual(autor)] } })) throw new ErroPermissao("Lead fora da carteira/equipe vigente.");
  const sugestoes = await prisma.sugestaoIA.findMany({
    where: { leadId, status: "PENDENTE" },
    orderBy: { criadoEm: "asc" },
  });
  return sugestoes.map((s) => ({
    id: s.id,
    tipo: s.tipo,
    payload: s.payload,
    justificativa: s.justificativa,
    modelo: s.modelo,
    gatilho: s.gatilho,
    criadoEm: s.criadoEm.toISOString(),
  }));
}

export interface MetricaCopilotoTipo {
  tipo: string;
  aceitas: number;
  corrigidas: number;
  descartadas: number;
  pendentes: number;
  /** Aceitação = (aceitas + corrigidas) / decididas — corrigir ainda é adotar a sugestão. */
  taxaAceitacaoPct: number | null;
}

export async function metricasCopiloto(): Promise<MetricaCopilotoTipo[]> {
  const autor = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL);
  const escopo = await escopoComercialAtual(autor);
  const grupos = await prisma.sugestaoIA.groupBy({
    by: ["tipo", "status"],
    _count: { _all: true },
    // EXPIRADA fica fora da métrica: ninguém decidiu — não mede qualidade da sugestão.
    where: { lead: escopo, status: { in: ["PENDENTE", "ACEITA", "CORRIGIDA", "DESCARTADA"] } },
  });

  const porTipo = new Map<string, MetricaCopilotoTipo>();
  for (const g of grupos) {
    const m = porTipo.get(g.tipo) ?? {
      tipo: g.tipo,
      aceitas: 0,
      corrigidas: 0,
      descartadas: 0,
      pendentes: 0,
      taxaAceitacaoPct: null,
    };
    const n = g._count._all;
    if (g.status === "ACEITA") m.aceitas += n;
    else if (g.status === "CORRIGIDA") m.corrigidas += n;
    else if (g.status === "DESCARTADA") m.descartadas += n;
    else m.pendentes += n;
    porTipo.set(g.tipo, m);
  }
  for (const m of porTipo.values()) {
    const decididas = m.aceitas + m.corrigidas + m.descartadas;
    m.taxaAceitacaoPct = decididas > 0 ? Math.round(((m.aceitas + m.corrigidas) / decididas) * 100) : null;
  }
  return [...porTipo.values()].sort((a, b) => a.tipo.localeCompare(b.tipo));
}
