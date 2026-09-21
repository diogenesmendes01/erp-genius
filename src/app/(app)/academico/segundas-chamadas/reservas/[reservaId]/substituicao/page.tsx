import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarSubstituicaoAgendaSegundaChamada } from "@/server/avaliacoes/segunda-chamada-substituicao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { Formulario } from "./Formulario";

function periodo(inicio: string, fim: string, preferencia: string | null, fuso: string) {
  const i = formatarInstanteExibicao(inicio, preferencia, fuso);
  return `${i.texto} até ${formatarInstanteExibicao(fim, preferencia, fuso).texto} (${i.fuso})`;
}
function administrativo(valor: string | Date, preferencia: string | null) {
  const e = formatarInstanteExibicao(valor, preferencia, "UTC");
  return `${e.texto} (${e.fuso}; origem UTC)`;
}
function resumoConferido(snapshot: { professorNome: string; inicio: string; fim: string; fusoOrigem: string }, preferencia: string | null) {
  if (!snapshot.professorNome || !snapshot.inicio || !snapshot.fim || !snapshot.fusoOrigem) return "Dados históricos insuficientes para exibir o responsável e horário conferidos.";
  return `Responsável conferido: ${snapshot.professorNome}. Horário conferido: ${periodo(snapshot.inicio, snapshot.fim, preferencia, snapshot.fusoOrigem)}.`;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ reservaId: string }>;
  searchParams: Promise<{ substitutoId?: string; antesVersao?: string }>;
}) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const preferencia = await consultarPreferenciaFusoEquipe();
  const fusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const { reservaId } = await params;
  const { substitutoId, antesVersao } = await searchParams;
  const versao = antesVersao && /^\d+$/.test(antesVersao) ? Number(antesVersao) : undefined;
  const resultado = await consultarSubstituicaoAgendaSegundaChamada({
    reservaId,
    ...(substitutoId ? { substitutoId } : {}),
    ...(versao ? { antesVersao: versao } : {}),
  });
  if (!resultado.ok || !resultado.dado) {
    return <section className="space-y-3"><Link className="underline" href="/academico/segundas-chamadas/agendas">Voltar às agendas</Link><p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p></section>;
  }
  const d = resultado.dado;
  const base = `/academico/segundas-chamadas/reservas/${encodeURIComponent(reservaId)}/substituicao`;
  return <section className="space-y-4">
    <Link className="underline" href="/academico/segundas-chamadas/agendas">Voltar às agendas</Link>
    <h1 className="text-2xl font-medium">Substituir professor da segunda chamada</h1>
    <p>{d.identificacao.aluno} · Matrícula {d.identificacao.matriculaCodigo ?? "sem código"} · {d.identificacao.turma} · avaliação {d.identificacao.codigoAvaliacao}.</p>
    <section className="rounded border p-4"><h2 className="font-medium">Agenda preservada</h2><p>Professor atual: {d.encontro.professorNome}.</p><p>Horário: {periodo(d.encontro.inicio, d.encontro.fim, fusoExibicao, d.encontro.fusoOrigem)}.</p><p>Situação: {d.encontro.status}.</p></section>
    <p>A aprovação atualiza o responsável por esta avaliação, preservando turma, horário, contrato e oportunidade. Outra pessoa da gestão precisa decidir.</p>
    {(d.podePropor || d.previa) && <Formulario key={substitutoId ?? "sem-substituto"} reservaId={reservaId} base={base} professores={d.professores} selecionado={substitutoId} previa={d.previa} />}
    <h2 className="font-medium">Propostas e decisões</h2>
    {!d.itens.length && <p>Nenhuma proposta de substituição foi registrada.</p>}
    {d.itens.map((item) => <article key={item.id} className="space-y-2 rounded border p-4">
      <p>Versão {item.versao} · proposta de {item.autorNome}.</p>
      <p>{resumoConferido(item.snapshot, fusoExibicao)}</p><p>Substituto proposto: {item.substitutoNome}.</p><p>Motivo: {item.motivo}</p><p>Evidência: {item.evidencia}</p>
      <p>Registrada em {administrativo(item.criadaEm, fusoExibicao)}.</p>
      {item.decisao
        ? <p role="status">{item.decisao.aprovada ? (item.decisao.aplicada ? "Aprovada e aplicada" : "Aprovada") : "Rejeitada"} por {item.decisao.decisorNome}: {item.decisao.motivo}. Decisão em {administrativo(item.decisao.decididaEm, fusoExibicao)}.</p>
        : <><p>Aguardando decisão independente.</p>{item.podeDecidir && item.entradaHash && <Formulario reservaId={reservaId} base={base} proposta={{ id: item.id, hash: item.entradaHash, podeAprovar: item.podeAprovar ?? true, impedimentoAprovacao: item.impedimentoAprovacao ?? null }} />}</>}
    </article>)}
    {(versao || d.proximaVersao) && <nav className="flex gap-4" aria-label="Paginação das substituições">
      {versao && <Link className="underline" href={substitutoId ? `${base}?substitutoId=${encodeURIComponent(substitutoId)}` : base}>Primeira página</Link>}
      {d.proximaVersao && <Link className="underline" href={`${base}?antesVersao=${d.proximaVersao}${substitutoId ? `&substitutoId=${encodeURIComponent(substitutoId)}` : ""}`}>Propostas anteriores</Link>}
    </nav>}
  </section>;
}
