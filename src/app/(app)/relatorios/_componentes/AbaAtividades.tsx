import { EstadoVazio } from "@/components/EstadoVazio";
import type { MetricasAtividades } from "@/server/relatorios/atividades";
import { fmtInteiro, fmtPct, variacaoTexto } from "./formato";
import { Kpi } from "./Kpi";

export function AbaAtividades({ dados, anterior, mostrarAria }: { dados: MetricasAtividades; anterior: MetricasAtividades; mostrarAria: boolean }) {
  return (
    <div className="space-y-5">
      <section aria-label="Indicadores de atividades" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi rotulo="Tarefas criadas" valor={fmtInteiro(dados.tarefasCriadas)} variacao={variacaoTexto(dados.tarefasCriadas, anterior.tarefasCriadas)} anterior={fmtInteiro(anterior.tarefasCriadas)} />
        <Kpi rotulo="Tarefas concluídas" valor={fmtPct(dados.tarefasConcluidasPct)} variacao={variacaoTexto(dados.tarefasConcluidasPct, anterior.tarefasConcluidasPct)} anterior={fmtPct(anterior.tarefasConcluidasPct)} />
        <Kpi rotulo="Mensagens agendadas" valor={fmtInteiro(dados.mensagensAgendadas)} variacao={variacaoTexto(dados.mensagensAgendadas, anterior.mensagensAgendadas)} anterior={fmtInteiro(anterior.mensagensAgendadas)} />
      </section>
      <section aria-labelledby="atividades-dia" className="space-y-1 text-sm">
        <h2 id="atividades-dia" className="font-medium">Tarefas criadas e concluídas por dia</h2>
        {dados.porDia.length === 0 ? (
          <EstadoVazio>Nenhuma tarefa no período.</EstadoVazio>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-soft">
            <table className="w-full min-w-[20rem] text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th scope="col" className="p-2">Dia</th>
                  <th scope="col" className="p-2">Criadas</th>
                  <th scope="col" className="p-2">Concluídas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {dados.porDia.map((d) => (
                  <tr key={d.dia}>
                    <th scope="row" className="p-2 text-left font-normal">{d.dia.split("-").reverse().join("/")}</th>
                    <td className="p-2">{fmtInteiro(d.criadas)}</td>
                    <td className="p-2">{fmtInteiro(d.concluidas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {mostrarAria && (
        <section aria-labelledby="atividades-origem" className="space-y-1 text-sm">
          <h2 id="atividades-origem" className="font-medium">Quem fez</h2>
          <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
            {dados.porOrigem.map((o) => (
              <li key={o.origem} className="flex flex-wrap justify-between gap-2 p-3">
                <span>{o.origem === "ARIA" ? "Aria" : "Equipe"}</span>
                <span>{fmtInteiro(o.tarefas)} tarefas · {fmtInteiro(o.mensagens)} mensagens agendadas</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
