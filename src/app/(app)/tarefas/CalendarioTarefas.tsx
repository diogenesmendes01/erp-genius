import Link from "next/link";
import { botaoClasses } from "@/components/Botao";
import type { ItemAgenda } from "@/server/crm/mensagens-agendadas";
import { dataCivilDoItem, deslocarData, diasDoMes, hrefTarefas, rotuloDia, rotuloMes, type ParamsTarefas } from "./visao";

const CABECALHO = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Mês: um quadro por dia com a contagem; clicar abre o dia. No celular, só os dias com itens aparecem. */
export function CalendarioTarefas({ data, hoje, itens, fusoEscola, params }: { data: string; hoje: string; itens: ItemAgenda[]; fusoEscola: string; params: ParamsTarefas }) {
  const dias = diasDoMes(data);
  const porDia = new Map<string, { tarefas: number; mensagens: number; titulos: string[] }>();
  for (const i of itens) {
    const d = dataCivilDoItem(i, fusoEscola);
    if (!d) continue;
    const x = porDia.get(d) ?? { tarefas: 0, mensagens: 0, titulos: [] };
    if (i.tipo === "tarefa") { x.tarefas += 1; x.titulos.push(i.tarefa.titulo); } else x.mensagens += 1;
    porDia.set(d, x);
  }
  const mes = data.slice(0, 7);
  return (
    <div className="space-y-3">
      <nav aria-label="Período" className="flex flex-wrap items-center gap-2">
        <Link href={hrefTarefas({ ...params, data: deslocarData("mes", data, -1) })} className={botaoClasses({ variante: "secundario", tamanho: "md" })}>Anterior</Link>
        <Link href={hrefTarefas({ ...params, data: hoje })} className={botaoClasses({ variante: "secundario", tamanho: "md" })}>Hoje</Link>
        <Link href={hrefTarefas({ ...params, data: deslocarData("mes", data, 1) })} className={botaoClasses({ variante: "secundario", tamanho: "md" })}>Próximo</Link>
        <h2 className="text-sm font-medium text-gray-800">{rotuloMes(data)}</h2>
      </nav>
      <div className="hidden text-xs text-gray-600 sm:grid sm:grid-cols-7 sm:gap-1" aria-hidden="true">
        {CABECALHO.map((c) => <span key={c} className="px-1">{c}</span>)}
      </div>
      <ol className="grid grid-cols-1 gap-1 sm:grid-cols-7">
        {dias.map((d) => {
          const x = porDia.get(d);
          const foraDoMes = d.slice(0, 7) !== mes;
          return (
            <li key={d} className={x || d === hoje ? "" : "max-sm:hidden"}>
              <Link
                href={hrefTarefas({ ...params, visao: "dia", data: d })}
                aria-label={`${rotuloDia(d)}${x ? `: ${x.tarefas} tarefas, ${x.mensagens} mensagens` : ""}`}
                className={`block min-h-11 rounded-md border p-2 text-xs hover:bg-highlight sm:min-h-20 ${d === hoje ? "border-brand-600 bg-brand-bg text-brand-800" : "border-gray-200"} ${foraDoMes ? "text-gray-500" : "text-gray-800"}`}
              >
                <span className="font-medium">{Number(d.slice(8))}</span>
                {x && (
                  <span className="mt-1 block space-y-0.5">
                    {x.titulos.slice(0, 2).map((t, k) => <span key={k} className="block truncate">{t}</span>)}
                    <span className="block text-gray-600">
                      {x.tarefas > 0 && `${x.tarefas} ${x.tarefas === 1 ? "tarefa" : "tarefas"}`}
                      {x.tarefas > 0 && x.mensagens > 0 && " · "}
                      {x.mensagens > 0 && `${x.mensagens} ${x.mensagens === 1 ? "mensagem" : "mensagens"}`}
                    </span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
