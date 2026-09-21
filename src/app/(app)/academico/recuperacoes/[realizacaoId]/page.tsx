import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarNotaRecuperacao } from "@/server/avaliacoes/recuperacao-consulta";
import { IdentificacaoAvaliacao } from "../../avaliacoes/Identificacao";
import { LancarNota, ConferirNota } from "./Formularios";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

export default async function Nota({ params, searchParams }: { params: Promise<{ realizacaoId: string }>; searchParams: Promise<{ antesVersao?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { realizacaoId } = await params;
  const { antesVersao } = await searchParams;
  const [r, preferencia] = await Promise.all([
    consultarNotaRecuperacao({ realizacaoId, ...(antesVersao ? { antesVersao: Number(antesVersao) } : {}) }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  return <section className="space-y-4">
    <Link className="underline" href={`/academico/recuperacoes?${new URLSearchParams({ alocacaoId: d.alocacaoId })}`}>Recuperações da matrícula</Link>
    <h1 className="text-2xl font-medium">Recuperação — {d.habilidade.replaceAll("_", " ")}</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <p>Realizada em {formatarInstanteExibicao(d.realizadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC). Escala: {d.escala.minimo} a {d.escala.maximo}.</p>
    <p>Professor que realizou a avaliação: {d.realizadaPor}. Registro por: {d.registradaPor}.</p>
    {d.motivoRegularizacao && <p className="whitespace-pre-wrap">Motivo da regularização: {d.motivoRegularizacao}</p>}
    <p className="whitespace-pre-wrap">Evidência: {d.evidencia}</p>
    {d.podeLancar && !antesVersao && <LancarNota key={d.versaoEsperada} realizacaoId={d.realizacaoId} versaoEsperada={d.versaoEsperada} nota={d.notas[0]?.nota ?? null} comentarioAluno={d.notas[0]?.comentarioAluno ?? ""} />}
    {d.oficial && <p>Nota oficializada. Alterações exigem fluxo de correção aprovado.</p>}
    <h2 className="text-xl font-medium">Histórico de versões</h2>
    {d.notas.map(n => <article key={n.id} className="space-y-2 rounded border p-4">
      <h3 className="font-medium">Versão {n.versao} — {n.autor}</h3>
      <p>Nota: {n.correcaoVigente?.nota ?? n.nota ?? "Ainda não informada"}. {n.decisao ? n.decisao.aprovada ? "Oficializada" : "Rejeitada" : n.submetida ? "Aguardando conferência" : "Rascunho"}.</p>
      <p className="whitespace-pre-wrap">Comentário ao aluno: {n.correcaoVigente?.comentarioAluno ?? (n.comentarioAluno || "Sem comentário.")}</p>
      {n.correcaoVigente && <p className="whitespace-pre-wrap">Nota anterior: {n.nota}. Correção aprovada: {n.correcaoVigente.motivo}</p>}
      {n.decisao && <p className="whitespace-pre-wrap">Conferência de {n.decisao.decisor.nome}: {n.decisao.motivo}</p>}
      {n.podeCorrigir && <Link className="block underline" href={`/academico/recuperacoes/correcoes/${encodeURIComponent(n.id)}`}>Propor ou conferir correção</Link>}
      {n.podeDecidir && n.entradaHash && <ConferirNota notaId={n.id} entradaHash={n.entradaHash} podeAprovar={n.podeAprovar} />}
    </article>)}
    {!d.notas.length && <p>Nenhuma versão de nota registrada nesta página.</p>}
    {d.proximaAntesVersao && <Link className="underline" href={`/academico/recuperacoes/${encodeURIComponent(realizacaoId)}?antesVersao=${d.proximaAntesVersao}`}>Versões anteriores</Link>}
    {antesVersao && <Link className="block underline" href={`/academico/recuperacoes/${encodeURIComponent(realizacaoId)}`}>Versão atual</Link>}
  </section>;
}
