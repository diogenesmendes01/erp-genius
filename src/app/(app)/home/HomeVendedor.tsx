import Link from "next/link";
import {
  IconFlame,
  IconAlertTriangle,
  IconCalendarEvent,
  IconCoin,
  IconCircleCheck,
  type IconProps,
} from "@tabler/icons-react";
import { ETAPA_LABEL } from "@/lib/labels";
import type { dadosHomeVendedor } from "@/server/home/consultas";

type Dados = Awaited<ReturnType<typeof dadosHomeVendedor>>;

type Icone = React.ComponentType<IconProps>;

const PRIO: Record<string, { Icon: Icone; iconCls: string; cls: string }> = {
  quente: { Icon: IconFlame, iconCls: "text-red-500", cls: "border-l-red-500" },
  atencao: { Icon: IconAlertTriangle, iconCls: "text-amber-500", cls: "border-l-amber-500" },
  agenda: { Icon: IconCalendarEvent, iconCls: "text-blue-500", cls: "border-l-blue-500" },
  proposta: { Icon: IconCoin, iconCls: "text-green-500", cls: "border-l-green-500" },
};

function Card({ titulo, valor, cls }: { titulo: string; valor: string; cls: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className={"text-2xl font-medium " + cls}>{valor}</div>
      <div className="text-xs text-gray-500">{titulo}</div>
    </div>
  );
}

const FAIXA: Record<keyof typeof PRIO, string> = {
  quente: "Alta",
  atencao: "Média",
  agenda: "Alta",
  proposta: "Média",
};

export function HomeVendedor({ nome, dados }: { nome: string; dados: Dados }) {
  const { cards, sla, fila, agenda, kanban, metaMes } = dados;
  const oportunidades = fila.slice(0, 3);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-medium">Olá, {nome.split(" ")[0]}</h1>
        <div className="flex gap-4 text-sm">
          <span className="text-gray-600">SLA do dia: <strong className="text-green-600">{sla.pct}%</strong></span>
          <span className="text-gray-600">Leads atrasados: <strong className={sla.atrasados > 0 ? "text-red-600" : "text-gray-700"}>{sla.atrasados}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card titulo="Leads novos" valor={String(cards.leadsNovos)} cls="text-red-600" />
        <Card titulo="Follow-ups vencidos" valor={String(cards.followVencidos)} cls="text-amber-600" />
        <Card titulo="Experimentais hoje" valor={String(cards.experimentaisHoje)} cls="text-blue-600" />
        <Card
          titulo="Comissão prevista"
          valor={`${cards.moedaComissao} ${cards.comissaoPrevista.toLocaleString("pt-BR")}`}
          cls="text-green-600"
        />
      </div>

      {oportunidades.length > 0 && (
        <section className="rounded-lg border border-brand-200 bg-brand-50 p-4">
          <h2 className="mb-3 font-medium text-brand-800">Oportunidades de hoje</h2>
          <ul className="flex flex-col gap-2">
            {oportunidades.map((o) => (
              <li key={o.id} className="flex items-center justify-between rounded-md bg-surface px-3 py-2">
                <div className="flex items-center">
                  {(() => {
                    const { Icon, iconCls } = PRIO[o.prioridade];
                    return <Icon className={"mr-2 h-4 w-4 " + iconCls} />;
                  })()}
                  <Link href={`/leads/${o.id}`} className="font-medium text-brand-700 hover:underline">{o.nome}</Link>
                  <span className="ml-2 text-sm text-gray-500">{o.motivo}</span>
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Prioridade {FAIXA[o.prioridade]}</span>
                </div>
                <Link href={`/leads/${o.id}`} className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700">Atender</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Fila de trabalho</h2>
          {fila.length > 0 && (
            <Link href={`/leads/${fila[0].id}`} className="rounded-md border border-brand-300 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
              Próximo lead →
            </Link>
          )}
        </div>
        {fila.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-gray-400">
            <IconCircleCheck className="h-4 w-4 text-green-600" /> Tudo em dia
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {fila.map((f) => (
              <li key={f.id} className={"flex items-center justify-between border-l-4 bg-gray-50 px-3 py-2 " + PRIO[f.prioridade].cls}>
                <div className="flex items-center">
                  {(() => {
                    const { Icon, iconCls } = PRIO[f.prioridade];
                    return <Icon className={"mr-2 h-4 w-4 " + iconCls} />;
                  })()}
                  <Link href={`/leads/${f.id}`} className="font-medium text-brand-700 hover:underline">
                    {f.nome}
                  </Link>
                  <span className="ml-2 text-sm text-gray-500">{f.motivo}</span>
                </div>
                <Link href={`/leads/${f.id}`} className="text-xs text-gray-500 hover:text-gray-800">
                  Atender →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-3 font-medium">Agenda de hoje</h2>
          {agenda.length === 0 ? (
            <p className="text-sm text-gray-400">Sem experimentais hoje.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {agenda.map((a) => (
                <li key={a.id}>
                  <span className="text-gray-500">
                    {new Date(a.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>{" "}
                  — <Link href={`/leads/${a.id}`} className="text-brand-700 hover:underline">{a.nome}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-3 font-medium">Meta do mês</h2>
          <div className="mb-2 text-sm text-gray-600">
            {metaMes.feitas} de {metaMes.meta} matrículas
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-brand-600"
              style={{ width: `${Math.min(100, (metaMes.feitas / metaMes.meta) * 100)}%` }}
            />
          </div>
          <div className="mt-4 text-xs text-gray-500">
            Funil: {kanban.map((k) => `${ETAPA_LABEL[k.etapa]} (${k.total})`).join(" · ")}
          </div>
        </section>
      </div>
    </div>
  );
}
