import { conferirRevisaoParaDecisao } from "@/server/agenda/replanejamento-conferencia";
import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRevisaoReplanejamento } from "@/server/agenda/replanejamento-historico";
import { ConteudoRevisao } from "../../replanejamento/ConteudoRevisao";

export default async function RevisaoPage({ params }: { params: Promise<{ id: string; revisaoId: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const { id, revisaoId } = await params;
  const resultado = await consultarRevisaoReplanejamento({ calendarioId: id, revisaoId });
  if (!resultado.ok || !resultado.dado) return <div><Link href={`/academico/calendario/${id}/revisoes`}>Voltar ao histórico</Link><p role="alert">{resultado.ok ? "Revisão indisponível." : resultado.erro}</p></div>;
  const r = resultado.dado;
  const conferencia = await conferirRevisaoParaDecisao({ calendarioId: id, revisaoId });
  const data = (v: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: r.calendario.fusoInstitucional }).format(v);
  return <div className="space-y-5">
    <Link className="underline" href={`/academico/calendario/${id}/revisoes`}>Voltar ao histórico</Link>
    <h1 className="text-2xl font-medium">Revisão {r.versao} · Calendário {r.calendario.versao}</h1>
    <p>Registrada por {r.preparador.nome} em {data(r.criadoEm)} · {r.calendario.fusoInstitucional}</p>
    <p className="whitespace-pre-wrap">{r.motivo}</p>
    <p>Conteúdo histórico, somente leitura. As datas e pendências abaixo correspondem à conferência de {data(new Date(r.snapshot.conferidoEm))}. Podem diferir da agenda atual. Este registro não comprova aprovação ou aplicação.</p>
    <section className="space-y-2 rounded border p-4">
      <h2 className="font-medium">Conferência atual para decisão</h2>
      {!conferencia.ok || !conferencia.dado ? <p role="alert">{conferencia.ok ? "Conferência indisponível." : conferencia.erro}</p> : <>
        <p>{conferencia.dado.estadoCorresponde ? "O conjunto ainda corresponde à consulta atual." : "Não foi confirmada a correspondência com a agenda atual."}</p>
        <ul className="list-inside list-disc">{conferencia.dado.motivos.map((m) => <li key={m}>{m}</li>)}</ul>
        {!!conferencia.dado.excecoes.length && <p>{conferencia.dado.excecoes.length} encontros exigem exceção explícita de dia não letivo; consulte suas datas e justificativas no conteúdo abaixo.</p>}
        <p>A aprovação e aplicação conjunta ainda não estão disponíveis. Esta conferência não altera o registro histórico nem a agenda.</p>
      </>}
    </section>
    <ConteudoRevisao r={r.snapshot} historico />
    {!!r.snapshot.particulares.length && <details className="rounded border p-4"><summary>Horários individuais registrados na conferência · {r.calendario.fusoInstitucional}</summary>
      <ul>{r.snapshot.particulares.map((p, i) => <li key={p.id}>Encontro individual {i + 1}: {data(new Date(p.inicio))} a {data(new Date(p.fim))}</li>)}</ul>
    </details>}
    {!!r.snapshot.recuperacoes?.length && <details className="rounded border p-4"><summary>Recuperações registradas na conferência · {r.calendario.fusoInstitucional}</summary>
      <ul>{r.snapshot.recuperacoes.map((p, i) => <li key={p.id}>Recuperação {i + 1}: {data(new Date(p.inicio))} a {data(new Date(p.fim))}</li>)}</ul>
    </details>}
  </div>;
}
