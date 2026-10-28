import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          <Table className="min-w-[36rem]">
            <TableHeader>
              <TableRow className="text-left text-gray-600 hover:bg-transparent">
                <TableHead scope="col" className="p-2">Etapa</TableHead>
                <TableHead scope="col" className="p-2">Chegaram</TableHead>
                <TableHead scope="col" className="p-2">Variação</TableHead>
                <TableHead scope="col" className="p-2">Agora</TableHead>
                <TableHead scope="col" className="p-2">Conversão para a próxima</TableHead>
                <TableHead scope="col" className="p-2">Tempo médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.etapas.map((e) => (
                <TableRow key={e.etapa}>
                  <TableHead scope="row" className="p-2 text-left font-normal">
                    <Link
                      href={hrefRelatorio(params, { detalhe: "etapa:" + e.etapa, busca: null })}
                      className={link}
                      title="Ver oportunidades agora nesta etapa"
                      aria-label={`${rotular(ETAPA_LABEL, e.etapa)}: ver oportunidades agora nesta etapa`}
                    >
                      {rotular(ETAPA_LABEL, e.etapa)}
                    </Link>
                  </TableHead>
                  <TableCell className="p-2">{fmtInteiro(e.chegaram)}</TableCell>
                  <TableCell className="p-2">{variacaoTexto(e.chegaram, antes.get(e.etapa)?.chegaram ?? null)}</TableCell>
                  <TableCell className="p-2">{fmtInteiro(e.agora)}</TableCell>
                  <TableCell className="p-2">{fmtPct(e.conversaoProxima)}</TableCell>
                  <TableCell className="p-2">{fmtDias(e.tempoMedioDias)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
