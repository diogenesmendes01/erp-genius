import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarAgendasSegundaChamada } from "@/server/avaliacoes/segunda-chamada-agendas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

const rotulosReserva: Record<string, string> = {
  RESERVADA: "Reservada",
  CONSUMIDA_REALIZACAO: "Realizada",
  CONSUMIDA_FALTA: "Falta",
  LIBERADA_CANCELAMENTO_ESCOLA: "Cancelada pela escola",
  LIBERADA_CANCELAMENTO_TEMPESTIVO: "Cancelada dentro do prazo",
  CONSUMIDA_CANCELAMENTO_TARDIO: "Cancelada fora do prazo",
  PENDENCIA_ESCOLA: "Pendência da escola",
};
const rotulosEncontro: Record<string, string> = {
  PREVISTO: "Previsto",
  MINISTRADO: "Ministrado",
  CANCELADO: "Cancelado",
  NAO_REALIZADO: "Não realizado",
  IMPEDIDO_ESCOLA: "Impedido pela escola",
};
const rotulo = (rotulos: Record<string, string>, valor: string) => rotulos[valor] ?? "Em conferência";

function dataHora(valor: string, fuso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: fuso,
  }).format(new Date(valor));
}

export default async function AgendasSegundaChamadaPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await exigirSessaoPagina(
    Papel.SECRETARIA_ACADEMICA,
    Papel.GERENTE_PEDAGOGICO,
    Papel.ADMINISTRADOR,
  );
  const { cursor } = await searchParams;
  const [resultado, preferencia] = await Promise.all([listarAgendasSegundaChamada(cursor ? { cursor } : {}), consultarPreferenciaFusoEquipe()]);
  if (!resultado.ok || !resultado.dado) {
    return <section className="space-y-3"><Link className="underline" href="/academico">Voltar ao acadêmico</Link><p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p></section>;
  }
  const d = resultado.dado;

  return <section className="space-y-4">
    <Link className="underline" href="/academico">Voltar ao acadêmico</Link>
    {cursor && <Link className="underline" href="/academico/segundas-chamadas/agendas">Primeira página</Link>}
    <header><h1 className="text-2xl font-medium">Agendas de segunda chamada</h1><p>Consulte as reservas agendadas e abra a remarcação da oportunidade correspondente.</p></header>
    {!d.itens.length && <p>Nenhuma agenda de segunda chamada foi encontrada.</p>}
    {d.itens.map((item) => <article key={item.reservaId} className="space-y-2 rounded border p-4">
      <h2 className="font-medium">{item.aluno} · avaliação {item.codigoAvaliacao}</h2>
      <p>Matrícula {item.matricula.codigo ?? "sem código"} · Turma {item.turma.codigo ?? item.turma.nome ?? "sem identificação"}.</p>
      {item.agenda && (() => { const fuso=resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null,item.agenda.fusoOrigem); return <p>Horário: {dataHora(item.agenda.inicio,fuso)} até {dataHora(item.agenda.fim,fuso)} ({fuso}; origem {item.agenda.fusoOrigem}).</p>; })()}
      <p>Situação da reserva: {rotulo(rotulosReserva, item.statusReserva)}. Situação do encontro: {item.agenda ? rotulo(rotulosEncontro, item.agenda.status) : "Sem agenda"}.</p>
      <div className="flex gap-4"><Link className="underline" href={`/academico/segundas-chamadas/reservas/${encodeURIComponent(item.reservaId)}/remarcacao`}>Abrir remarcação</Link><Link className="underline" href={`/academico/segundas-chamadas/reservas/${encodeURIComponent(item.reservaId)}/substituicao`}>Substituir professor</Link></div>
    </article>)}
    {d.proximoCursor && <Link className="inline-block underline" href={`/academico/segundas-chamadas/agendas?cursor=${encodeURIComponent(d.proximoCursor)}`}>Próximas agendas</Link>}
  </section>;
}
