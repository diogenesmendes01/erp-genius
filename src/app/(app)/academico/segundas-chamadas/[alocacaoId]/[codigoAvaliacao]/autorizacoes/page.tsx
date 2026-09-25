import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAutorizacoesEspeciaisSegundaChamada } from "@/server/avaliacoes/segunda-chamada";
import { Formulario } from "./Formulario";
import { IdentificacaoAvaliacao } from "@/app/(app)/academico/avaliacoes/Identificacao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { consultarFusoInstitucional } from "@/server/operacao/consultas";
import { VoltarPara } from "@/components/VoltarPara";


export default async function AutorizacoesSegundaChamada({ params, searchParams }: { params: Promise<{ alocacaoId: string; codigoAvaliacao: string }>; searchParams: Promise<{ depoisId?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId, codigoAvaliacao } = await params;
  const { depoisId } = await searchParams;
  const [resultado, preferencia, fusoInstitucional] = await Promise.all([consultarAutorizacoesEspeciaisSegundaChamada({ alocacaoId, codigoAvaliacao, ...(depoisId ? { depoisId } : {}) }), consultarPreferenciaFusoEquipe(), consultarFusoInstitucional()]);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
  const fuso = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const voltar = `/academico/segundas-chamadas/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}`;

  return <section className="space-y-4">
    <VoltarPara href={voltar} para="Segunda chamada" />
    <h1 className="text-2xl font-medium">Autorizações especiais de segunda chamada</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <p>Avaliação: {d.codigoAvaliacao}.</p>
    <p>Situação da matrícula: {d.statusMatricula}.</p>
    {d.podeAutorizar ? <Formulario alocacaoId={d.alocacaoId} codigoAvaliacao={d.codigoAvaliacao} fusoInstitucional={fusoInstitucional} /> : <p role="status">Não há pendência elegível para autorização especial nas condições atuais.</p>}
    <h2 className="text-xl font-medium">Histórico de autorizações</h2>
    {d.historico.map(autorizacao => <article key={autorizacao.id} className="space-y-1 rounded border p-3"><p>Autorizada por {autorizacao.autorizador.nome}, em {formatarInstanteExibicao(autorizacao.criadaEm, fuso, "UTC").texto} ({fuso}; origem UTC).</p><p>Prazo até {formatarInstanteExibicao(autorizacao.prazoAte, fuso, "UTC").texto} ({fuso}; origem UTC).</p><p className="whitespace-pre-wrap">{autorizacao.motivo}</p></article>)}
    {!d.historico.length && <p>Nenhuma autorização especial registrada.</p>}
    {d.proximoId && <Link className="block underline" href={`?${new URLSearchParams({ depoisId: d.proximoId })}`}>Autorizações mais antigas</Link>}
    {depoisId && <Link className="block underline" href={voltar + "/autorizacoes"}>Primeira página do histórico</Link>}
  </section>;
}
