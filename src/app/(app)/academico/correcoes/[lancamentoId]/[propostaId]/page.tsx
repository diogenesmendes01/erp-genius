import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { revisarCorrecaoNota } from "@/server/avaliacoes/correcao";
import { DecidirCorrecao } from "../Formularios";
import { IdentificacaoAvaliacao } from "../../../avaliacoes/Identificacao";
const nomes = { FALA: "Fala", COMPREENSAO_ORAL: "Compreensão oral", LEITURA: "Leitura", ESCRITA: "Escrita" };
export default async function RevisaoPage({ params }: { params: Promise<{ lancamentoId: string; propostaId: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { lancamentoId, propostaId } = await params, r = await revisarCorrecaoNota(propostaId);
  if (!r.ok || !r.dado || r.dado.lancamentoId !== lancamentoId) return <p role="alert">{!r.ok ? r.erro : "Proposta indisponível neste lançamento."}</p>;
  const d = r.dado;
  return <section className="space-y-5"><Link className="underline" href={`/academico/correcoes/${encodeURIComponent(lancamentoId)}`}>Histórico de correções</Link>
    <h1 className="text-2xl font-medium">Conferir correção {d.versao}</h1><p className="whitespace-pre-wrap">{d.motivo}</p>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    {d.notasPropostas.map(n => { const antes = d.notasVigentes.find(a => a.habilidade === n.habilidade); return <div key={n.habilidade} className="rounded border p-3"><p>{nomes[n.habilidade]} — vigente: {antes?.nota}; proposta: {n.nota}</p><p className="whitespace-pre-wrap">Comentário vigente: {antes?.comentarioAluno || "Sem comentário"}</p><p className="whitespace-pre-wrap">Comentário proposto: {n.comentarioAluno || "Sem comentário"}</p></div>; })}
    <h2 className="text-xl font-medium">Mudanças acadêmicas que exigem revisão</h2>
    {!d.impactos.length ? <p>Nenhuma mudança aprovada ou executada identificada para este vínculo.</p> : <><p>A correção não desfaz a movimentação. Os casos abaixo precisam de revisão pedagógica.</p>{d.impactos.map(i => <p key={i.id}>Solicitação {i.id} — {i.status === "EXECUTADA" ? "Executada" : "Aprovada"}</p>)}</>}
    {!d.podeAprovar && <p role="status">Esta proposta não está disponível para aprovação. Pode já ter sido decidida, ter uma versão ou origem mais recente, ou exigir outro aprovador.</p>}
    {d.podeDecidir && <DecidirCorrecao propostaId={propostaId} propostaHash={d.propostaHash} impactosHash={d.impactosHash} podeAprovar={d.podeAprovar} />}
  </section>;
}
