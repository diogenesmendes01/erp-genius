import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarDesignacaoRecuperacao } from "@/server/avaliacoes/recuperacao-designacao-consulta";
import { IdentificacaoAvaliacao } from "../../../../avaliacoes/Identificacao";
import { Designar } from "./Formulario";
import { PreviaSubstituicao } from "./PreviaSubstituicao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

export default async function Designacao({ params, searchParams }: { params: Promise<{ itemReservaId: string }>; searchParams: Promise<{ buscaProfessor?: string; antesVersao?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { itemReservaId } = await params, { buscaProfessor, antesVersao } = await searchParams;
  const [r, preferencia] = await Promise.all([
    consultarDesignacaoRecuperacao({ itemReservaId, buscaProfessor, ...(antesVersao ? { antesVersao: Number(antesVersao) } : {}) }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const preferenciaFuso = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const administrativo = resolverFusoExibicao(preferenciaFuso, "UTC");
  return <section className="space-y-4">
    <Link className="underline" href={`/academico/recuperacoes/planos/${encodeURIComponent(d.propostaId)}`}>Operação do plano</Link>
    <h1 className="text-2xl font-medium">Avaliador da recuperação — {d.habilidade.replaceAll("_", " ")}</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <p>Designação atual: {d.atual?.nome ?? "Sem professor designado"}.{d.atual && !d.atual.habilitado ? " Este usuário não está habilitado como professor ativo." : ""}</p>
    {d.realizadaPor && <p>Professor que realizou a avaliação: {d.realizadaPor}. A designação preserva essa autoria.</p>}
    <p>O acesso vale apenas para esta tentativa. Não transfere a turma nem altera prazo ou saldo.</p>
    <Link className="block underline" href={`/academico/recuperacoes/tentativas/${encodeURIComponent(itemReservaId)}/designacao/propostas`}>Revisar, decidir e consultar histórico de substituições</Link>
    {!d.podeAlterar && <p role="status">{d.agendaPublicada ? "A recuperação tem horário publicado; trocar o avaliador exige revisão da agenda e aprovação independente." : "Tentativa sem pendência disponível para nova designação. Histórico preservado em leitura."}</p>}
    {(d.podeAlterar || d.podeConferirSubstituicao) && !antesVersao && <>
      <form className="space-y-2"><label className="block">Buscar professor por nome<input name="buscaProfessor" defaultValue={d.buscaProfessor} maxLength={100} className="block rounded border p-2" /></label><button className="rounded border px-4 py-2">Buscar</button></form>
      {d.refinarBusca && <p>Mostrando os primeiros 50 professores. Refine o nome para localizar os demais.</p>}
      {d.podeAlterar && <Designar key={`${d.versaoEsperada}:${d.buscaProfessor}`} itemReservaId={d.itemReservaId} versaoEsperada={d.versaoEsperada} atualId={d.atual?.id ?? null} professores={d.professores} />}
      {d.podeConferirSubstituicao && <PreviaSubstituicao key={d.buscaProfessor} itemReservaId={d.itemReservaId} atualId={d.avaliadorAgendaId} professores={d.professores} preferenciaFusoExibicao={preferenciaFuso} />}
    </>}
    <h2 className="text-xl font-medium">Histórico de designações</h2>
    {d.historico.map(h => <article key={h.id} className="rounded border p-3"><p>Versão {h.versao}: {h.professor?.nome ?? "Designação revogada"} — registrada por {h.gestor.nome}, em {formatarInstanteExibicao(h.criadaEm, preferenciaFuso, "UTC").texto} ({administrativo}; origem UTC).</p><p className="whitespace-pre-wrap">{h.motivo}</p></article>)}
    {!d.historico.length && <p>Nenhuma designação nesta página.</p>}
    {d.proximaAntesVersao && <Link className="underline" href={`?antesVersao=${d.proximaAntesVersao}`}>Designações anteriores</Link>}
    {antesVersao && <Link className="block underline" href={`/academico/recuperacoes/tentativas/${encodeURIComponent(itemReservaId)}/designacao`}>Designação atual</Link>}
  </section>;
}
