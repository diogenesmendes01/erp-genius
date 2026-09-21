import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPlanosRecuperacao } from "@/server/avaliacoes/recuperacao-planos-consulta";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { IdentificacaoAvaliacao } from "../../avaliacoes/Identificacao";
import { PrepararPlano, DecidirPlano } from "./Formularios";
import { AutorizarPreparacao } from "./AutorizarPreparacao";

function valor(f: { numerador: string; denominador: string } | null) {
  if (!f) return "Pendente";
  const n = BigInt(f.numerador), d = BigInt(f.denominador), absoluto = n < 0n ? -n : n;
  const centesimos = (absoluto * 200n + d) / (d * 2n);
  return `${n < 0n ? "−" : ""}${centesimos / 100n},${String(centesimos % 100n).padStart(2, "0")}`;
}
export default async function Planos({ searchParams }: { searchParams: Promise<{ alocacaoId?: string; antesVersao?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId = "", antesVersao } = await searchParams;
  const [r, preferencia] = await Promise.all([
    consultarPlanosRecuperacao({ alocacaoId, ...(antesVersao ? { antesVersao: Number(antesVersao) } : {}) }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  return <section className="space-y-4">
    <Link className="underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}`}>Avaliações da matrícula</Link>
    <h1 className="text-2xl font-medium">Planos de recuperação</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <p>Média atual: {valor(d.atual.geral)}. Mínimo geral: {d.atual.minimoGeral}. Valores exibidos com duas casas; os mínimos são conferidos sem arredondamento.</p>
    {d.atual.habilidades.map(h => <p key={h.habilidade}>{h.habilidade.replaceAll("_", " ")}: {valor(h.resultado)} · mínimo {h.minimo}.</p>)}
    {d.impedimentoProposta && <p role="status">{d.impedimentoProposta}</p>}
    {d.autorizacaoPreparacao && <p role="status">Autorização especial de preparação vigente até {formatarInstanteExibicao(d.autorizacaoPreparacao.prazoAte, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC).</p>}
    {!d.autorizacaoPreparacao && <p>Não há autorização especial de preparação vigente.</p>}
    {d.podeAutorizarPreparacao && !antesVersao && <AutorizarPreparacao alocacaoId={alocacaoId} />}
    {d.podeConsultarHistoricoPreparacao && <Link className="block underline" href={`/academico/recuperacoes/planos/autorizacoes-preparacao?${new URLSearchParams({ alocacaoId })}`}>Consultar histórico de autorizações de preparação</Link>}
    {d.podePropor && !antesVersao && <PrepararPlano key={`${d.versaoEsperada}:${d.autorizacaoPreparacao?.id ?? "sem-autorizacao"}`} alocacaoId={alocacaoId} versaoEsperada={d.versaoEsperada} obrigatorias={d.obrigatorias} selecionaveis={d.selecionaveis} autorizacaoPreparacaoId={d.autorizacaoPreparacao?.id} />}
    <p>Preparar um plano não o aprova. A aprovação é independente e a execução da recuperação continua indisponível até as etapas próprias.</p>
    <h2 className="text-xl font-medium">Propostas registradas</h2>
    {d.planos.map(p => <article key={p.id} className="space-y-3 rounded border p-4">
      <h3 className="font-medium">Proposta {p.versao} — {p.preparador}</h3>
      <p>{p.decisao ? p.decisao.aprovada ? "Aprovada" : "Rejeitada" : "Aguardando decisão"}. {formatarInstanteExibicao(p.criadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC)</p>
      <p className="whitespace-pre-wrap">{p.motivo}</p>
      {p.atividades.map(a => <div key={a.habilidade}><h4 className="font-medium">{a.habilidade.replaceAll("_", " ")}</h4><p className="whitespace-pre-wrap">Estratégia: {a.estrategia}</p><p className="whitespace-pre-wrap">Avaliação: {a.avaliacaoProposta}</p></div>)}
      <details><summary>Notas que fundamentaram esta proposta</summary><p>Média: {valor(p.base.geral)} · mínimo {p.base.minimoGeral}.</p>{p.base.habilidades.map(h => <p key={h.habilidade}>{h.habilidade.replaceAll("_", " ")}: {valor(h.resultado)} · mínimo {h.minimo}.</p>)}</details>
      {p.fontesMudaram && <p>As notas ou suas fontes mudaram desde esta proposta. Uma decisão anterior permanece no histórico; novos avanços exigem conferência.</p>}
      {p.decisao && <p className="whitespace-pre-wrap">Decisão de {p.decisao.decisor.nome}: {p.decisao.motivo}</p>}
      {p.decisao?.aprovada && <Link className="block underline" href={`/academico/recuperacoes/planos/${encodeURIComponent(p.id)}`}>Disponibilização, tentativas e realizações</Link>}
      {p.podeDecidir && !p.podeAprovar && <p>Aprovação indisponível: confira versão, vínculo, fontes das notas e limites configurados.</p>}
      {p.podeDecidir && p.propostaHash && <DecidirPlano propostaId={p.id} propostaHash={p.propostaHash} podeAprovar={p.podeAprovar} />}
    </article>)}
    {!d.planos.length && <p>Nenhuma proposta nesta página.</p>}
    {d.proximaAntesVersao && <Link className="underline" href={`/academico/recuperacoes/planos?${new URLSearchParams({ alocacaoId, antesVersao: String(d.proximaAntesVersao) })}`}>Propostas anteriores</Link>}
    {antesVersao && <Link className="block underline" href={`/academico/recuperacoes/planos?${new URLSearchParams({ alocacaoId })}`}>Propostas recentes</Link>}
    <Link className="block underline" href={`/academico/recuperacoes?${new URLSearchParams({ alocacaoId })}`}>Notas das recuperações realizadas</Link>
  </section>;
}
