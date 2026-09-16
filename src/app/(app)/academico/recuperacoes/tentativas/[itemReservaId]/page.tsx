import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarTentativaRecuperacaoDesignada } from "@/server/avaliacoes/recuperacao-fila-docente";
import { IdentificacaoAvaliacao } from "../../../avaliacoes/Identificacao";
import { Realizar } from "../../planos/[propostaId]/Formularios";
import { AgendaPublicada } from "../../AgendaPublicada";
const horario = (s: string) => s.replace("T", " ").replace("Z", " UTC");

export default async function Tentativa({ params }: { params: Promise<{ itemReservaId: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR);
  const { itemReservaId } = await params, r = await consultarTentativaRecuperacaoDesignada(itemReservaId);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <section className="space-y-4">
    <Link className="underline" href="/academico/recuperacoes/designadas">Minhas recuperações atribuídas</Link>
    <h1 className="text-2xl font-medium">Recuperação de {d.atividade.habilidade.replaceAll("_", " ")}</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <AgendaPublicada agenda={d.agenda} />
    <p className="whitespace-pre-wrap">Estratégia: {d.atividade.estrategia}</p><p className="whitespace-pre-wrap">Avaliação proposta: {d.atividade.avaliacaoProposta}</p>
    <p>Disponibilizada em {horario(d.disponibilizadaEm)}; reservada em {horario(d.reservadaEm)}. Prazo vigente: {horario(d.prazoVigente)}.</p>
    {d.realizacao ? <><p>Realizada por {d.realizacao.professor} em {horario(d.realizacao.realizadaEm)}.</p><Link className="underline" href={`/academico/recuperacoes/${encodeURIComponent(d.realizacao.id)}`}>Registrar ou consultar a nota</Link></> : <><p>Registre somente a avaliação efetivamente realizada. O sistema confere a autorização e o prazo válidos na data informada.</p>{d.podeRegistrarRealizacao ? <Realizar itemReservaId={d.itemReservaId} professoresHistoricos={d.professoresHistoricos} /> : <p>O registro será liberado quando o horário aprovado começar, mantendo a atribuição vigente.</p>}</>}
  </section>;
}
