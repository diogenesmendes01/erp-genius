import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarTentativaRecuperacaoDesignada } from "@/server/avaliacoes/recuperacao-fila-docente";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { IdentificacaoAvaliacao } from "../../../avaliacoes/Identificacao";
import { Realizar } from "../../planos/[propostaId]/Formularios";
import { AgendaPublicada } from "../../AgendaPublicada";
import { consultarFusoInstitucional } from "@/server/operacao/consultas";
export default async function Tentativa({ params }: { params: Promise<{ itemReservaId: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR);
  const { itemReservaId } = await params;
  const [r, preferencia, fusoInstitucional] = await Promise.all([
    consultarTentativaRecuperacaoDesignada(itemReservaId),
    consultarPreferenciaFusoEquipe(),
    consultarFusoInstitucional(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const horario = (instante: string) => formatarInstanteExibicao(instante, fusoExibicao, "UTC").texto;
  return <section className="space-y-4">
    <Link className="underline" href="/academico/recuperacoes/designadas">Minhas recuperações atribuídas</Link>
    <h1 className="text-2xl font-medium">Recuperação de {d.atividade.habilidade.replaceAll("_", " ")}</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <AgendaPublicada agenda={d.agenda} preferenciaFusoExibicao={preferencia.ok ? preferencia.dado?.fusoExibicao : null} />
    <p className="whitespace-pre-wrap">Estratégia: {d.atividade.estrategia}</p><p className="whitespace-pre-wrap">Avaliação proposta: {d.atividade.avaliacaoProposta}</p>
    <p>Disponibilizada em {horario(d.disponibilizadaEm)}; reservada em {horario(d.reservadaEm)}. Prazo vigente: {horario(d.prazoVigente)}. ({fusoExibicao}; origem UTC).</p>
    {d.realizacao ? <><p>Realizada por {d.realizacao.professor} em {horario(d.realizacao.realizadaEm)} ({fusoExibicao}; origem UTC).</p><Link className="underline" href={`/academico/recuperacoes/${encodeURIComponent(d.realizacao.id)}`}>Registrar ou consultar a nota</Link></> : <><p>Registre somente a avaliação efetivamente realizada. O sistema confere a autorização e o prazo válidos na data informada.</p>{d.situacaoContratual !== "ATIVA" && <p role="status">{d.autorizacaoEspecialAte ? `Autorização específica vigente até ${horario(d.autorizacaoEspecialAte)} (${fusoExibicao}; origem UTC). Uma realização nova ainda depende das demais condições.` : "Sem autorização específica vigente para nova realização. Fato anterior à pausa ou encerramento pode ser regularizado com data e evidência compatíveis."}</p>}{d.podeRegistrarRealizacao ? <Realizar itemReservaId={d.itemReservaId} professoresHistoricos={d.professoresHistoricos} somenteHistorica={!d.podeRegistrarAgora} fusoInstitucional={fusoInstitucional} /> : <p>O registro será liberado quando o horário aprovado começar, mantendo a atribuição vigente.</p>}</>}
  </section>;
}
