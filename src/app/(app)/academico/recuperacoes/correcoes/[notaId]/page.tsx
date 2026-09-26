import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCorrecoesRecuperacao } from "@/server/avaliacoes/recuperacao-correcao";
import { Propor, Revisar } from "./Formularios";
import { IdentificacaoAvaliacao } from "../../../avaliacoes/Identificacao";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";

export default async function Correcoes({ params, searchParams }: { params: Promise<{ notaId: string }>; searchParams: Promise<{ antesVersao?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { notaId } = await params, { antesVersao } = await searchParams;
  const r = await consultarCorrecoesRecuperacao({ notaId, ...(antesVersao ? { antesVersao: Number(antesVersao) } : {}) });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <section className="space-y-4">
    <VoltarPara href={`/academico/recuperacoes/${encodeURIComponent(d.realizacaoId)}`} para="Recuperação" />
    <h1 className="text-2xl font-medium">Correções da nota de recuperação</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <p>Habilidade: {d.habilidade.replaceAll("_", " ")}.</p>
    <p>Nota original: {d.original.nota}. Nota vigente: {d.vigente.nota}. Escala: {d.escala.minimo} a {d.escala.maximo}.</p>
    <p>A nota vigente permanece até uma aprovação independente. Corrigir um erro pode reduzir o resultado; isso não representa uma nova tentativa.</p>
    {!antesVersao && <Propor key={`${d.vigente.origemId}-${d.versaoEsperada}`} notaId={notaId} {...d.vigente} versaoEsperada={d.versaoEsperada} />}
    <h2 className="text-xl font-medium">Histórico das propostas</h2>
    {d.propostas.map(p => <article key={p.id} className="space-y-2 rounded border p-4">
      <h3 className="font-medium">Versão {p.versao} — {p.autor}</h3><p>Nota proposta: {p.nota}. {p.decisao ? p.decisao.aprovada ? "Aprovada" : "Rejeitada" : "Aguardando decisão"}.</p>
      <p className="whitespace-pre-wrap">Motivo: {p.motivo}</p><p className="whitespace-pre-wrap">Comentário: {p.comentarioAluno || "Sem comentário"}</p>
      {p.decisao && <p className="whitespace-pre-wrap">Decisão de {p.decisao.decisor.nome}: {p.decisao.motivo}</p>}
      {p.podeRevisar && <Revisar propostaId={p.id} />}
    </article>)}
    {!d.propostas.length && <EstadoVazio bloco>Sem propostas nesta página.</EstadoVazio>}
    {d.proximaAntesVersao && <Link className="underline" href={`?antesVersao=${d.proximaAntesVersao}`}>Propostas anteriores</Link>}
    {antesVersao && <Link className="block underline" href={`/academico/recuperacoes/correcoes/${encodeURIComponent(notaId)}`}>Versão atual</Link>}
  </section>;
}
