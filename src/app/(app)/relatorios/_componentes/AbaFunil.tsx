import Link from "next/link";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ETAPA_LABEL, MOTIVO_PERDA_LABEL, rotular } from "@/lib/labels";
import type { EtapaFunil, PerdaFunil } from "@/server/relatorios/funil";
import { fmtDias, fmtInteiro, fmtPct, hrefRelatorio, variacaoTexto, type ParamsRelatorio } from "./formato";

type Dados = { etapas: EtapaFunil[]; perdas: PerdaFunil[] };

export function AbaFunil({ dados, anterior, params }: { dados: Dados; anterior: Dados; params: ParamsRelatorio }) {
  const antes = new Map(anterior.etapas.map((e) => [e.etapa, e]));
  const link = "text-brand-700 hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center";
  const vazio = dados.etapas.every((e) => e.chegaram === 0) && dados.perdas.length === 0;
  if (vazio) return <EstadoVazio bloco>Nenhuma oportunidade no funil neste período e com estes filtros.</EstadoVazio>;
  return (
    <div className="space-y-5">
      <section aria-labelledby="funil-etapas" className="space-y-1 text-sm">
        <h2 id="funil-etapas" className="font-medium">Funil por etapa</h2>
        <p className="text-xs text-gray-600">O nome da etapa abre as oportunidades que estão nela agora.</p>
        <div className="overflow-x-auto rounded-lg border border-border-soft">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th scope="col" className="p-2">Etapa</th>
                <th scope="col" className="p-2">Chegaram</th>
                <th scope="col" className="p-2">Variação</th>
                <th scope="col" className="p-2">Agora</th>
                <th scope="col" className="p-2">Conversão para a próxima</th>
                <th scope="col" className="p-2">Tempo médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {dados.etapas.map((e) => (
                <tr key={e.etapa}>
                  <th scope="row" className="p-2 text-left font-normal">
                    {/* O painel da etapa é o retrato atual (coluna "Agora"), não as que chegaram no período. */}
                    <Link
                      href={hrefRelatorio(params, { detalhe: "etapa:" + e.etapa, busca: null })}
                      className={link}
                      title="Ver oportunidades agora nesta etapa"
                      aria-label={`${rotular(ETAPA_LABEL, e.etapa)}: ver oportunidades agora nesta etapa`}
                    >
                      {rotular(ETAPA_LABEL, e.etapa)}
                    </Link>
                  </th>
                  <td className="p-2">{fmtInteiro(e.chegaram)}</td>
                  <td className="p-2">{variacaoTexto(e.chegaram, antes.get(e.etapa)?.chegaram ?? null)}</td>
                  <td className="p-2">{fmtInteiro(e.agora)}</td>
                  <td className="p-2">{fmtPct(e.conversaoProxima)}</td>
                  <td className="p-2">{fmtDias(e.tempoMedioDias)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="funil-perdas" className="space-y-1 text-sm">
        <h2 id="funil-perdas" className="font-medium">Motivos de perda</h2>
        {dados.perdas.length === 0 ? (
          <EstadoVazio>Nenhuma perda no período.</EstadoVazio>
        ) : (
          <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
            {dados.perdas.map((p) => (
              <li key={p.motivo} className="flex flex-wrap justify-between gap-2 p-3">
                <Link href={hrefRelatorio(params, { detalhe: `perda:${p.motivo}`, busca: null })} className={link}>{rotular(MOTIVO_PERDA_LABEL, p.motivo)}</Link>
                <span>
                  {fmtInteiro(p.quantidade)}
                  {p.etapaMaisComum && <span className="text-gray-600"> · mais comum em {rotular(ETAPA_LABEL, p.etapaMaisComum)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
