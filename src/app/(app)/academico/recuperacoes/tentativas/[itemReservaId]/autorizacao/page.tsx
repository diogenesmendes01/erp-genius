import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAutorizacoesEspeciaisRecuperacao } from "@/server/avaliacoes/recuperacao-autorizacao-consulta";
import { Formulario } from "./Formulario";
import { IdentificacaoAvaliacao } from "@/app/(app)/academico/avaliacoes/Identificacao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { consultarFusoInstitucional } from "@/server/operacao/consultas";

export default async function AutorizacaoEspecialRecuperacao({ params, searchParams }: { params: Promise<{ itemReservaId: string }>; searchParams: Promise<{ depoisId?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { itemReservaId } = await params;
  const { depoisId } = await searchParams;
  const [resultado, preferencia, fusoInstitucional] = await Promise.all([
    consultarAutorizacoesEspeciaisRecuperacao({ itemReservaId, ...(depoisId ? { depoisId } : {}) }),
    consultarPreferenciaFusoEquipe(),
    consultarFusoInstitucional(),
  ]);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
  const fuso = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const dataHora = (valor: string) => formatarInstanteExibicao(valor, fuso, "UTC").texto;

  return <section className="space-y-4">
    <Link className="underline" href={`/academico/recuperacoes/tentativas/${encodeURIComponent(itemReservaId)}/designacao`}>Voltar para a tentativa</Link>
    <h1 className="text-2xl font-medium">Autorização especial de realização</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <p>Habilidade: {d.habilidade.replaceAll("_", " ")} · situação da matrícula: {d.statusMatricula}.</p>
    <p>Esta autorização é específica desta tentativa e não altera o saldo, a reserva ou a situação da matrícula.</p>
    {d.podeAutorizar ? <Formulario itemReservaId={d.itemReservaId} fusoInstitucional={fusoInstitucional} /> : <p role="status">Não há autorização especial disponível para esta tentativa nas condições atuais.</p>}
    <h2 className="text-xl font-medium">Histórico de autorizações</h2>
    {d.historico.map(autorizacao => <article key={autorizacao.id} className="space-y-1 rounded border p-3">
      <p>Autorizada por {autorizacao.autorizador.nome}, em {dataHora(autorizacao.criadaEm)} ({fuso}; origem UTC).</p>
      <p>Prazo até {dataHora(autorizacao.prazoAte)} ({fuso}; origem UTC).</p>
      <p className="whitespace-pre-wrap">{autorizacao.motivo}</p>
    </article>)}
    {!d.historico.length && <p>Nenhuma autorização especial registrada.</p>}
    {d.proximoId && <Link className="block underline" href={`?${new URLSearchParams({ depoisId: d.proximoId })}`}>Autorizações mais antigas</Link>}
    {depoisId && <Link className="block underline" href={`/academico/recuperacoes/tentativas/${encodeURIComponent(itemReservaId)}/autorizacao`}>Primeira página do histórico</Link>}
  </section>;
}
