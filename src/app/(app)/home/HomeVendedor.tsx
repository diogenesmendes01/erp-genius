import Link from "next/link";
import type { ReactNode } from "react";
import type { MetricaMeta, StatusComissao } from "@prisma/client";
import { METRICA_META_LABEL, STATUS_COMISSAO_LABEL, rotular } from "@/lib/labels";
import { formatarMoedaOuIndefinida } from "@/lib/dinheiro";
import type { dadosHomeVendedor } from "@/server/home/consultas";
import { Avatar } from "@/components/Avatar";
import { BadgeEstado, type TomEstado } from "@/components/BadgeEstado";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";

type Dados = Awaited<ReturnType<typeof dadosHomeVendedor>>;
type Meta = Dados["metaMes"][number];
type Valor = { moeda: string | null; valor: number; status?: StatusComissao };

const LINK_FANTASMA = `${botaoClasses({ variante: "fantasma", tamanho: "sm" })} mt-3`;

function textoMeta(metrica: MetricaMeta, valor: number, moeda: string | null) {
  return metrica === "VALOR_GANHO" ? formatarMoedaOuIndefinida(valor, moeda) : String(valor);
}

function percentualMeta(meta: Meta) {
  if (meta.pct === null) return 0;
  return Math.min(100, Math.max(0, Math.round(meta.pct * 100)));
}

function Moldura({ children }: { children: ReactNode }) {
  return <article className="rounded-lg border border-gray-200 bg-surface p-4">{children}</article>;
}

function Termometro({ meta }: { meta: Meta }) {
  const pct = percentualMeta(meta);
  const realizado = textoMeta(meta.metrica, meta.realizado, meta.moeda);
  const alvo = textoMeta(meta.metrica, meta.meta, meta.moeda);
  const faltam = textoMeta(meta.metrica, meta.faltam, meta.moeda);
  return (
    <Moldura>
      <h3 className="text-sm font-medium text-gray-800">
        {METRICA_META_LABEL[meta.metrica]}
        {meta.moeda ? ` (${meta.moeda})` : ""}
      </h3>
      <p className="mt-1 font-mono text-sm tabular-nums text-gray-600">
        {realizado} de {alvo}
        {" · "}
        {meta.faltam <= 0 ? "meta atingida" : `faltam ${faltam}`}
      </p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${METRICA_META_LABEL[meta.metrica]}: ${pct}%`}
      >
        <div className="h-full rounded-full bg-brand-solid transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {meta.pct === null ? "Sem percentual: a meta está zerada." : <span className="font-mono tabular-nums">{pct}% da meta</span>}
      </p>
    </Moldura>
  );
}

function Valores({ itens, vazio }: { itens: Valor[]; vazio: string }) {
  if (itens.length === 0) return <EstadoVazio>{vazio}</EstadoVazio>;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {itens.map((i) => (
        <li key={`${i.moeda ?? "sem"}-${i.status ?? "total"}`} className="flex justify-between gap-3">
          <span className="text-gray-600">{i.status ? rotular(STATUS_COMISSAO_LABEL, i.status) : "Total"}</span>
          <span className="font-mono font-medium tabular-nums text-gray-800">{formatarMoedaOuIndefinida(i.valor, i.moeda)}</span>
        </li>
      ))}
    </ul>
  );
}

function LinhaTrabalho({ href, nome, detalhe, badge }: { href: string; nome: string; detalhe?: string; badge: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex min-h-[52px] items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-muted">
        <Avatar nome={nome} tamanho={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-gray-900">{nome}</div>
          {detalhe ? <div className="truncate text-xs text-gray-500">{detalhe}</div> : null}
        </div>
        {badge}
      </Link>
    </li>
  );
}

function CartaoFila({ titulo, contagem, tom, children, rodape }: {
  titulo: string;
  contagem: number;
  tom: TomEstado;
  children: ReactNode;
  rodape: { href: string; rotulo: string };
}) {
  return (
    <Moldura>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-medium">{titulo}</h2>
        <BadgeEstado tom={contagem > 0 ? tom : "neutro"} className="font-mono tabular-nums">{contagem}</BadgeEstado>
      </div>
      {children}
      <Link href={rodape.href} className={LINK_FANTASMA}>{rodape.rotulo}</Link>
    </Moldura>
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
        <Moldura>
          <h2 className="mb-2 font-medium">Confirmadas no mês</h2>
          <p className="mb-2 text-xs text-gray-500">Aprovadas ou pagas nesta competência.</p>
          <Valores itens={dados.comissoesConfirmadas} vazio="Nenhuma comissão confirmada neste mês." />
          <Link href="/comissoes" className={LINK_FANTASMA}>Ver extrato completo →</Link>
        </Moldura>
        <Moldura>
          <h2 className="mb-2 font-medium">Previstas — aguardando a taxa</h2>
          <p className="mb-2 text-xs text-gray-500">Já geradas, ainda pendentes de liquidação.</p>
          <Valores itens={dados.comissoesPendentesLiquidacao} vazio="Nenhuma comissão aguardando pagamento da taxa." />
        </Moldura>
        <Moldura>
          <h2 className="mb-2 font-medium">Previstas — pipeline aberto</h2>
          <p className="mb-2 text-xs text-gray-500">Potencial nas oportunidades ainda abertas.</p>
          <Valores itens={dados.comissoesPipelineAberto} vazio="Nenhuma comissão prevista no pipeline." />
        </Moldura>
      </section>

      <section aria-label="Próximas ações" className="grid gap-6 md:grid-cols-3">
        <CartaoFila
          titulo="Retornos pendentes"
          contagem={dados.retornos.total}
          tom="sem-resposta"
          rodape={{ href: "/inbox", rotulo: "Ver inbox →" }}
        >
          {dados.retornos.itens.length === 0 ? (
            <EstadoVazio>Nenhuma conversa aguardando a sua resposta.</EstadoVazio>
          ) : (
            <ul className="flex list-none flex-col">
              {dados.retornos.itens.map((r) => (
                <LinhaTrabalho
                  key={r.id}
                  href={r.href}
                  nome={r.nome}
                  badge={<BadgeEstado tom="sem-resposta" ponto>Aguardando retorno</BadgeEstado>}
                />
              ))}
            </ul>
          )}
          {dados.retornos.total > dados.retornos.itens.length && (
            <p className="mt-2 font-mono text-xs tabular-nums text-gray-500">e mais {dados.retornos.total - dados.retornos.itens.length}</p>
          )}
        </CartaoFila>

        <CartaoFila
          titulo="Tarefas de hoje e atrasadas"
          contagem={dados.tarefas.total}
          tom="aviso"
          rodape={{ href: "/tarefas", rotulo: "Ver todas as tarefas →" }}
        >
          {dados.tarefas.itens.length === 0 ? (
            <EstadoVazio>Nada para hoje.</EstadoVazio>
          ) : (
            <ul className="flex list-none flex-col">
              {dados.tarefas.itens.map((t) => (
                <LinhaTrabalho
                  key={t.id}
                  href={t.href}
                  nome={t.titulo}
                  badge={<BadgeEstado tom={t.atrasada ? "atraso" : "aviso"} ponto>{t.atrasada ? "atrasada" : "Hoje"}</BadgeEstado>}
                />
              ))}
            </ul>
          )}
        </CartaoFila>

        <CartaoFila
          titulo="Oportunidades prioritárias"
          contagem={dados.oportunidadesPrioritarias.length}
          tom="brand"
          rodape={{ href: "/funil", rotulo: "Ver funil →" }}
        >
          {dados.oportunidadesPrioritarias.length === 0 ? (
            <EstadoVazio>Nenhuma oportunidade pedindo ação agora.</EstadoVazio>
          ) : (
            <ul className="flex list-none flex-col">
              {dados.oportunidadesPrioritarias.map((o) => (
                <LinhaTrabalho
                  key={o.id}
                  href={o.href}
                  nome={o.nome}
                  detalhe={o.motivo}
                  badge={<BadgeEstado tom="brand" ponto>{o.motivo}</BadgeEstado>}
                />
              ))}
            </ul>
          )}
        </CartaoFila>
      </section>
    </div>
  );
}
