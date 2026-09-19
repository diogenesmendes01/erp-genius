import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCancelamentoAgendaRecuperacao } from "@/server/avaliacoes/recuperacao-agenda-cancelamento";
import { IdentificacaoAvaliacao } from "../../../../avaliacoes/Identificacao";
import { Propor, Decidir } from "./Formularios";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
type Item = { id: string; habilidade: string; realizacaoId: string | null; inicio: string | null; fim: string | null; status: string | null; fusoOrigem: string | null };
function Alcance({ itens, preferencia, cancelada = false }: { itens: Item[]; preferencia: string | null; cancelada?: boolean }) {
  return <ul className="list-disc pl-5">{itens.map(i => <li key={i.id}>{i.habilidade.replaceAll("_", " ")}: {i.realizacaoId ? "realização preservada, tentativa permanece consumida" : cancelada ? "tentativa liberada sem consumo" : "tentativa pendente nesta conferência"}.
    {i.inicio && i.fim && (() => {
      const referencia = i.fusoOrigem ?? "UTC";
      const fuso = resolverFusoExibicao(preferencia, referencia);
      const rotuloOrigem = i.fusoOrigem ? `origem ${i.fusoOrigem}` : "referência UTC";
      return <> Encontro: {formatarInstanteExibicao(i.inicio, preferencia, referencia).texto} até {formatarInstanteExibicao(i.fim, preferencia, referencia).texto} ({fuso}; {rotuloOrigem}). Estado: {i.status}.</>;
    })()}
  </li>)}</ul>;
}
export default async function Cancelamento({ params, searchParams }: { params: Promise<{ reservaId: string }>; searchParams: Promise<{ antesId?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { reservaId } = await params, { antesId } = await searchParams;
  const [r, preferencia] = await Promise.all([
    consultarCancelamentoAgendaRecuperacao({ reservaId, ...(antesId ? { antesId } : {}) }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const preferenciaFuso = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const administrativo = resolverFusoExibicao(preferenciaFuso, "UTC");
  return <section className="space-y-4"><h1 className="text-2xl font-medium">Cancelamento da recuperação pela escola</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} /><h2 className="text-xl">Situação atual da reserva</h2><Alcance itens={d.atual.itens} preferencia={preferenciaFuso} cancelada={!!d.atual.cancelamentoId} />
    {d.atual.cancelamentoId && <p>Cancelamento já aplicado. Histórico preservado.</p>}
    {d.podePropor && <Propor reservaId={reservaId} estadoConferido={d.estadoConferido} />}
    {d.propostas.map(p => <article key={p.id} className="space-y-2 rounded border p-4"><h2 className="text-xl">Proposta de {p.autor} — {formatarInstanteExibicao(p.criadaEm, preferenciaFuso, "UTC").texto} ({administrativo}; origem UTC)</h2>
      <p className="whitespace-pre-wrap">{p.motivo}</p><p className="whitespace-pre-wrap">Evidência: {p.evidencia}</p><Alcance itens={p.origem.itens} preferencia={preferenciaFuso} />
      {p.decisao ? <><p>{p.decisao.aprovada ? "Aprovada e aplicada" : "Rejeitada"} por {p.decisao.decisor} em {formatarInstanteExibicao(p.decisao.criadaEm, preferenciaFuso, "UTC").texto} ({administrativo}; origem UTC).</p><p className="whitespace-pre-wrap">{p.decisao.motivo}</p></> : <>
        {p.estadoMudou && <p role="status">O conjunto mudou; prepare nova proposta antes de aprovar.</p>}
        {p.estadoConferido ? <Decidir propostaId={p.id} estadoConferido={p.estadoConferido} podeAprovar={!p.estadoMudou && d.podePropor} /> : <p>Outra pessoa da gestão precisa decidir esta proposta.</p>}
      </>}
    </article>)}
    {d.proximoAntesId && <Link className="underline" href={`?${new URLSearchParams({ antesId: d.proximoAntesId })}`}>Propostas anteriores</Link>}
  </section>;
}
