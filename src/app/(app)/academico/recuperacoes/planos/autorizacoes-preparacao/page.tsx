import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarHistoricoPreparacaoRecuperacao } from "@/server/avaliacoes/recuperacao-preparacao-historico";
import { IdentificacaoAvaliacao } from "../../../avaliacoes/Identificacao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

export default async function HistoricoPreparacao({ searchParams }: { searchParams: Promise<{ alocacaoId?: string; depoisId?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId = "", depoisId } = await searchParams;
  const [resultado, preferencia] = await Promise.all([
    consultarHistoricoPreparacaoRecuperacao({ alocacaoId, ...(depoisId ? { depoisId } : {}) }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
  const fuso = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const dataHora = (valor: string) => formatarInstanteExibicao(valor, fuso, "UTC").texto;
  const caminhoPlanos = `/academico/recuperacoes/planos?${new URLSearchParams({ alocacaoId: d.alocacaoId })}`;
  const caminhoHistorico = `/academico/recuperacoes/planos/autorizacoes-preparacao?${new URLSearchParams({ alocacaoId: d.alocacaoId })}`;

  return <section className="space-y-4">
    <Link className="underline" href={caminhoPlanos}>Voltar para os planos de recuperação</Link>
    <h1 className="text-2xl font-medium">Histórico de autorizações de preparação</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    {d.historico.map(autorizacao => <article key={autorizacao.id} className="space-y-1 rounded border p-3">
      <p>Autorizada por {autorizacao.autorizador.nome}, em {dataHora(autorizacao.criadaEm)} ({fuso}; origem UTC).</p>
      <p>Prazo até {dataHora(autorizacao.prazoAte)} ({fuso}; origem UTC).</p>
      <p>Propostas preparadas com esta autorização: {autorizacao.quantidadePropostas}.</p>
      <p className="whitespace-pre-wrap">{autorizacao.motivo}</p>
    </article>)}
    {!d.historico.length && <p>Nenhuma autorização de preparação registrada.</p>}
    {d.proximoId && <Link className="block underline" href={`?${new URLSearchParams({ alocacaoId: d.alocacaoId, depoisId: d.proximoId })}`}>Próximas autorizações</Link>}
    {depoisId && <Link className="block underline" href={caminhoHistorico}>Primeira página do histórico</Link>}
  </section>;
}
