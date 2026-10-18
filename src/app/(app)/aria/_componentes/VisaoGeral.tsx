import Link from "next/link";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import type { VisaoGeralAria } from "@/server/aria/consultas";

type Props = { visao: VisaoGeralAria; dias: 1 | 7 | 30; nome: string };

const PERIODOS: { dias: 1 | 7 | 30; rotulo: string }[] = [
  { dias: 1, rotulo: "Hoje" },
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
];
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const usd = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "USD" });

export function VisaoGeral({ visao, dias, nome }: Props) {
  const indicadores: { rotulo: string; dado: string; apoio?: string }[] = [
    { rotulo: "Conversas atendidas", dado: String(visao.conversas) },
    { rotulo: "Passaram para uma pessoa", dado: pct(visao.taxaHandoff), apoio: visao.tempoMedioAteHandoffMin === null ? undefined : `em média após ${visao.tempoMedioAteHandoffMin} min` },
    { rotulo: "Etapas avançadas", dado: String(visao.etapasAvancadas) },
    { rotulo: "Tarefas criadas", dado: String(visao.tarefasCriadas) },
    { rotulo: "Campos preenchidos", dado: String(visao.camposPreenchidos) },
    { rotulo: "Sugestões aprovadas sem edição", dado: pct(visao.aprovadasSemEdicao) },
    { rotulo: "Ações desfeitas", dado: pct(visao.desfeitas) },
  ];
  if (visao.custoUsd !== null) indicadores.push({ rotulo: "Custo do provedor", dado: usd(visao.custoUsd) });
  const maximo = Math.max(1, ...visao.volume.map((v) => v.resolvidas + v.comHandoff));

  return (
    <section aria-labelledby="titulo-visao" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-visao" className="text-lg font-semibold text-gray-900">Como {nome} está indo</h2>
        <nav aria-label="Período" className="flex gap-1">
          {PERIODOS.map((p) => (
            <Link
              key={p.dias}
              href={p.dias === 7 ? "/aria" : `/aria?dias=${p.dias}`}
              aria-current={p.dias === dias ? "page" : undefined}
              className={botaoClasses({ variante: p.dias === dias ? "primario" : "fantasma" })}
            >
              {p.rotulo}
            </Link>
          ))}
        </nav>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map((i) => (
          <div key={i.rotulo} className="rounded-lg border border-border-soft p-3">
            <dt className="text-sm text-gray-600">{i.rotulo}</dt>
            <dd className="mt-1 text-2xl font-semibold text-gray-900">{i.dado}</dd>
            {i.apoio && <dd className="text-xs text-gray-600">{i.apoio}</dd>}
          </div>
        ))}
      </dl>

      <div>
        <h3 className="text-base font-semibold text-gray-900">Volume de conversas</h3>
        {visao.volume.every((v) => v.resolvidas + v.comHandoff === 0) ? (
          <EstadoVazio className="mt-2">Nenhuma conversa no período.</EstadoVazio>
        ) : (
          <ul className="mt-2 space-y-1">
            {visao.volume.map((v) => (
              <li key={v.dia} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-gray-700">{v.dia.split("-").reverse().slice(0, 2).join("/")}</span>
                <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={`${v.resolvidas} resolvidas pela ${nome} e ${v.comHandoff} com transferência`}>
                  <span className="bg-green-700" style={{ width: `${(v.resolvidas / maximo) * 100}%` }} />
                  <span className="bg-amber-600" style={{ width: `${(v.comHandoff / maximo) * 100}%` }} />
                </span>
                <span className="w-28 shrink-0 text-gray-700">{v.resolvidas} + {v.comHandoff}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-gray-600">Verde: resolvidas pela {nome}. Âmbar: passaram para uma pessoa.</p>
      </div>
    </section>
  );
}
