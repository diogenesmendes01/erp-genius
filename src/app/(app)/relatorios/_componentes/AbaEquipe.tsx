import Link from "next/link";
import { EstadoVazio } from "@/components/EstadoVazio";
import type { DesempenhoUsuario } from "@/server/relatorios/equipe";
import { fmtInteiro, fmtMinutos, fmtMoedas, fmtPct, hrefRelatorio, variacaoTexto, type ParamsRelatorio } from "./formato";

export function AbaEquipe({ linhas, anterior, params }: { linhas: DesempenhoUsuario[]; anterior: DesempenhoUsuario[]; params: ParamsRelatorio }) {
  if (linhas.length === 0) return <EstadoVazio bloco>Nenhuma pessoa da equipe neste recorte.</EstadoVazio>;
  const antes = new Map(anterior.map((l) => [l.usuarioId, l]));
  return (
    <section aria-labelledby="equipe-titulo" className="space-y-1 text-sm">
      <h2 id="equipe-titulo" className="font-medium">Desempenho por pessoa</h2>
      <div className="overflow-x-auto rounded-lg border border-border-soft">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="text-left text-gray-600">
              <th scope="col" className="p-2">Pessoa</th>
              <th scope="col" className="p-2">Oportunidades</th>
              <th scope="col" className="p-2">Ganhas</th>
              <th scope="col" className="p-2">Variação das ganhas</th>
              <th scope="col" className="p-2">Conversão</th>
              <th scope="col" className="p-2">Valor ganho</th>
              <th scope="col" className="p-2">Primeira resposta</th>
              <th scope="col" className="p-2">Tarefas concluídas</th>
              <th scope="col" className="p-2">Comissão</th>
              <th scope="col" className="p-2">Meta do mês</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {linhas.map((l) => (
              <tr key={l.usuarioId}>
                <th scope="row" className="p-2 text-left font-normal">
                  <Link href={hrefRelatorio(params, { detalhe: `responsavel:${l.usuarioId}`, busca: null })} className="text-brand-700 hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">{l.nome}</Link>
                </th>
                <td className="p-2">{fmtInteiro(l.oportunidades)}</td>
                <td className="p-2">{fmtInteiro(l.ganhas)}</td>
                <td className="p-2">{variacaoTexto(l.ganhas, antes.get(l.usuarioId)?.ganhas ?? null)}</td>
                <td className="p-2">{fmtPct(l.conversao)}</td>
                <td className="p-2">{fmtMoedas(l.valorGanho)}</td>
                <td className="p-2">{fmtMinutos(l.primeiraRespostaMediaMin)}</td>
                <td className="p-2">{fmtInteiro(l.tarefasConcluidas)}</td>
                <td className="p-2">{fmtMoedas(l.comissao)}</td>
                <td className="p-2">{l.meta.pct == null ? "Sem meta" : fmtPct(l.meta.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
