import { conferirRevisaoParaDecisao } from "@/server/agenda/replanejamento-conferencia";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRevisaoReplanejamento } from "@/server/agenda/replanejamento-historico";
import { ConteudoRevisao } from "../../replanejamento/ConteudoRevisao";
import { DecidirReplanejamento } from "./DecidirReplanejamento";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";

export default async function RevisaoPage({ params }: { params: Promise<{ id: string; revisaoId: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const { id, revisaoId } = await params;
  const [resultado, preferencia] = await Promise.all([
    consultarRevisaoReplanejamento({ calendarioId: id, revisaoId }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!resultado.ok || !resultado.dado) return <div><VoltarPara href={`/academico/calendario/${id}/revisoes`} para="Histórico" /><p role="alert">{resultado.ok ? "Revisão indisponível." : resultado.erro}</p></div>;
  const r = resultado.dado;
  const conferencia = await conferirRevisaoParaDecisao({ calendarioId: id, revisaoId });
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, r.calendario.fusoInstitucional);
  const data = (v: Date | string) => formatarInstanteExibicao(v, fusoExibicao, r.calendario.fusoInstitucional).texto;
  // Tamanho do conjunto para a confirmação da aprovação (docs/42 L1102): turmas e encontros que mudam de data.
  const alterados = r.snapshot.revisoes.map((t) => t.previsao?.propostas.filter((p) => p.alterado).length ?? 0);
  const resumo = { turmas: alterados.filter((n) => n > 0).length, encontros: alterados.reduce((soma, n) => soma + n, 0) };
  return <div className="space-y-5">
    <VoltarPara href={`/academico/calendario/${id}/revisoes`} para="Histórico" />
    <h1 className="text-2xl font-medium">Revisão {r.versao} · Calendário {r.calendario.versao}</h1>
    <p>Registrada por {r.preparador.nome} em {data(r.criadoEm)} ({fusoExibicao}; origem {r.calendario.fusoInstitucional})</p>
    <p className="whitespace-pre-wrap">{r.motivo}</p>
    <p>Conteúdo histórico, somente leitura. As datas e pendências abaixo correspondem à conferência de {data(new Date(r.snapshot.conferidoEm))}. Podem diferir da agenda atual. Este registro não comprova aprovação ou aplicação.</p>
    <section className="space-y-2 rounded border p-4">
      <h2 className="font-medium">Conferência atual para decisão</h2>
      {!conferencia.ok || !conferencia.dado ? <p role="alert">{conferencia.ok ? "Conferência indisponível." : conferencia.erro}</p> : <>
        <p>{conferencia.dado.estadoCorresponde ? "O conjunto ainda corresponde à consulta atual." : "Não foi confirmada a correspondência com a agenda atual."}</p>
        <ul className="list-inside list-disc">{conferencia.dado.motivos.map((m) => <li key={m}>{m}</li>)}</ul>
        {!!conferencia.dado.excecoes.length && <p>{conferencia.dado.excecoes.length} encontros exigem exceção explícita de dia não letivo; consulte suas datas e justificativas no conteúdo abaixo.</p>}
        {conferencia.dado.decisaoConjunta ? <p>{conferencia.dado.decisaoConjunta.aprovada ? "Esta revisão foi aprovada" : "Esta revisão foi rejeitada"} por {conferencia.dado.decisaoConjunta.decisorNome}. Motivo: {conferencia.dado.decisaoConjunta.motivo}</p> : <DecidirReplanejamento calendarioId={id} revisaoId={revisaoId} resumo={resumo} podeAprovar={conferencia.dado.aprovacaoDisponivel} podeRejeitar={conferencia.dado.rejeicaoDisponivel} preferenciaFusoExibicao={preferencia.ok ? preferencia.dado?.fusoExibicao : null} excecoes={conferencia.dado.excecoes.map((e) => ({ encontroId: e.encontroId, codigo: e.codigo, inicio: e.inicio, fusoOrigem: e.fusoOrigem, motivoProposto: e.motivoProposto }))} />}
      </>}
    </section>
    <ConteudoRevisao r={r.snapshot} historico preferenciaFusoExibicao={preferencia.ok ? preferencia.dado?.fusoExibicao : null} />
    {!!r.snapshot.particulares.length && <details className="rounded border p-4"><summary>Horários individuais registrados na conferência · exibidos em {fusoExibicao}; referência institucional {r.calendario.fusoInstitucional}</summary>
      <ul>{r.snapshot.particulares.map((p, i) => <li key={p.id}>Encontro individual {i + 1}: {data(new Date(p.inicio))} a {data(new Date(p.fim))}</li>)}</ul>
    </details>}
    {!!r.snapshot.recuperacoes?.length && <details className="rounded border p-4"><summary>Recuperações registradas na conferência · exibidas em {fusoExibicao}; referência institucional {r.calendario.fusoInstitucional}</summary>
      <ul>{r.snapshot.recuperacoes.map((p, i) => <li key={p.id}>Recuperação {i + 1}: {data(new Date(p.inicio))} a {data(new Date(p.fim))}</li>)}</ul>
    </details>}
  </div>;
}
