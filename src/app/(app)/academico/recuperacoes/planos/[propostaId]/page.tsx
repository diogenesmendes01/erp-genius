import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarOperacaoRecuperacao } from "@/server/avaliacoes/recuperacao-operacao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { consultarFusoInstitucional } from "@/server/operacao/consultas";
import { IdentificacaoAvaliacao } from "../../../avaliacoes/Identificacao";
import { Disponibilizar, Reservar, Realizar, CancelarPelaEscola } from "./Formularios";
import { PreviaAgenda } from "./PreviaAgenda";
import { AgendaPublicada } from "../../AgendaPublicada";
import { EstadoVazio } from "@/components/EstadoVazio";
export default async function Operacao({ params, searchParams }: { params: Promise<{ propostaId: string }>; searchParams: Promise<{ depoisId?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { propostaId } = await params;
  const { depoisId } = await searchParams;
  const [r, preferencia, fusoInstitucional] = await Promise.all([
    consultarOperacaoRecuperacao({ propostaId, depoisId }),
    consultarPreferenciaFusoEquipe(),
    consultarFusoInstitucional(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const horario = (instante: string) => formatarInstanteExibicao(instante, fusoExibicao, "UTC").texto;
  return <section className="space-y-4">
    <Link className="underline" href={`/academico/recuperacoes/planos?${new URLSearchParams({ alocacaoId: d.alocacaoId })}`}>Planos desta matrícula</Link>
    <h1 className="text-2xl font-medium">Executar plano de recuperação {d.versao}</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <p>Aprovado em {horario(d.aprovadaEm)} ({fusoExibicao}; origem UTC).</p>
    {d.fontesMudaram && <p role="status">As notas ou suas fontes mudaram. Novas reservas e disponibilização precisam de nova conferência do plano.</p>}
    {!d.vinculoValido && <p role="status">Vínculo ou situação da matrícula exige conferência antes de novos avanços.</p>}
    <h2 className="text-xl font-medium">Prazo e disponibilização</h2>
    <p>Prazo configurado: {d.prazoMinutos} minutos, contado a partir da disponibilização efetiva ao aluno.</p>
    {d.disponibilizacao ? <div className="space-y-2 rounded border p-3">
      <p>Disponibilizado em {horario(d.disponibilizacao.inicio)}. Prazo original: {horario(d.disponibilizacao.prazoOriginal)}. Prazo vigente: {horario(d.disponibilizacao.prazoVigente)}. ({fusoExibicao}; origem UTC).</p>
      <p className="whitespace-pre-wrap">Condições: {d.disponibilizacao.condicoes}</p><p className="whitespace-pre-wrap">Comunicação registrada: {d.disponibilizacao.evidenciaComunicacao}</p>
    </div> : <p>Aguardando registro das condições disponibilizadas e da comunicação ao aluno.</p>}
    {d.podeDisponibilizar && d.autorizacaoDisponibilizacao && <p role="status">Esta disponibilização usará a autorização especial válida até {horario(d.autorizacaoDisponibilizacao.prazoAte)} ({fusoExibicao}; origem UTC).</p>}
    {d.disponibilizacao && <Link className="block underline" href={`/academico/recuperacoes/planos/${encodeURIComponent(d.propostaId)}/prorrogacoes`}>Propor e conferir prorrogações</Link>}
    {d.podeDisponibilizar && d.propostaHash && <Disponibilizar key={`${d.propostaHash}:${d.autorizacaoDisponibilizacao?.id ?? "sem-autorizacao"}`} propostaId={d.propostaId} propostaHash={d.propostaHash} autorizacaoPreparacaoId={d.autorizacaoDisponibilizacao?.id} fusoInstitucional={fusoInstitucional} />}
    {d.podeGerirDesignacoes && !d.vinculoValido && !d.autorizacaoDisponibilizacao && !d.disponibilizacao && <Link className="block underline" href={`/academico/recuperacoes/planos?${new URLSearchParams({ alocacaoId: d.alocacaoId })}`}>Consultar planos para obter autorização especial de preparação</Link>}
    <h2 className="text-xl font-medium">Tentativas por habilidade neste nível da matrícula</h2>
    <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Saldo de tentativas de recuperação</caption><thead><tr><th scope="col">Habilidade</th><th scope="col">Limite da regra</th><th scope="col">Extras aprovadas</th><th scope="col">Limite total</th><th scope="col">Consumidas</th><th scope="col">Reservadas</th><th scope="col">Disponíveis</th></tr></thead><tbody>{d.saldo.map(h => <tr key={h.habilidade}><th scope="row">{h.habilidade.replaceAll("_", " ")}</th><td>{h.limiteBase}</td><td>{h.extrasAprovadas}</td><td>{h.limite}</td><td>{h.consumidas}</td><td>{h.reservadas}</td><td>{h.disponiveis}</td></tr>)}</tbody></table></div>
    <Link className="block underline" href={`/academico/avaliacoes/${encodeURIComponent(d.alocacaoId)}/extras`}>Consultar e solicitar oportunidades extras</Link>
    {d.podeGerirDesignacoes && <Link className="block underline" href={`/academico/recuperacoes/planos/${encodeURIComponent(d.propostaId)}/autorizacao-reserva`}>Autorizar pré-reserva especial de recuperação</Link>}
    <p>A reserva separa uma oportunidade de avaliação; não confirma um horário na agenda nem consome definitivamente a tentativa.</p>
    {d.podeReservar && d.propostaHash && <Reservar propostaId={d.propostaId} propostaHash={d.propostaHash} saldo={d.saldo} />}
    <h2 className="text-xl font-medium">Reservas e realizações</h2>
    {d.reservas.map(reserva => <article key={reserva.id} className="space-y-3 rounded border p-4">
      <p>Reserva de {horario(reserva.criadaEm)} ({fusoExibicao}; origem UTC).</p><p className="whitespace-pre-wrap">{reserva.motivo}</p>
      {reserva.cancelamento && <p className="whitespace-pre-wrap">Cancelamento pela escola: {reserva.cancelamento.motivo}. Evidência: {reserva.cancelamento.evidencia}</p>}
      {reserva.itens.map(i => <div key={i.id} className="space-y-2 rounded border p-3"><h3 className="font-medium">{i.habilidade.replaceAll("_", " ")}</h3>
        <AgendaPublicada agenda={i.agenda} preferenciaFusoExibicao={preferencia.ok ? preferencia.dado?.fusoExibicao : null} />
        {!i.realizacao && !reserva.cancelamento && d.situacaoContratual !== "ATIVA" && <p role="status">{i.autorizacaoEspecialAte
          ? `Autorização específica vigente até ${horario(i.autorizacaoEspecialAte)} (${fusoExibicao}; origem UTC). Prazo do plano, atribuição docente e condições da agenda continuam obrigatórios.`
          : "Sem autorização específica vigente para uma nova realização nesta situação contratual. Avaliações anteriores podem ser registradas quando o histórico comprovar a permissão na data informada."}</p>}
        {i.realizacao ? <><p>Realizada em {horario(i.realizacao.realizadaEm)} ({fusoExibicao}; origem UTC); tentativa consumida.</p><Link className="underline" href={`/academico/recuperacoes/${encodeURIComponent(i.realizacao.id)}`}>Nota e conferência desta realização</Link></> : <p>{reserva.cancelamento ? "Reserva liberada, sem realização." : "Aguardando realização; nota ainda não registrada."}</p>}
        {i.podeRegistrarRealizacao && <Realizar itemReservaId={i.id} somenteHistorica={!i.podeRegistrarAgora} fusoInstitucional={fusoInstitucional} />}
        {d.podeGerirDesignacoes && !i.realizacao && !reserva.cancelamento && !i.agenda && <PreviaAgenda itemReservaId={i.id} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} fusoInstitucional={fusoInstitucional} />}
        {d.podeGerirDesignacoes && <Link className="block underline" href={`/academico/recuperacoes/tentativas/${encodeURIComponent(i.id)}/agenda`}>Preparar e revisar propostas de horário</Link>}
        {d.podeGerirDesignacoes && <Link className="block underline" href={`/academico/recuperacoes/tentativas/${encodeURIComponent(i.id)}/designacao`}>Gerenciar avaliador desta tentativa</Link>}
        {d.podeGerirDesignacoes && <Link className="block underline" href={`/academico/recuperacoes/tentativas/${encodeURIComponent(i.id)}/autorizacao`}>Autorizar realização especial desta tentativa</Link>}
      </div>)}
      {reserva.podeCancelarPelaEscola && <CancelarPelaEscola reservaId={reserva.id} />}
      {d.podeGerirDesignacoes && <Link className="block underline" href={`/academico/recuperacoes/reservas/${encodeURIComponent(reserva.id)}/cancelamento`}>Propor ou revisar cancelamento de recuperação agendada</Link>}
    </article>)}
    {!d.reservas.length && <EstadoVazio bloco>Nenhuma reserva nesta página.</EstadoVazio>}
    {d.proximoId && <Link className="underline" href={`/academico/recuperacoes/planos/${encodeURIComponent(propostaId)}?${new URLSearchParams({ depoisId: d.proximoId })}`}>Próximas reservas</Link>}
  </section>;
}
