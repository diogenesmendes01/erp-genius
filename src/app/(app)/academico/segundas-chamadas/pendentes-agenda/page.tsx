import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarSegundasChamadasSemAgenda } from "@/server/avaliacoes/segunda-chamada-fila-agenda";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";

const situacao = (valor: { pendente: boolean; saldo: number; statusMatricula: string; alocacaoAtiva: boolean; possuiReservaTerminal: boolean; possuiPendenciaEscola: boolean }) => {
  if (valor.possuiPendenciaEscola) return "Impedimento da escola pendente de revisão";
  if (["PAUSADA", "ENCERRADA"].includes(valor.statusMatricula)) return "Indisponível sem autorização específica; a prévia confere";
  if (!valor.pendente || valor.saldo <= 0) return "Sem oportunidade pendente disponível";
  if (!valor.alocacaoAtiva) return "Vínculo sem atividade atual; a prévia confirmará a possibilidade";
  if (valor.possuiReservaTerminal) return "Oportunidade anterior encerrada; a prévia confirmará a possibilidade";
  return "Disponibilizada para preparação";
};

function lerCursor(valor: string | undefined) {
  if (!valor) return undefined;
  try {
    const cursor = JSON.parse(valor) as { criadaEm?: unknown; id?: unknown };
    return typeof cursor.criadaEm === "string" && typeof cursor.id === "string" ? { criadaEm: cursor.criadaEm, id: cursor.id } : null;
  } catch { return null; }
}

export default async function PendentesAgenda({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const { cursor: cursorBruto } = await searchParams;
  const cursor = lerCursor(cursorBruto);
  if (cursor === null) return <section className="space-y-3"><VoltarPara href="/academico" /><p role="alert">Cursor de fila inválido.</p></section>;
  const [r, preferencia] = await Promise.all([listarSegundasChamadasSemAgenda(cursor ? { cursor } : {}), consultarPreferenciaFusoEquipe()]);
  if (!r.ok || !r.dado) return <section className="space-y-3"><VoltarPara href="/academico" /><p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p></section>;
  const d = r.dado;
  const fuso = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  return <section className="space-y-4">
    <VoltarPara href="/academico" />
    {cursorBruto && <Link className="underline" href="/academico/segundas-chamadas/pendentes-agenda">Primeira página</Link>}
    <header><h1 className="text-2xl font-medium">Segundas chamadas pendentes de agenda</h1><p>Prepare a prévia antes de propor uma agenda. A listagem não confirma disponibilidade de professor ou horário.</p></header>
    {!d.itens.length && <p>Nenhuma segunda chamada pendente de agenda foi encontrada.</p>}
    {d.itens.map(item => <article key={item.propostaSegundaChamadaId} className="space-y-2 rounded border p-4">
      <h2 className="font-medium">{item.aluno} · avaliação {item.codigoAvaliacao}</h2>
      <p>Matrícula {item.matriculaCodigo ?? "sem código"} · Turma {item.turma}.</p>
      <p>Prazo atual: {formatarInstanteExibicao(item.prazoAte, fuso, "UTC").texto} ({fuso}; origem UTC). Situação: {situacao(item.situacao)}.</p>
      <Link className="underline" href={`/academico/segundas-chamadas/propostas/${encodeURIComponent(item.propostaSegundaChamadaId)}/agenda`}>Preparar agenda inicial</Link>
    </article>)}
    {d.proximoCursor && <Link className="underline" href={`/academico/segundas-chamadas/pendentes-agenda?cursor=${encodeURIComponent(JSON.stringify(d.proximoCursor))}`}>Próximas pendências</Link>}
  </section>;
}
