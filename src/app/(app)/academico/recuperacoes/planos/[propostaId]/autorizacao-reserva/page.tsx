import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAutorizacoesReservaRecuperacao } from "@/server/avaliacoes/recuperacao-autorizacao-reserva-consulta";
import { IdentificacaoAvaliacao } from "../../../../avaliacoes/Identificacao";
import { AutorizarReservaEspecial, ReservarComAutorizacao } from "./Formulario";

const dataHoraUtc = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(valor));

export default async function AutorizacaoReserva({ params, searchParams }: { params: Promise<{ propostaId: string }>; searchParams: Promise<{ depoisId?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { propostaId } = await params;
  const { depoisId } = await searchParams;
  const resultado = await consultarAutorizacoesReservaRecuperacao({ propostaId, ...(depoisId ? { depoisId } : {}) });
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;

  return <section className="space-y-4">
    <Link className="underline" href={`/academico/recuperacoes/planos/${encodeURIComponent(propostaId)}`}>Voltar para a operação do plano</Link>
    <h1 className="text-2xl font-medium">Autorizações especiais para reservar recuperação</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <p>Situação da matrícula: {d.statusMatricula}.</p>
    <p>A fonte desta prévia é o plano aprovado e disponibilizado. Autorizar ou reservar aqui não registra realização da avaliação.</p>
    {d.podeAutorizar ? <AutorizarReservaEspecial propostaId={d.propostaId} habilidades={d.habilidades} /> : <p role="status">Não há autorização especial de pré-reserva disponível nas condições atuais.</p>}
    <h2 className="text-xl font-medium">Histórico de autorizações especiais</h2>
    {d.historico.map(autorizacao => <article key={autorizacao.id} className="space-y-2 rounded border p-3">
      <p>Habilidade: {autorizacao.habilidade.replaceAll("_", " ")}.</p>
      <p>Autorizada por {autorizacao.autorizador.nome}, em {dataHoraUtc(autorizacao.criadaEm)} (UTC). Prazo até {dataHoraUtc(autorizacao.prazoAte)} (UTC).</p>
      <p className="whitespace-pre-wrap">{autorizacao.motivo}</p>
      {autorizacao.reserva ? <p role="status">Reserva registrada. <Link className="underline" href={`/academico/recuperacoes/planos/${encodeURIComponent(propostaId)}`}>Voltar ao plano para conferir a tentativa e autorizar sua realização.</Link></p> : autorizacao.podeReservar ? <ReservarComAutorizacao propostaId={d.propostaId} propostaHash={d.propostaHash} autorizacaoId={autorizacao.id} habilidade={autorizacao.habilidade} /> : <p role="status">Esta autorização não está disponível para reserva nas condições atuais.</p>}
      <p>A realização durante pausa ou encerramento ainda exige a autorização específica de realização.</p>
    </article>)}
    {!d.historico.length && <p>Nenhuma autorização especial registrada.</p>}
    {d.proximoId && <Link className="underline" href={`?depoisId=${encodeURIComponent(d.proximoId)}`}>Próximas autorizações</Link>}
  </section>;
}
