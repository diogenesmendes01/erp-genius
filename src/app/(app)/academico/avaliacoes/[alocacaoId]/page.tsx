import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { listarAvaliacoesAlocacao } from "@/server/avaliacoes/lancamentos";
import { consultarConsolidadoAvaliacoes } from "@/server/avaliacoes/consolidado";
import { EstadoVazio } from "@/components/EstadoVazio";

function valor(f: { numerador: string; denominador: string } | null) {
  if (!f) return "Pendente";
  const n = BigInt(f.numerador), d = BigInt(f.denominador), absoluto = n < 0n ? -n : n;
  const centesimos = (absoluto * 200n + d) / (d * 2n);
  return `${n < 0n ? "−" : ""}${centesimos / 100n},${String(centesimos % 100n).padStart(2, "0")}`;
}
const nomes = { FALA: "Fala", COMPREENSAO_ORAL: "Compreensão oral", LEITURA: "Leitura", ESCRITA: "Escrita" };
const pendenciasSegunda = {
  propostasAguardandoDecisao: "Pedidos aguardando decisão",
  autorizacoesAguardandoAgenda: "Autorizações aguardando disponibilização ou agendamento",
  reservasAguardandoRealizacao: "Oportunidades agendadas ainda não realizadas",
  ocorrenciasAguardandoEscola: "Pendências de atendimento pela escola",
  realizacoesSemNotaOficial: "Avaliações realizadas sem nota oficializada",
  extrasAguardandoDecisao: "Oportunidades extras aguardando decisão",
};
const pendencias = {
  correcoesRegulares: "Correções de avaliações aguardando decisão",
  correcoesRecuperacao: "Correções de recuperação aguardando decisão",
  planosAguardandoDecisao: "Planos de recuperação aguardando decisão",
  planosSemDisponibilizacao: "Planos aprovados ainda não disponibilizados",
  tentativasAguardandoRealizacao: "Habilidades com tentativa reservada ainda não realizada",
  habilidadesSemTentativa: "Habilidades de planos aprovados sem tentativa reservada ou realizada",
  oportunidadesExtrasAguardandoDecisao: "Oportunidades extras de recuperação aguardando decisão neste nível",
};
const tituloAvaliacao = (codigo: string, fontes: Array<{ codigo: string; titulo: string }>) => fontes.find((fonte) => fonte.codigo === codigo)?.titulo ?? "Avaliação de destino";

export default async function AvaliacoesPage({ params }: { params: Promise<{ alocacaoId: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId } = await params;
  const r = await listarAvaliacoesAlocacao(alocacaoId);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const consolidado = await consultarConsolidadoAvaliacoes(alocacaoId);
  const aproveitamento = consolidado.ok && consolidado.dado ? consolidado.dado.aproveitamento : undefined;
  return <section className="space-y-4">
    <Link className="underline" href="/academico/avaliacoes">Vínculos e histórico de avaliações</Link>
    <h1 className="text-2xl font-medium">Avaliações — {r.dado.turma}</h1>
    <p>{r.dado.regraVersao ? `Regra de avaliação: versão ${r.dado.regraVersao}.` : "A turma precisa de regra de avaliação conferida antes do lançamento."}</p>
    <p>Selecione a avaliação deste vínculo de matrícula. Notas em rascunho precisam de submissão e conferência independente.</p>
    {temPapel(usuario, Papel.GERENTE_PEDAGOGICO) && <Link className="block underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}/equivalencia`}>Preparar aproveitamento para transferência em turma equivalente</Link>}
    {temPapel(usuario, Papel.GERENTE_PEDAGOGICO) && <Link className="block underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}/fechamento`}>Revisar e confirmar fechamento acadêmico do nível</Link>}
    <Link className="block underline" href={`/academico/recuperacoes?${new URLSearchParams({ alocacaoId })}`}>Consultar e lançar notas de recuperações realizadas</Link>
    {consolidado.ok && <Link className="block underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}/extras`}>Solicitar e conferir oportunidades extras de recuperação</Link>}
    {consolidado.ok && <Link className="block underline" href={`/academico/recuperacoes/planos?${new URLSearchParams({ alocacaoId })}`}>Preparar e conferir planos de recuperação</Link>}
    {consolidado.ok && consolidado.dado && <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-medium">Acompanhamento das notas</h2>
      <p>Inclui avaliações regulares e recuperações oficializadas, conservando o melhor resultado de cada habilidade. Este acompanhamento não representa fechamento do nível; frequência e decisão de progressão têm etapas próprias.</p>
      <p>Valores exibidos com duas casas decimais; a conferência dos mínimos usa o valor sem arredondamento.</p>
      {Object.values(consolidado.dado.pendenciasOperacionais).some(n => n > 0) && <div className="space-y-2 rounded border p-3" role="status">
        <h3 className="font-medium">Pendências operacionais deste vínculo</h3>
        <ul className="list-disc pl-5">{(Object.keys(pendencias) as (keyof typeof pendencias)[]).filter(chave => consolidado.dado!.pendenciasOperacionais[chave] > 0).map(chave => <li key={chave}>{pendencias[chave]}: {consolidado.dado!.pendenciasOperacionais[chave]}.</li>)}</ul>
        <p>Correções em análise preservam as notas oficiais até a decisão. O vencimento de um prazo não conclui uma tentativa automaticamente.</p>
      </div>}
      {Object.values(consolidado.dado.pendenciasSegundaChamada).some(n => n > 0) && <div className="space-y-2 rounded border p-3" role="status">
        <h3 className="font-medium">Pendências de segunda chamada</h3>
        <ul className="list-disc pl-5">{(Object.keys(pendenciasSegunda) as (keyof typeof pendenciasSegunda)[]).filter(chave => consolidado.dado!.pendenciasSegundaChamada[chave] > 0).map(chave => <li key={chave}>{pendenciasSegunda[chave]}: {consolidado.dado!.pendenciasSegundaChamada[chave]}.</li>)}</ul>
        <p>Realizar a avaliação não oficializa a nota. As etapas pendentes precisam ser resolvidas antes do fechamento.</p>
      </div>}
      {aproveitamento && <section className="space-y-3 rounded border p-3" aria-label="Aproveitamento de transferência anterior">
        <h3 className="font-medium">Composição com aproveitamento de transferência anterior</h3>
        {aproveitamento.fontes.length > 0 && <p>Esta composição usa fonte(s) aproveitada(s) de uma transferência anterior nas avaliações e habilidades indicadas abaixo.</p>}
        {aproveitamento.fontes.length > 0 && <ul className="list-disc pl-5">{aproveitamento.fontes.map((fonte) => <li key={`${fonte.codigoAvaliacao}-${fonte.habilidade}`}>{tituloAvaliacao(fonte.codigoAvaliacao, consolidado.dado!.fontes)} · {nomes[fonte.habilidade]}.</li>)}</ul>}
        {aproveitamento.conflitosLocais.length > 0 && <div role="status"><p>Há nota(s) oficializada(s) nesta turma para requisito(s) que também tinham fonte aproveitada. A nota local prevalece:</p><ul className="list-disc pl-5">{aproveitamento.conflitosLocais.map((conflito) => <li key={`${conflito.codigoAvaliacao}-${conflito.habilidade}`}>{tituloAvaliacao(conflito.codigoAvaliacao, consolidado.dado!.fontes)} · {nomes[conflito.habilidade]}.</li>)}</ul></div>}
        {aproveitamento.pendencias.length > 0 && <div role="status"><p>Pendências do aproveitamento:</p><ul className="list-disc pl-5">{aproveitamento.pendencias.map((pendencia) => <li key={`${pendencia.codigoAvaliacao}-${pendencia.habilidade}`}>{tituloAvaliacao(pendencia.codigoAvaliacao, consolidado.dado!.fontes)} · {nomes[pendencia.habilidade]} — {pendencia.situacao === "PENDENTE_FONTE_ALTERADA" ? "a fonte aproveitada mudou e precisa de nova conferência" : "não há fonte aproveitada disponível para este requisito"}.</li>)}</ul></div>}
      </section>}
      <div className="space-y-2 rounded border p-3">
        <h3 className="font-medium">Frequência neste vínculo de turma</h3>
        <p>{consolidado.dado.frequencia.presencas} presenças registradas em {consolidado.dado.frequencia.base} encontros ministrados elegíveis. Mínimo da regra: {consolidado.dado.frequencia.minimoPercentual}%.</p>
        <p>Consulta parcial do vínculo; não encerra o nível nem autoriza progressão.</p>
        {(consolidado.dado.frequencia.pendencias.length > 0 || consolidado.dado.frequencia.pendenciasHistoricas.length > 0) && <p role="status">Há aulas, chamadas ou registros históricos a conferir. Ausências, impedimentos e reposições precisam ser identificados antes do fechamento.</p>}
        {!consolidado.dado.frequencia.base && <p>Nenhum encontro ministrado elegível foi identificado para esta apuração.</p>}
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Resultados por habilidade</caption><thead><tr><th>Habilidade</th><th>Resultado</th><th>Mínimo</th><th>Conferência</th></tr></thead><tbody>
        {consolidado.dado.resultado.habilidades.map(h => {
          const fonteAlterada = aproveitamento?.pendencias.some((pendencia) => pendencia.habilidade === h.habilidade && pendencia.situacao === "PENDENTE_FONTE_ALTERADA");
          const notaLocalPrevalece = aproveitamento?.conflitosLocais.some((conflito) => conflito.habilidade === h.habilidade);
          return <tr key={h.habilidade}><th scope="row">{nomes[h.habilidade]}</th><td>{valor(h.resultado)}</td><td>{h.minimo}</td><td>{fonteAlterada ? "Fonte aproveitada em nova conferência" : notaLocalPrevalece ? "Nota local oficial prevalece" : h.atendeMinimo === null ? "Notas pendentes" : h.atendeMinimo ? "Mínimo atingido" : "Abaixo do mínimo"}</td></tr>;
        })}
      </tbody></table></div>
      <p>Média geral: {valor(consolidado.dado.resultado.geral)}. Mínimo: {consolidado.dado.resultado.minimoGeral}.</p>
      <p>{consolidado.dado.resultado.atendeRequisitosNotas === null ? "Há avaliações sem notas oficiais suficientes." : consolidado.dado.resultado.atendeRequisitosNotas ? "As notas atingem os mínimos geral e por habilidade." : "As notas ainda não atingem todos os mínimos."}</p>
      {consolidado.dado.resultado.recuperacoesPendentes && <p role="status">Há notas de recuperação pendentes de lançamento completo ou conferência. Elas ainda não alteram o resultado.</p>}
      {consolidado.dado.resultado.habilidades.filter(h => h.memoriaRecuperacao.length > 0).map(h => <div className="rounded border p-3" key={h.habilidade}>
        <h3 className="font-medium">Recuperações de {nomes[h.habilidade]}</h3>
        <p>Resultado regular: {valor(h.resultadoOriginal)}. Resultado vigente: {valor(h.resultado)}.</p>
        {h.memoriaRecuperacao.map(m => <p key={m.tentativaId}>Nota: {m.nota ?? "Pendente"} — {m.pendencia ? "aguardando regularização ou conferência" : m.melhorou ? "melhorou o resultado" : "preservado o melhor resultado anterior"}.</p>)}
      </div>)}
      <details><summary>Composição dos resultados</summary>{consolidado.dado.resultado.habilidades.map(h => <div key={h.habilidade} className="my-3"><h3 className="font-medium">{nomes[h.habilidade]} — peso na média geral: {h.peso}</h3>{h.memoria.map(m => <p key={m.avaliacaoId}>{consolidado.dado!.fontes.find(f => f.codigo === m.avaliacaoId)?.titulo ?? m.avaliacaoId}: {m.nota ?? "Pendente"}; peso {m.peso}{m.pendencia === "AGUARDANDO_OFICIALIZACAO" ? " — aguardando conferência" : m.pendencia ? " — nota ausente" : ""}.</p>)}</div>)}</details>
    </section>}
    {!consolidado.ok && <p role="status">Consolidado indisponível: {consolidado.erro}</p>}
    <nav aria-label="Avaliações da matrícula" className="space-y-3">{r.dado.avaliacoes.map(a => <Link key={a.codigo} className="block rounded border p-3 underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(a.codigo)}`}>
      {a.titulo} — {a.etapa === "FINAL" ? "Final" : "Intermediária"}
    </Link>)}</nav>
    {!r.dado.avaliacoes.length && <EstadoVazio bloco>Nenhuma avaliação disponível para este acesso.</EstadoVazio>}
  </section>;
}
