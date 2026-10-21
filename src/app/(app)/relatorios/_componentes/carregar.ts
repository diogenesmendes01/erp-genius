import { metricasAtendimento } from "@/server/relatorios/atendimento";
import { metricasPipeline, type FiltrosRelatorio } from "@/server/relatorios/pipeline";
import { metricasFunil } from "@/server/relatorios/funil";
import { desempenhoEquipe } from "@/server/relatorios/equipe";
import { metricasAriaEquipe } from "@/server/relatorios/aria";
import { metricasAtividades } from "@/server/relatorios/atividades";
import type { EscopoRelatorio } from "@/server/relatorios/escopo";

export type IdAba = "visao" | "funil" | "equipe" | "aria" | "conversas" | "atividades";

export type Carga = { aba: IdAba; dados: unknown; anterior: unknown };

/** Cada métrica é chamada duas vezes: com o período e com o período imediatamente anterior (para a variação). */
export async function carregar(aba: IdAba, f: FiltrosRelatorio, fa: FiltrosRelatorio, e: EscopoRelatorio): Promise<Carga> {
  const duas = async <T,>(fn: (f: FiltrosRelatorio, e: EscopoRelatorio) => Promise<T>) => {
    const [dados, anterior] = await Promise.all([fn(f, e), fn(fa, e)]);
    return { dados, anterior };
  };
  if (aba === "visao") {
    const [p, a] = await Promise.all([duas(metricasPipeline), duas(metricasAtendimento)]);
    return { aba, dados: { pipeline: { atual: p.dados, anterior: p.anterior }, atendimento: { atual: a.dados, anterior: a.anterior } }, anterior: null };
  }
  const mapa = { funil: metricasFunil, equipe: desempenhoEquipe, aria: metricasAriaEquipe, conversas: metricasAtendimento, atividades: metricasAtividades } as const;
  const r = await duas(mapa[aba] as (f: FiltrosRelatorio, e: EscopoRelatorio) => Promise<unknown>);
  return { aba, ...r };
}

