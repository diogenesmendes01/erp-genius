import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarSubstituicaoAgendaSegundaChamada } from "@/server/avaliacoes/segunda-chamada-substituicao";
import { Formulario } from "./Formulario";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { STATUS_ENCONTRO_LABEL, rotular } from "@/lib/labels";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

function periodo(inicio: string, fim: string, fuso: string) {
  const formatar = (valor: string) => new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: fuso,
  }).format(new Date(valor));
  return `${formatar(inicio)} até ${formatar(fim)} (${fuso})`;
}
function resumoConferido(snapshot: { professorNome: string; inicio: string; fim: string; fusoOrigem: string }) {
  if (!snapshot.professorNome || !snapshot.inicio || !snapshot.fim || !snapshot.fusoOrigem) return "Dados históricos insuficientes para exibir o responsável e horário conferidos.";
  return `Responsável conferido: ${snapshot.professorNome}. Horário conferido: ${periodo(snapshot.inicio, snapshot.fim, snapshot.fusoOrigem)}.`;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ reservaId: string }>;
  searchParams: Promise<{ substitutoId?: string; antesVersao?: string }>;
}) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const { reservaId } = await params;
  const { substitutoId, antesVersao } = await searchParams;
  const versao = antesVersao && /^\d+$/.test(antesVersao) ? Number(antesVersao) : undefined;
  const [resultado, preferencia] = await Promise.all([consultarSubstituicaoAgendaSegundaChamada({
    reservaId,
    ...(substitutoId ? { substitutoId } : {}),
    ...(versao ? { antesVersao: versao } : {}),
  }), consultarPreferenciaFusoEquipe()]);
  // Registro e decisão no fuso de exibição de quem lê, com a origem dita (docs/43 §6 item 6): antes, ISO cru.
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const instante = (valor: Date | string) => `${formatarInstanteExibicao(valor, fusoExibicao, "UTC").texto} (${fusoExibicao}; origem UTC)`;
  if (!resultado.ok || !resultado.dado) {
    return <section className="space-y-3"><VoltarPara href="/academico/segundas-chamadas/agendas" /><p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p></section>;
  }
  const d = resultado.dado;
  const base = `/academico/segundas-chamadas/reservas/${encodeURIComponent(reservaId)}/substituicao`;
  return <section className="space-y-4">
    <VoltarPara href="/academico/segundas-chamadas/agendas" />
    <h1 className="text-2xl font-medium">Substituir professor da segunda chamada</h1>
    <p>{d.identificacao.aluno} · Matrícula {d.identificacao.matriculaCodigo ?? "sem código"} · {d.identificacao.turma} · avaliação {d.identificacao.codigoAvaliacao}.</p>
    <section className="rounded border p-4"><h2 className="font-medium">Agenda preservada</h2><p>Professor atual: {d.encontro.professorNome}.</p><p>Horário: {periodo(d.encontro.inicio, d.encontro.fim, d.encontro.fusoOrigem)}.</p><p>Situação: {rotular(STATUS_ENCONTRO_LABEL, d.encontro.status)}.</p></section>
    <p>A aprovação atualiza o responsável por esta avaliação, preservando turma, horário, contrato e oportunidade. Outra pessoa da gestão precisa decidir.</p>
    {/* Sem key do substituto (docs/43 §6 item 3; docs/42 L1814): trocar o professor faz router.replace com o novo
        substitutoId, e o formulário continua montado — motivo e evidência digitados não se perdem. */}
    {(d.podePropor || d.previa) && <Formulario reservaId={reservaId} base={base} professores={d.professores} selecionado={substitutoId} previa={d.previa} />}
    <h2 className="font-medium">Propostas e decisões</h2>
    {!d.itens.length && <EstadoVazio bloco>Nenhuma proposta de substituição foi registrada.</EstadoVazio>}
    {d.itens.map((item) => <article key={item.id} className="space-y-2 rounded border p-4">
      <p>Versão {item.versao} · proposta de {item.autorNome}.</p>
      <p>{resumoConferido(item.snapshot)}</p><p>Substituto proposto: {item.substitutoNome}.</p><p>Motivo: {item.motivo}</p><p>Evidência: {item.evidencia}</p>
      <p>Registrada em {instante(item.criadaEm)}.</p>
      {item.decisao
        ? <p role="status">{item.decisao.aprovada ? (item.decisao.aplicada ? "Aprovada e aplicada" : "Aprovada") : "Rejeitada"} por {item.decisao.decisorNome}: {item.decisao.motivo}. Decisão em {instante(item.decisao.decididaEm)}.</p>
        : <><p>Aguardando decisão independente.</p>{item.podeDecidir && item.entradaHash && <Formulario reservaId={reservaId} base={base} proposta={{ id: item.id, hash: item.entradaHash, podeAprovar: item.podeAprovar ?? true, impedimentoAprovacao: item.impedimentoAprovacao ?? null }} />}</>}
    </article>)}
    {(versao || d.proximaVersao) && <nav className="flex gap-4" aria-label="Paginação das substituições">
      {versao && <Link className="underline" href={substitutoId ? `${base}?substitutoId=${encodeURIComponent(substitutoId)}` : base}>Primeira página</Link>}
      {d.proximaVersao && <Link className="underline" href={`${base}?antesVersao=${d.proximaVersao}${substitutoId ? `&substitutoId=${encodeURIComponent(substitutoId)}` : ""}`}>Propostas anteriores</Link>}
    </nav>}
  </section>;
}
