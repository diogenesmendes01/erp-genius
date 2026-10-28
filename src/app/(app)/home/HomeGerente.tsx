import Link from "next/link";
import { IconAlertTriangle } from "@tabler/icons-react";
import { ETAPA_LABEL } from "@/lib/labels";
import { formatarValores } from "@/lib/dinheiro";
import type { dadosHomeGerente } from "@/server/home/consultas";
import { EstadoVazio } from "@/components/EstadoVazio";

type Dados = Awaited<ReturnType<typeof dadosHomeGerente>>;

function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className="text-2xl font-medium text-gray-800">{valor}</div>
      <div className="text-xs text-gray-500">{titulo}</div>
      {detalhe && <div data-kpi-detalhe="" className="mt-1 text-xs text-gray-500">{detalhe}</div>}
    </div>
  );
}

export function HomeGerente({ nome, dados }: { nome: string; dados: Dados }) {
  const { kpis, indicadores, funil } = dados;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium">Painel — {nome.split(" ")[0]}</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi titulo="Leads hoje" valor={String(kpis.leadsHoje)} />
        <Kpi titulo="Conversão" valor={`${kpis.conversao}%`} />
        <Kpi
          titulo="Matrículas ativadas no mês"
          valor={String(kpis.matriculasMes)}
          detalhe={kpis.metaMatriculasMes ? `Meta do funil: ${kpis.metaMatriculasMes.realizado} de ${kpis.metaMatriculasMes.meta} leads em Matriculado` : undefined}
        />
        <Kpi titulo="Recebido no mês" valor={formatarValores(kpis.receitaMes)} />
      </div>

      <Link href="/financeiro/aprovacoes" className="rounded-lg border border-gray-200 bg-surface p-4 hover:border-brand-300">
        <div className="text-2xl font-medium text-gray-800">{kpis.aprovacoesPendentes}</div>
        <div className="text-xs text-gray-500">Aprovações pendentes de desconto e alçada</div>
      </Link>

      {kpis.alertasSla > 0 && (
        <Link href="/inbox?prazo=estourado&setor=COMERCIAL" className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 hover:border-amber-300">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          <span>SLA do inbox: <strong>{kpis.alertasSla}</strong> atendimento(s) comercial(is) com a primeira resposta além do prazo.</span>
        </Link>
      )}

      {kpis.checkInsVencidos > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Check-in vencido: <strong>{kpis.checkInsVencidos}</strong> experimental(is) já ocorrida(s) sem
            registro de Compareceu/Faltou.
          </span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-3 font-medium">Gargalos do funil</h2>
          {funil.length === 0 ? (
            <EstadoVazio>Nenhuma oportunidade no escopo.</EstadoVazio>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {funil.map((f) => (
                <li key={f.etapa}>
                  <Link href="/funil?modo=lista" className="flex justify-between gap-3 rounded px-1 py-0.5 hover:bg-gray-50">
                    <span className="text-gray-700">{ETAPA_LABEL[f.etapa]}</span>
                    <span className="text-gray-500">{f.total}{f.paradas > 0 ? ` · ${f.paradas} paradas` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-1 font-medium">Indicadores da equipe</h2>
          <p className="mb-3 text-xs text-gray-500">SLA e retornos do inbox, experimentais realizadas que viraram matrícula no mês, e oportunidades paradas.</p>
          {indicadores.length === 0 ? (
            <EstadoVazio>Sem vendedores ativos.</EstadoVazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-gray-500">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Vendedor</th>
                    <th className="py-1 pr-2 font-medium">Inbox</th>
                    <th className="py-1 pr-2 font-medium">Experimental → matrícula</th>
                    <th className="py-1 font-medium">Paradas</th>
                  </tr>
                </thead>
                <tbody>
                  {indicadores.map((v) => (
                    <tr key={v.id} className="border-t border-gray-100">
                      <td className="py-1 pr-2 text-gray-800">{v.nome}</td>
                      <td className="py-1 pr-2">
                        <Link href={`/inbox?responsavel=${encodeURIComponent(v.id)}`} className="text-brand-700 hover:underline">
                          {v.atendimentosSlaEstourado} SLA · {v.retornosPendentes} retornos
                        </Link>
                      </td>
                      <td className="py-1 pr-2 text-gray-600">
                        {v.experimentaisRealizadasMes} → {v.matriculadosMes}
                        {v.taxaConversao !== null ? ` (${v.taxaConversao}%)` : ""}
                      </td>
                      <td className="py-1">
                        <Link href={`/funil?donoId=${encodeURIComponent(v.id)}`} className="text-brand-700 hover:underline">{v.oportunidadesParadas}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
