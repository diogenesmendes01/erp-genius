import { ETAPA_LABEL } from "@/lib/labels";
import type { dadosHomeGerente } from "@/server/home/consultas";

type Dados = Awaited<ReturnType<typeof dadosHomeGerente>>;

function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className="text-2xl font-semibold text-gray-800">{valor}</div>
      <div className="text-xs text-gray-500">{titulo}</div>
    </div>
  );
}

export function HomeGerente({ nome, dados }: { nome: string; dados: Dados }) {
  const { kpis, ranking, funil } = dados;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium">Painel — {nome.split(" ")[0]}</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi titulo="Leads hoje" valor={String(kpis.leadsHoje)} />
        <Kpi titulo="Conversão" valor={`${kpis.conversao}%`} />
        <Kpi titulo="Matrículas no mês" valor={String(kpis.matriculasMes)} />
        <Kpi titulo="Recebido no mês" valor={kpis.receitaMes.toLocaleString("pt-BR")} />
      </div>

      {kpis.alertasSla > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          ⚠️ Alertas de SLA: <strong>{kpis.alertasSla}</strong> lead(s) novo(s) sem 1º contato além do limite.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-3 font-medium">Ranking de vendedores</h2>
          {ranking.length === 0 ? (
            <p className="text-sm text-gray-400">Sem vendedores.</p>
          ) : (
            <ol className="flex flex-col gap-1 text-sm">
              {ranking.map((r, i) => (
                <li key={r.nome} className="flex justify-between">
                  <span className="text-gray-700">
                    {i + 1}. {r.nome}
                  </span>
                  <span className="text-gray-500">{r.matriculados} matrículas</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-xs text-gray-400">Critério "justo" (volume/qualidade) — refinar (P10).</p>
        </section>

        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-3 font-medium">Funil</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {funil.map((f) => (
              <li key={f.etapa} className="flex justify-between">
                <span className="text-gray-700">{ETAPA_LABEL[f.etapa]}</span>
                <span className="text-gray-500">{f.total}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Equipe</h2>
        {dados.equipe.length === 0 ? (
          <p className="text-sm text-gray-400">Sem vendedores ativos.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dados.equipe.map((nome) => (
              <span key={nome} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{nome}</span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
