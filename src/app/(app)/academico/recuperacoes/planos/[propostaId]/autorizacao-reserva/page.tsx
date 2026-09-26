import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAutorizacoesReservaRecuperacao } from "@/server/avaliacoes/recuperacao-autorizacao-reserva-consulta";
import { IdentificacaoAvaliacao } from "../../../../avaliacoes/Identificacao";
import { AutorizarReservaEspecial, ReservarComAutorizacao } from "./Formulario";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { consultarFusoInstitucional } from "@/server/operacao/consultas";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";

export default async function AutorizacaoReserva({ params, searchParams }: { params: Promise<{ propostaId: string }>; searchParams: Promise<{ depoisId?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { propostaId } = await params;
  const { depoisId } = await searchParams;
  const [resultado, preferencia, fusoInstitucional] = await Promise.all([
    consultarAutorizacoesReservaRecuperacao({ propostaId, ...(depoisId ? { depoisId } : {}) }),
    consultarPreferenciaFusoEquipe(),
    consultarFusoInstitucional(),
  ]);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
  const fuso = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const dataHora = (valor: string) => formatarInstanteExibicao(valor, fuso, "UTC").texto;

  return <section className="space-y-4">
    <VoltarPara href={`/academico/recuperacoes/planos/${encodeURIComponent(propostaId)}`} para="Operação do plano" />
    <h1 className="text-2xl font-medium">Autorizações especiais para reservar recuperação</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <p>Situação da matrícula: {d.statusMatricula}.</p>
    <p>A fonte desta prévia é o plano aprovado e disponibilizado. Autorizar ou reservar aqui não registra realização da avaliação.</p>
    {d.podeAutorizar ? <AutorizarReservaEspecial propostaId={d.propostaId} habilidades={d.habilidades} fusoInstitucional={fusoInstitucional} /> : <p role="status">Não há autorização especial de pré-reserva disponível nas condições atuais.</p>}
    <h2 className="text-xl font-medium">Histórico de autorizações especiais</h2>
    {d.historico.map(autorizacao => <article key={autorizacao.id} className="space-y-2 rounded border p-3">
      <p>Habilidade: {autorizacao.habilidade.replaceAll("_", " ")}.</p>
      <p>Autorizada por {autorizacao.autorizador.nome}, em {dataHora(autorizacao.criadaEm)} ({fuso}; origem UTC). Prazo até {dataHora(autorizacao.prazoAte)} ({fuso}; origem UTC).</p>
      <p className="whitespace-pre-wrap">{autorizacao.motivo}</p>
      {autorizacao.reserva ? <p role="status">Reserva registrada. <Link className="underline" href={`/academico/recuperacoes/planos/${encodeURIComponent(propostaId)}`}>Voltar ao plano para conferir a tentativa e autorizar sua realização.</Link></p> : autorizacao.podeReservar ? <ReservarComAutorizacao propostaId={d.propostaId} propostaHash={d.propostaHash} autorizacaoId={autorizacao.id} habilidade={autorizacao.habilidade} /> : <p role="status">Esta autorização não está disponível para reserva nas condições atuais.</p>}
      <p>A realização durante pausa ou encerramento ainda exige a autorização específica de realização.</p>
    </article>)}
    {!d.historico.length && <EstadoVazio bloco>Nenhuma autorização especial registrada.</EstadoVazio>}
    {d.proximoId && <Link className="underline" href={`?depoisId=${encodeURIComponent(d.proximoId)}`}>Próximas autorizações</Link>}
  </section>;
}
