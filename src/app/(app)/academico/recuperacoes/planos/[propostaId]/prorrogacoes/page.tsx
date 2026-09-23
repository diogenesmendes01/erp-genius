import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarProrrogacoesRecuperacao } from "@/server/avaliacoes/recuperacao-prorrogacao-consulta";
import { IdentificacaoAvaliacao } from "../../../../avaliacoes/Identificacao";
import { ProporProrrogacao, ConferirProrrogacao } from "./Formularios";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { consultarFusoInstitucional } from "@/server/operacao/consultas";

export default async function Prorrogacoes({ params, searchParams }: { params: Promise<{ propostaId: string }>; searchParams: Promise<{ antesVersao?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { propostaId } = await params, { antesVersao } = await searchParams;
  const [r, preferencia, fusoInstitucional] = await Promise.all([
    consultarProrrogacoesRecuperacao({ propostaId, ...(antesVersao ? { antesVersao: Number(antesVersao) } : {}) }),
    consultarPreferenciaFusoEquipe(),
    consultarFusoInstitucional(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const fuso = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const horario = (valor: string) => formatarInstanteExibicao(valor, fuso, "UTC").texto;
  return <section className="space-y-4">
    <Link className="underline" href={`/academico/recuperacoes/planos/${encodeURIComponent(propostaId)}`}>Operação do plano</Link>
    <h1 className="text-2xl font-medium">Prorrogações da recuperação</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <p>Prazo original: {horario(d.prazoOriginal)}. Prazo vigente: {horario(d.prazoVigente)} ({fuso}; origem UTC).</p>
    {!d.podePropor && <p role="status">A matrícula não está ativa. Prorrogação não substitui a autorização específica após pausa ou encerramento.</p>}
    {d.podePropor && !antesVersao && <ProporProrrogacao key={`${d.versaoEsperada}:${d.prazoVigente}`} disponibilizacaoId={d.disponibilizacaoId} prazoAnterior={d.prazoVigente} versaoEsperada={d.versaoEsperada} fusoInstitucional={fusoInstitucional} />}
    <h2 className="text-xl font-medium">Histórico de propostas</h2>
    {d.propostas.map(p => <article key={p.id} className="space-y-3 rounded border p-4">
      <h3 className="font-medium">Proposta {p.versao} — {p.preparador}</h3>
      <p>Registrada em {horario(p.criadaEm)} ({fuso}; origem UTC). {p.decisao ? p.decisao.aprovada ? "Aprovada" : "Rejeitada" : "Aguardando decisão"}.</p>
      <p>De {horario(p.prazoAnterior)} para {horario(p.novoPrazo)}.</p>
      <p className="whitespace-pre-wrap">Justificativa: {p.motivo}</p>
      {p.decisao && <p className="whitespace-pre-wrap">Decisão de {p.decisao.decisor.nome}, em {horario(p.decisao.criadaEm)} ({fuso}; origem UTC): {p.decisao.motivo}</p>}
      {p.podeDecidir && !p.podeAprovar && <p>Aprovação indisponível. Confira a versão mais recente, prazo vigente, data proposta e situação da matrícula.</p>}
      {p.podeDecidir && p.propostaHash && <ConferirProrrogacao propostaId={p.id} propostaHash={p.propostaHash} podeAprovar={p.podeAprovar} />}
    </article>)}
    {!d.propostas.length && <p>Nenhuma proposta nesta página.</p>}
    {d.proximaAntesVersao && <Link className="underline" href={`/academico/recuperacoes/planos/${encodeURIComponent(propostaId)}/prorrogacoes?antesVersao=${d.proximaAntesVersao}`}>Propostas anteriores</Link>}
    {antesVersao && <Link className="block underline" href={`/academico/recuperacoes/planos/${encodeURIComponent(propostaId)}/prorrogacoes`}>Propostas recentes</Link>}
  </section>;
}
