import Link from "next/link";
import { z } from "zod";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRemarcacoesAgendaSegundaChamada } from "@/server/avaliacoes/segunda-chamada-remarcacao";
import { Formulario } from "./Formulario";

const agendaSchema = z.object({ encontro: z.object({ inicio: z.string(), fim: z.string(), fusoOrigem: z.string() }).nullable() });
function periodo(inicio: string, fim: string, fuso: string) {
  const formatar = (valor: string) => new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: fuso,
  }).format(new Date(/(?:Z|[+-]\d\d:\d\d)$/i.test(valor) ? valor : `${valor}Z`));
  return `${formatar(inicio)} até ${formatar(fim)} (${fuso})`;
}
function instante(valor: string, fuso: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso })
    .format(new Date(/(?:Z|[+-]\d\d:\d\d)$/i.test(valor) ? valor : `${valor}Z`));
}
function Agenda({ valor }: { valor: unknown }) {
  const r = agendaSchema.safeParse(valor);
  if (!r.success || !r.data.encontro) return <p>Agenda indisponível para conferência.</p>;
  const e = r.data.encontro;
  return <p>{periodo(e.inicio, e.fim, e.fusoOrigem)}</p>;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ reservaId: string }>;
  searchParams: Promise<{ antesId?: string }>;
}) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const { reservaId } = await params;
  const { antesId } = await searchParams;
  const r = await consultarRemarcacoesAgendaSegundaChamada({
    reservaId,
    ...(antesId ? { antesId } : {}),
  });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <section className="space-y-4">
    <Link href="/academico" className="underline">Acadêmico</Link>
    <h1 className="text-2xl font-medium">Remarcar segunda chamada</h1>
    <p>{d.identificacao.aluno} · Matrícula {d.identificacao.matriculaCodigo ?? "sem código"} · {d.identificacao.turma} · {d.identificacao.nivel}</p>
    <p>A aprovação independente aplica o novo horário após conferir prazo e disponibilidade. Mantém o professor e a mesma oportunidade reservada.</p>
    <h2 className="font-medium">{d.conferencia.contextoVigente ? "Conferência da reserva" : "Conferência histórica da reserva"}</h2>
    {!d.conferencia.contextoVigente && <p role="status">O vínculo atual mudou; estes dados pertencem à reserva histórica e não autorizam nova remarcação.</p>}
    <dl className="grid gap-1">
      <div><dt className="inline font-medium">Reserva: </dt><dd className="inline">{d.conferencia.reservaId}</dd></div>
      <div><dt className="inline font-medium">Avaliação: </dt><dd className="inline">{d.conferencia.codigoAvaliacao}</dd></div>
      <div><dt className="inline font-medium">{d.conferencia.contextoVigente ? "Professor atual: " : "Professor registrado na agenda: "}</dt><dd className="inline">{d.conferencia.professorAtual?.nome ?? "Sem professor definido"}</dd></div>
      <div><dt className="inline font-medium">{d.conferencia.contextoVigente ? "Prazo vigente: " : "Prazo registrado: "}</dt><dd className="inline">{d.conferencia.prazoVigente ? `${instante(d.conferencia.prazoVigente, d.conferencia.fusoExibicao)} (${d.conferencia.fusoExibicao})` : "Disponibilização sem prazo registrado"}</dd></div>
    </dl>
    <h2 className="font-medium">{d.conferencia.contextoVigente ? "Agenda atual" : "Agenda registrada"}</h2>
    <Agenda valor={d.atual} />
    {d.podePropor && <Formulario reservaId={reservaId} estadoConferido={d.estadoHash} />}
    <h2 className="font-medium">Propostas e decisões</h2>
    {!d.itens.length && <p>Nenhuma proposta registrada.</p>}
    {d.itens.map(p => <article key={p.id} className="space-y-3 rounded border p-4">
      <p>Versão {p.versao} · Proposta de {p.autorNome}</p>
      <p>Horário anterior:</p><Agenda valor={p.snapshot} />
      <p>Horário proposto: {periodo(p.inicio, p.fim, p.fusoOrigem)}</p>
      <p>Motivo: {p.motivo}</p><p>Evidência: {p.evidencia}</p>
      {p.calendario ? <>
        <p>Calendário conferido: versão {p.calendario.versao} ({p.calendario.fusoInstitucional}).</p>
        {p.calendario.periodosNaoLetivos.length > 0
          ? <p>{p.calendario.periodosNaoLetivos.length} período(s) não letivo(s) afetado(s); confira os detalhes no calendário da versão indicada.</p>
          : <p>Não há período não letivo afetado.</p>}
        {p.motivoExcecaoNaoLetiva && <p>Justificativa da exceção não letiva: {p.motivoExcecaoNaoLetiva}</p>}
      </> : <p>{p.decisao ? "Registro histórico anterior à conferência de calendário; a decisão registrada permanece preservada." : "Proposta sem conferência de calendário; pode ser rejeitada, mas exige nova proposta para aprovação."}</p>}
      {p.decisao ? <p role="status">{p.decisao.aprovada ? "Aprovada e aplicada" : "Rejeitada"} por {p.decisao.decisorNome}: {p.decisao.motivo}{p.decisao.autorizarDiaNaoLetivo ? " Exceção de período não letivo autorizada." : ""}</p> : <p>Aguardando decisão independente.</p>}
      {p.podeDecidir && <Formulario
        reservaId={reservaId}
        estadoConferido={d.estadoHash}
        proposta={{
          id: p.id,
          hash: p.entradaHash,
          podeAprovar: p.podeAprovar ?? !!p.calendario,
          impedimentoAprovacao: p.impedimentoAprovacao ?? null,
          periodosNaoLetivos: p.calendario?.periodosNaoLetivos ?? [],
        }}
      />}
    </article>)}
    {(antesId || d.proximoId) && <nav className="flex gap-4" aria-label="Paginação das propostas">
      {antesId && <Link href={`/academico/segundas-chamadas/reservas/${encodeURIComponent(reservaId)}/remarcacao`}>Primeira página</Link>}
      {d.proximoId && <Link href={`/academico/segundas-chamadas/reservas/${encodeURIComponent(reservaId)}/remarcacao?antesId=${encodeURIComponent(d.proximoId)}`}>Propostas anteriores</Link>}
    </nav>}
  </section>;
}
