import Link from "next/link";
import type { MetricaMeta, StatusComissao } from "@prisma/client";
import { METRICA_META_LABEL, STATUS_COMISSAO_LABEL, rotular } from "@/lib/labels";
import { formatarMoedaOuIndefinida } from "@/lib/dinheiro";
import type { dadosHomeVendedor } from "@/server/home/consultas";
import { EstadoVazio } from "@/components/EstadoVazio";

type Dados = Awaited<ReturnType<typeof dadosHomeVendedor>>;
type Meta = Dados["metaMes"][number];
type Valor = { moeda: string | null; valor: number; status?: StatusComissao };

function textoMeta(metrica: MetricaMeta, valor: number, moeda: string | null) {
  return metrica === "VALOR_GANHO" ? formatarMoedaOuIndefinida(valor, moeda) : String(valor);
}

function Termometro({ meta }: { meta: Meta }) {
  const pct = meta.pct === null ? 0 : Math.min(100, Math.round(meta.pct * 100));
  return (
    <article className="rounded-lg border border-gray-200 bg-surface p-4">
      <h3 className="text-sm font-medium text-gray-800">
        {METRICA_META_LABEL[meta.metrica]}
        {meta.moeda ? ` (${meta.moeda})` : ""}
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        {textoMeta(meta.metrica, meta.realizado, meta.moeda)} de {textoMeta(meta.metrica, meta.meta, meta.moeda)}
        {" · "}faltam {textoMeta(meta.metrica, meta.faltam, meta.moeda)}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${METRICA_META_LABEL[meta.metrica]}: ${pct}%`}>
        <div className="h-full rounded-full bg-brand-solid" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-gray-500">{meta.pct === null ? "Sem percentual: a meta está zerada." : `${pct}% da meta`}</p>
    </article>
  );
}

function Valores({ itens, vazio }: { itens: Valor[]; vazio: string }) {
  if (itens.length === 0) return <EstadoVazio>{vazio}</EstadoVazio>;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {itens.map((i) => (
        <li key={`${i.moeda ?? "sem"}-${i.status ?? "total"}`} className="flex justify-between gap-3">
          <span className="text-gray-600">{i.status ? rotular(STATUS_COMISSAO_LABEL, i.status) : "Total"}</span>
          <span className="font-medium text-gray-800">{formatarMoedaOuIndefinida(i.valor, i.moeda)}</span>
        </li>
      ))}
    </ul>
  );
}

export function HomeVendedor({ nome, dados }: { nome: string; dados: Dados }) {
  const prazo = dados.diasRestantesMes === 0 ? "Último dia do mês." : `Faltam ${dados.diasRestantesMes} ${dados.diasRestantesMes === 1 ? "dia" : "dias"} neste mês.`;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-medium">Olá, {nome.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-gray-500">Sua meta de {dados.competencia}. {prazo}</p>
      </header>

      <section aria-label="Meta pessoal do mês" className="flex flex-col gap-3">
        <h2 className="font-medium">Meta pessoal do mês</h2>
        {dados.metaMes.length === 0 ? (
          <EstadoVazio>Nenhuma meta pessoal neste mês.</EstadoVazio>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {dados.metaMes.map((m) => <Termometro key={`${m.metrica}-${m.moeda ?? ""}`} meta={m} />)}
          </div>
        )}
      </section>

      <section aria-label="Comissões" className="grid gap-3 md:grid-cols-3">
        <article className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-2 font-medium">Confirmadas no mês</h2>
          <p className="mb-2 text-xs text-gray-500">Aprovadas ou pagas nesta competência.</p>
          <Valores itens={dados.comissoesConfirmadas} vazio="Nenhuma comissão confirmada neste mês." />
          <Link href="/comissoes" className="mt-3 inline-flex text-sm text-brand-700 hover:underline">Abrir comissões</Link>
        </article>
        <article className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-2 font-medium">Previstas — aguardando a taxa</h2>
          <p className="mb-2 text-xs text-gray-500">Já geradas, ainda pendentes de liquidação.</p>
          <Valores itens={dados.comissoesPendentesLiquidacao} vazio="Nenhuma comissão aguardando pagamento da taxa." />
        </article>
        <article className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-2 font-medium">Previstas — pipeline aberto</h2>
          <p className="mb-2 text-xs text-gray-500">Potencial nas oportunidades ainda abertas.</p>
          <Valores itens={dados.comissoesPipelineAberto} vazio="Nenhuma comissão prevista no pipeline." />
        </article>
      </section>

      <section aria-label="Próximas ações" className="grid gap-6 md:grid-cols-3">
        <article className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-2 font-medium">Retornos pendentes</h2>
          {dados.retornos.itens.length === 0 ? (
            <EstadoVazio>Nenhuma conversa aguardando a sua resposta.</EstadoVazio>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {dados.retornos.itens.map((r) => (
                <li key={r.id}><Link href={r.href} className="text-brand-700 hover:underline">{r.nome}</Link></li>
              ))}
            </ul>
          )}
          {dados.retornos.total > dados.retornos.itens.length && (
            <p className="mt-2 text-xs text-gray-500">e mais {dados.retornos.total - dados.retornos.itens.length}</p>
          )}
          <Link href="/inbox" className="mt-3 inline-flex text-sm text-brand-700 hover:underline">Abrir inbox</Link>
        </article>

        <article className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-2 font-medium">Tarefas de hoje e atrasadas</h2>
          {dados.tarefas.itens.length === 0 ? (
            <EstadoVazio>Nada para hoje.</EstadoVazio>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {dados.tarefas.itens.map((t) => (
                <li key={t.id}>
                  <Link href={t.href} className="text-brand-700 hover:underline">{t.titulo}</Link>
                  {t.atrasada && <span className="ml-2 text-xs text-gray-500">atrasada</span>}
                </li>
              ))}
            </ul>
          )}
          <Link href="/tarefas" className="mt-3 inline-flex text-sm text-brand-700 hover:underline">Abrir tarefas</Link>
        </article>

        <article className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-2 font-medium">Oportunidades prioritárias</h2>
          {dados.oportunidadesPrioritarias.length === 0 ? (
            <EstadoVazio>Nenhuma oportunidade pedindo ação agora.</EstadoVazio>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {dados.oportunidadesPrioritarias.map((o) => (
                <li key={o.id}>
                  <Link href={o.href} className="text-brand-700 hover:underline">{o.nome}</Link>
                  <p className="text-xs text-gray-500">{o.motivo}</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/funil" className="mt-3 inline-flex text-sm text-brand-700 hover:underline">Abrir funil</Link>
        </article>
      </section>
    </div>
  );
}
