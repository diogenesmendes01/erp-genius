import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPropostasAgendaRecuperacao } from "@/server/avaliacoes/recuperacao-agenda-proposta";
import { IdentificacaoAvaliacao } from "../../../../avaliacoes/Identificacao";
import { ProporAgenda, DecidirAgenda } from "./Formulario";

export default async function Agenda({ params, searchParams }: { params: Promise<{ itemReservaId: string }>; searchParams: Promise<{ antesVersao?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { itemReservaId } = await params, { antesVersao } = await searchParams;
  const r = await consultarPropostasAgendaRecuperacao({ itemReservaId, ...(antesVersao ? { antesVersao: Number(antesVersao) } : {}) });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <section className="space-y-4">
    <h1 className="text-2xl font-medium">Propostas de horário — {d.habilidade.replaceAll("_", " ")}</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    {!d.agendaPublicada && <ProporAgenda itemReservaId={itemReservaId} versaoEsperada={d.versaoEsperada} />}
    {d.propostas.map(p => <article key={p.id} className="space-y-2 rounded border p-4">
      <h2 className="text-xl">Versão {p.versao}{p.versaoAtual ? " — mais recente" : " — histórica"}</h2>
      <p>Proposta de {p.autor}. Horário em UTC: {p.inicio} até {p.fim}. Fuso informado: {p.fuso}.</p>
      <p className="whitespace-pre-wrap">{p.motivo}</p>
      <p>Avaliador na conferência: {p.conferenciaOriginal.professor?.nome ?? "Pendente"}.</p>
      {p.decisao ? <div><p>{p.decisao.aprovada ? "Aprovada — horário publicado" : "Proposta rejeitada"} por {p.decisao.decisor} em {p.decisao.criadaEm}.</p>
        <p className="whitespace-pre-wrap">{p.decisao.motivo}</p>{p.decisao.autorizarDiaNaoLetivo && <p>Exceção de dia não letivo autorizada para este encontro.</p>}
        {p.encontro && <p>Estado do encontro: {p.encontro.status}.</p>}</div> : <p>{p.revisaoIndependente ? "Você pode conferir a proposta de outra pessoa." : "A proposta precisa da revisão de outra pessoa."} Horário ainda não agendado.</p>}
      {p.conferenciaOriginal.pendencias.length > 0 && <ul className="list-disc pl-5">{p.conferenciaOriginal.pendencias.map(x => <li key={x}>{x}</li>)}</ul>}
      {p.estadoMudou && <p role="status">A conferência mudou desde a preparação. {p.impedimentoAtual ?? "Prepare uma nova versão com as condições atuais."}</p>}
      {p.estadoConferido && <DecidirAgenda propostaId={p.id} estadoConferido={p.estadoConferido} podeAprovar={p.versaoAtual && !p.estadoMudou && !p.impedimentoAtual} />}
    </article>)}
    {!d.propostas.length && <p>Nenhuma proposta registrada.</p>}
    {d.proximaAntesVersao && <Link className="underline" href={`?antesVersao=${d.proximaAntesVersao}`}>Propostas anteriores</Link>}
  </section>;
}
