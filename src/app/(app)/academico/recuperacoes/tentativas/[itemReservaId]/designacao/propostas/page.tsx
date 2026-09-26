import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPropostasSubstituicaoRecuperacao } from "@/server/avaliacoes/recuperacao-substituicao-proposta";
import { IdentificacaoAvaliacao } from "../../../../../avaliacoes/Identificacao";
import { DecidirSubstituicao } from "./DecidirSubstituicao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { EstadoVazio } from "@/components/EstadoVazio";

export default async function Propostas({ params, searchParams }: { params: Promise<{ itemReservaId: string }>; searchParams: Promise<{ antesVersao?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { itemReservaId } = await params, { antesVersao } = await searchParams;
  const [r, preferencia] = await Promise.all([
    consultarPropostasSubstituicaoRecuperacao({ itemReservaId, ...(antesVersao ? { antesVersao: Number(antesVersao) } : {}) }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const preferenciaFuso = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const administrativo = resolverFusoExibicao(preferenciaFuso, "UTC");
  return <section className="space-y-4"><Link className="underline" href={`/academico/recuperacoes/tentativas/${encodeURIComponent(itemReservaId)}/designacao`}>Conferir nova substituição</Link>
    <h1 className="text-2xl font-medium">Propostas de substituição — {d.habilidade.replaceAll("_", " ")}</h1><IdentificacaoAvaliacao dados={d.identificacao} />
    <p>As propostas preservam a conferência e o histórico. Só uma aprovação independente aplica a troca conjuntamente à agenda e à designação.</p>
    {d.propostas.map(p => <article key={p.id} className="space-y-2 rounded border p-4"><h2 className="text-xl">Versão {p.versao}{p.versaoAtual ? " — mais recente" : " — histórica"}</h2>
      <p>Preparada por {p.autor} em {formatarInstanteExibicao(p.criadaEm, preferenciaFuso, "UTC").texto} ({administrativo}; origem UTC).</p><p className="whitespace-pre-wrap">Motivo da proposta: {p.motivo}</p>
      <p>Avaliador na origem: {p.conferenciaOriginal.avaliadorAtual}. Substituto proposto: {p.conferenciaOriginal.substituto}.</p>
      {(() => { const fuso = resolverFusoExibicao(preferenciaFuso, p.conferenciaOriginal.fusoOrigem); return <><p>Horário conferido: {formatarInstanteExibicao(p.conferenciaOriginal.inicio, preferenciaFuso, p.conferenciaOriginal.fusoOrigem).texto} até {formatarInstanteExibicao(p.conferenciaOriginal.fim, preferenciaFuso, p.conferenciaOriginal.fusoOrigem).texto} ({fuso}; origem {p.conferenciaOriginal.fusoOrigem}).</p><p>Prazo conferido: {formatarInstanteExibicao(p.conferenciaOriginal.prazoVigente, preferenciaFuso, p.conferenciaOriginal.fusoOrigem).texto} ({fuso}; origem {p.conferenciaOriginal.fusoOrigem}).</p></>; })()}
      <details><summary className="cursor-pointer">Fonte da conferência preservada</summary><p className="mt-2 text-sm">Encontro publicado, matrícula e vínculo, fontes aprovadas do plano, prazo vigente, professor ativo, calendário/fuso e disponibilidade do professor e do aluno foram conferidos quando esta versão foi preparada.</p></details>
      {p.conferenciaOriginal.pendencias.length > 0 ? <><p className="font-medium">Pendências na conferência de origem</p><ul className="list-disc pl-5">{p.conferenciaOriginal.pendencias.map(x => <li key={x}>{x}</li>)}</ul></> : <p>Conferência de origem sem pendências registradas.</p>}
      {p.decisao ? <div className="space-y-1 rounded bg-gray-50 p-3"><p className="font-medium">{p.decisao.aprovada ? p.aplicada ? "Aprovada e aplicada" : "Aprovação registrada; consulte o estado atual" : "Rejeitada"}</p><p>Decisão de {p.decisao.decisor} em {formatarInstanteExibicao(p.decisao.decididaEm, preferenciaFuso, "UTC").texto} ({administrativo}; origem UTC).</p><p className="whitespace-pre-wrap">{p.decisao.motivo}</p>{p.aplicada && <p>Professor aplicado no encontro: {p.avaliadorAplicado?.nome ?? "Registro do avaliador indisponível"}.</p>}</div> : <><p>{p.revisaoIndependente ? "Preparada por outra pessoa; você pode revisar e decidir." : "Você preparou esta proposta. A decisão exige outra pessoa autorizada."}</p>{p.versaoAtual ? p.estadoMudou ? <p role="alert">A situação atual divergiu da conferência preservada. {p.impedimentoAtual ?? "A aprovação foi bloqueada; faça uma nova conferência."}</p> : <p role="status">Estado atual compatível com a conferência preservada.</p> : <p className="text-sm">Versão histórica: o estado atual é avaliado somente para a proposta mais recente.</p>}{p.podeDecidir && <DecidirSubstituicao propostaId={p.id} propostaHash={p.propostaHash} podeAprovar={p.podeAprovar} />}</>}
    </article>)}
    {!d.propostas.length && <EstadoVazio bloco>Nenhuma proposta registrada.</EstadoVazio>}
    {d.proximaAntesVersao && <Link className="underline" href={`?antesVersao=${d.proximaAntesVersao}`}>Propostas anteriores</Link>}
  </section>;
}
