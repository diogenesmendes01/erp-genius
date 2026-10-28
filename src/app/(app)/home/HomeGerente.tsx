import Link from "next/link";
import type { ReactNode } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import { ETAPA_LABEL } from "@/lib/labels";
import { formatarValores } from "@/lib/dinheiro";
import type { dadosHomeGerente } from "@/server/home/consultas";
import { Avatar } from "@/components/Avatar";
import { BadgeEstado } from "@/components/BadgeEstado";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";

type Dados = Awaited<ReturnType<typeof dadosHomeGerente>>;
type Indicador = Dados["indicadores"][number];

function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{valor}</div>
      {detalhe ? <div className="mt-1 text-xs text-gray-500">{detalhe}</div> : null}
    </div>
  );
}

function textoConversao(v: Indicador) {
  const base = `${v.experimentaisRealizadasMes} → ${v.matriculadosMes}`;
  return v.taxaConversao === null ? base : `${base} (${v.taxaConversao}%)`;
}

function Alerta({ children, href }: { children: ReactNode; href?: string }) {
  const classe = "flex items-center gap-2 rounded-lg border border-gray-200 bg-surface px-4 py-2 text-sm text-gray-800";
  const corpo = (
    <>
      <IconAlertTriangle className="h-4 w-4 shrink-0 text-gray-600" />
      {children}
    </>
  );
  if (href) return <Link href={href} className={classe}>{corpo}</Link>;
  return <div className={classe}>{corpo}</div>;
}

export function HomeGerente({ nome, dados }: { nome: string; dados: Dados }) {
  const { kpis, indicadores, funil } = dados;
  const picoFunil = Math.max(1, ...funil.map((f) => f.total));
  const aprovacoesEmAberto = kpis.aprovacoesPendentes > 0;
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

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-2xl font-semibold tabular-nums">{kpis.aprovacoesPendentes}</div>
            <div className="mt-1 text-xs text-gray-500">Aprovações pendentes de desconto e alçada</div>
          </div>
          <BadgeEstado tom={aprovacoesEmAberto ? "aprovacao" : "neutro"} ponto>
            {aprovacoesEmAberto ? "Requer atenção" : "Em dia"}
          </BadgeEstado>
        </div>
        <Link href="/financeiro/aprovacoes" className={`${botaoClasses({ variante: "secundario", tamanho: "sm" })} mt-3`}>
          Abrir aprovações
        </Link>
      </section>

      {kpis.alertasSla > 0 && (
        <Alerta href="/inbox?prazo=estourado&setor=COMERCIAL">
          <BadgeEstado tom="atraso" ponto className="font-mono tabular-nums">{kpis.alertasSla}</BadgeEstado>
          <span>SLA do inbox: <strong>{kpis.alertasSla}</strong> atendimento(s) comercial(is) com a primeira resposta além do prazo.</span>
        </Alerta>
      )}

      {kpis.checkInsVencidos > 0 && (
        <Alerta>
          <BadgeEstado tom="atraso" ponto className="font-mono tabular-nums">{kpis.checkInsVencidos}</BadgeEstado>
          <span>
            Check-in vencido: <strong>{kpis.checkInsVencidos}</strong> experimental(is) já ocorrida(s) sem
            registro de Compareceu/Faltou.
          </span>
        </Alerta>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-3 font-medium">Gargalos do funil</h2>
          {funil.length === 0 ? (
            <EstadoVazio>Nenhuma oportunidade no escopo.</EstadoVazio>
          ) : (
            <ul className="flex list-none flex-col gap-2">
              {funil.map((f) => {
                const largura = Math.min(100, Math.max(0, Math.round((f.total / picoFunil) * 100)));
                return (
                  <li key={f.etapa}>
                    <Link href="/funil?modo=lista" className="block rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-muted">
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-gray-900">{ETAPA_LABEL[f.etapa]}</span>
                        <span className="font-mono text-sm tabular-nums text-gray-800">{f.total}</span>
                      </span>
                      <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                        <span className="block h-full rounded-full bg-brand-solid" style={{ width: `${largura}%` }} />
                      </span>
                      <span className="mt-1.5 flex">
                        <BadgeEstado tom={f.paradas > 0 ? "atraso" : "neutro"} ponto={f.paradas > 0}>
                          <span className="font-mono tabular-nums">{f.paradas} paradas</span>
                        </BadgeEstado>
                      </span>
                    </Link>
                  </li>
                );
              })}
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
                <thead className="border-b border-gray-200 bg-surface-muted text-left text-xs text-gray-600">
                  <tr>
                    <th className="py-2 pr-2 font-medium">Vendedor</th>
                    <th className="py-2 pr-2 font-medium">SLA estourado</th>
                    <th className="py-2 pr-2 font-medium">Retornos pendentes</th>
                    <th className="py-2 pr-2 font-medium">Oportunidades paradas</th>
                    <th className="py-2 font-medium">Conversão no mês</th>
                  </tr>
                </thead>
                <tbody>
                  {indicadores.map((v) => (
                    <tr key={v.id} className="border-t border-gray-100 transition-colors hover:bg-surface-muted">
                      <td className="py-2 pr-2 text-gray-800">
                        <div className="flex items-center gap-2">
                          <Avatar nome={v.nome} tamanho={32} />
                          <span>{v.nome}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <BadgeEstado tom={v.atendimentosSlaEstourado > 0 ? "atraso" : "neutro"} ponto={v.atendimentosSlaEstourado > 0}>
                          <span className="font-mono tabular-nums">{v.atendimentosSlaEstourado}</span>
                        </BadgeEstado>
                      </td>
                      <td className="py-2 pr-2">
                        <Link href={`/inbox?responsavel=${encodeURIComponent(v.id)}`} className="font-mono tabular-nums text-brand-700 hover:underline">
                          {v.retornosPendentes}
                        </Link>
                      </td>
                      <td className="py-2 pr-2">
                        <Link href={`/funil?donoId=${encodeURIComponent(v.id)}`} className="font-mono tabular-nums text-brand-700 hover:underline">
                          {v.oportunidadesParadas}
                        </Link>
                      </td>
                      <td className="py-2">
                        <BadgeEstado tom={v.matriculadosMes > 0 ? "sucesso" : "neutro"} className="font-mono tabular-nums">
                          {textoConversao(v)}
                        </BadgeEstado>
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
