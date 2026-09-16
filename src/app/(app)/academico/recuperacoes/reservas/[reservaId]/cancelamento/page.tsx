import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCancelamentoAgendaRecuperacao } from "@/server/avaliacoes/recuperacao-agenda-cancelamento";
import { IdentificacaoAvaliacao } from "../../../../avaliacoes/Identificacao";
import { Propor, Decidir } from "./Formularios";
type Item = { id: string; habilidade: string; realizacaoId: string | null; inicio: string | null; fim: string | null; status: string | null };
function Alcance({ itens, cancelada = false }: { itens: Item[]; cancelada?: boolean }) {
  return <ul className="list-disc pl-5">{itens.map(i => <li key={i.id}>{i.habilidade.replaceAll("_", " ")}: {i.realizacaoId ? "realização preservada, tentativa permanece consumida" : cancelada ? "tentativa liberada sem consumo" : "tentativa pendente nesta conferência"}.
    {i.inicio && <> Encontro em UTC: {i.inicio} até {i.fim}. Estado: {i.status}.</>}
  </li>)}</ul>;
}
export default async function Cancelamento({ params, searchParams }: { params: Promise<{ reservaId: string }>; searchParams: Promise<{ antesId?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { reservaId } = await params, { antesId } = await searchParams;
  const r = await consultarCancelamentoAgendaRecuperacao({ reservaId, ...(antesId ? { antesId } : {}) });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <section className="space-y-4"><h1 className="text-2xl font-medium">Cancelamento da recuperação pela escola</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} /><h2 className="text-xl">Situação atual da reserva</h2><Alcance itens={d.atual.itens} cancelada={!!d.atual.cancelamentoId} />
    {d.atual.cancelamentoId && <p>Cancelamento já aplicado. Histórico preservado.</p>}
    {d.podePropor && <Propor reservaId={reservaId} estadoConferido={d.estadoConferido} />}
    {d.propostas.map(p => <article key={p.id} className="space-y-2 rounded border p-4"><h2 className="text-xl">Proposta de {p.autor} — {p.criadaEm}</h2>
      <p className="whitespace-pre-wrap">{p.motivo}</p><p className="whitespace-pre-wrap">Evidência: {p.evidencia}</p><Alcance itens={p.origem.itens} />
      {p.decisao ? <><p>{p.decisao.aprovada ? "Aprovada e aplicada" : "Rejeitada"} por {p.decisao.decisor} em {p.decisao.criadaEm}.</p><p className="whitespace-pre-wrap">{p.decisao.motivo}</p></> : <>
        {p.estadoMudou && <p role="status">O conjunto mudou; prepare nova proposta antes de aprovar.</p>}
        {p.estadoConferido ? <Decidir propostaId={p.id} estadoConferido={p.estadoConferido} podeAprovar={!p.estadoMudou && d.podePropor} /> : <p>Outra pessoa da gestão precisa decidir esta proposta.</p>}
      </>}
    </article>)}
    {d.proximoAntesId && <Link className="underline" href={`?${new URLSearchParams({ antesId: d.proximoAntesId })}`}>Propostas anteriores</Link>}
  </section>;
}
