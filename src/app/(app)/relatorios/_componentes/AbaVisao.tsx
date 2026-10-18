import { EstadoVazio } from "@/components/EstadoVazio";
import type { MetricasPipeline } from "@/server/relatorios/pipeline";
import type { MetricasAtendimento } from "@/server/relatorios/atendimento";
import { fmtDias, fmtInteiro, fmtMinutos, fmtMoedas, fmtPct, hrefRelatorio, variacaoMoedas, variacaoTexto, type ParamsRelatorio } from "./formato";
import { Kpi } from "./Kpi";

type Par<T> = { atual: T; anterior: T };

export function AbaVisao({ pipeline, atendimento, params }: { pipeline: Par<MetricasPipeline>; atendimento: Par<MetricasAtendimento>; params: ParamsRelatorio }) {
  const { atual: p, anterior: pa } = pipeline;
  const { atual: a, anterior: aa } = atendimento;
  const ver = (detalhe: string) => hrefRelatorio(params, { detalhe, busca: null });
  const kpis = [
    { rotulo: "Valor em pipeline", valor: fmtMoedas(p.valorPipeline), variacao: variacaoMoedas(p.valorPipeline, pa.valorPipeline), anterior: fmtMoedas(pa.valorPipeline), complemento: p.semValor > 0 ? `${fmtInteiro(p.semValor)} sem valor` : undefined, href: ver("abertas") },
    { rotulo: "Oportunidades abertas", valor: fmtInteiro(p.abertas), variacao: variacaoTexto(p.abertas, pa.abertas), anterior: fmtInteiro(pa.abertas), href: ver("abertas") },
    { rotulo: "Criadas no período", valor: fmtInteiro(p.criadas), variacao: variacaoTexto(p.criadas, pa.criadas), anterior: fmtInteiro(pa.criadas) },
    { rotulo: "Ganhas", valor: fmtInteiro(p.ganhas), variacao: variacaoTexto(p.ganhas, pa.ganhas), anterior: fmtInteiro(pa.ganhas), href: ver("ganhas") },
    { rotulo: "Conversão", valor: fmtPct(p.conversao), variacao: variacaoTexto(p.conversao, pa.conversao), anterior: fmtPct(pa.conversao) },
    { rotulo: "Ticket médio", valor: fmtMoedas(p.ticketMedio), variacao: variacaoMoedas(p.ticketMedio, pa.ticketMedio), anterior: fmtMoedas(pa.ticketMedio) },
    { rotulo: "Ciclo médio", valor: fmtDias(p.cicloMedioDias), variacao: variacaoTexto(p.cicloMedioDias, pa.cicloMedioDias), anterior: fmtDias(pa.cicloMedioDias) },
    { rotulo: "Primeira resposta", valor: fmtMinutos(a.primeiraRespostaMediaMin), variacao: variacaoTexto(a.primeiraRespostaMediaMin, aa.primeiraRespostaMediaMin), anterior: fmtMinutos(aa.primeiraRespostaMediaMin) },
  ];
  // "O que mudou": regra fixa e legível (variação de 10% ou mais), sem texto gerado por modelo.
  const mudancas = kpis.flatMap((k) => {
    const n = Number(k.variacao.replace("−", "-").replace("%", ""));
    return k.variacao !== "—" && Number.isFinite(n) && Math.abs(n) >= 10 ? [`${k.rotulo}: ${k.variacao} em relação ao período anterior.`] : [];
  });
  return (
    <div className="space-y-5">
      <section aria-label="Indicadores" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => <Kpi key={k.rotulo} {...k} />)}
      </section>
      <section aria-labelledby="o-que-mudou" className="space-y-1 text-sm">
        <h2 id="o-que-mudou" className="font-medium">O que mudou em relação ao período anterior</h2>
        {mudancas.length === 0 ? (
          <EstadoVazio>Nenhuma variação de 10% ou mais nos indicadores.</EstadoVazio>
        ) : (
          <ul className="list-disc space-y-1 ps-5">{mudancas.map((m) => <li key={m}>{m}</li>)}</ul>
        )}
      </section>
    </div>
  );
}
