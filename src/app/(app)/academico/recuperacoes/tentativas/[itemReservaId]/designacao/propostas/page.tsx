import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPropostasSubstituicaoRecuperacao } from "@/server/avaliacoes/recuperacao-substituicao-proposta";
import { IdentificacaoAvaliacao } from "../../../../../avaliacoes/Identificacao";
import { DecidirSubstituicao } from "./DecidirSubstituicao";

function data(valor: string, fuso: string) {
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(valor)); }
  catch { return valor.replace("T", " ").replace("Z", " UTC"); }
}

export default async function Propostas({ params, searchParams }: { params: Promise<{ itemReservaId: string }>; searchParams: Promise<{ antesVersao?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { itemReservaId } = await params, { antesVersao } = await searchParams;
  const r = await consultarPropostasSubstituicaoRecuperacao({ itemReservaId, ...(antesVersao ? { antesVersao: Number(antesVersao) } : {}) });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <section className="space-y-4"><Link className="underline" href={`/academico/recuperacoes/tentativas/${encodeURIComponent(itemReservaId)}/designacao`}>Conferir nova substituição</Link>
    <h1 className="text-2xl font-medium">Propostas de substituição — {d.habilidade.replaceAll("_", " ")}</h1><IdentificacaoAvaliacao dados={d.identificacao} />
    <p>As propostas preservam a conferência e o histórico. Só uma aprovação independente aplica a troca conjuntamente à agenda e à designação.</p>
    {d.propostas.map(p => <article key={p.id} className="space-y-2 rounded border p-4"><h2 className="text-xl">Versão {p.versao}{p.versaoAtual ? " — mais recente" : " — histórica"}</h2>
      <p>Preparada por {p.autor} em {data(p.criadaEm, "UTC")} (UTC).</p><p className="whitespace-pre-wrap">Motivo da proposta: {p.motivo}</p>
      <p>Avaliador na origem: {p.conferenciaOriginal.avaliadorAtual}. Substituto proposto: {p.conferenciaOriginal.substituto}.</p>
      <p>Horário conferido: {data(p.conferenciaOriginal.inicio, p.conferenciaOriginal.fusoOrigem)} até {data(p.conferenciaOriginal.fim, p.conferenciaOriginal.fusoOrigem)} ({p.conferenciaOriginal.fusoOrigem}).</p>
      <p>Prazo conferido: {data(p.conferenciaOriginal.prazoVigente, p.conferenciaOriginal.fusoOrigem)} ({p.conferenciaOriginal.fusoOrigem}).</p>
      <details><summary className="cursor-pointer">Fonte da conferência preservada</summary><p className="mt-2 text-sm">Encontro publicado, matrícula e vínculo, fontes aprovadas do plano, prazo vigente, professor ativo, calendário/fuso e disponibilidade do professor e do aluno foram conferidos quando esta versão foi preparada.</p></details>
      {p.conferenciaOriginal.pendencias.length > 0 ? <><p className="font-medium">Pendências na conferência de origem</p><ul className="list-disc pl-5">{p.conferenciaOriginal.pendencias.map(x => <li key={x}>{x}</li>)}</ul></> : <p>Conferência de origem sem pendências registradas.</p>}
      {p.decisao ? <div className="space-y-1 rounded bg-gray-50 p-3"><p className="font-medium">{p.decisao.aprovada ? p.aplicada ? "Aprovada e aplicada" : "Aprovação registrada; consulte o estado atual" : "Rejeitada"}</p><p>Decisão de {p.decisao.decisor} em {data(p.decisao.decididaEm, "UTC")} (UTC).</p><p className="whitespace-pre-wrap">{p.decisao.motivo}</p>{p.aplicada && <p>Professor aplicado no encontro: {p.avaliadorAplicado?.nome ?? "Registro do avaliador indisponível"}.</p>}</div> : <><p>{p.revisaoIndependente ? "Preparada por outra pessoa; você pode revisar e decidir." : "Você preparou esta proposta. A decisão exige outra pessoa autorizada."}</p>{p.versaoAtual ? p.estadoMudou ? <p role="alert">A situação atual divergiu da conferência preservada. {p.impedimentoAtual ?? "A aprovação foi bloqueada; faça uma nova conferência."}</p> : <p role="status">Estado atual compatível com a conferência preservada.</p> : <p className="text-sm">Versão histórica: o estado atual é avaliado somente para a proposta mais recente.</p>}{p.podeDecidir && <DecidirSubstituicao propostaId={p.id} propostaHash={p.propostaHash} podeAprovar={p.podeAprovar} />}</>}
    </article>)}
    {!d.propostas.length && <p>Nenhuma proposta registrada.</p>}
    {d.proximaAntesVersao && <Link className="underline" href={`?antesVersao=${d.proximaAntesVersao}`}>Propostas anteriores</Link>}
  </section>;
}
