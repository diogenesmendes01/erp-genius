import Link from "next/link";
import { STATUS_COBRANCA_LABEL, TIPO_COBRANCA_LABEL } from "@/lib/labels";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCancelamentoFinanceiroDesistencia } from "@/server/matricula/desistencia-financeiro-consulta";
import { PropostaFormulario, DecisaoFormulario } from "./Formularios";
import { consultarAcertoDesistenciaContratual } from "@/server/matricula/desistencia-acerto-consulta";
import { consultarReconferenciaDeltaDesistencia } from "@/server/matricula/desistencia-reconferencia-delta-consulta";
import { AplicarAcertoContratualFormulario, DecidirAcertoContratualFormulario, PrepararAcertoContratualFormulario } from "./AcertoContratualFormularios";
import { AplicarReconferenciaDeltaFormulario, DecidirReconferenciaDeltaFormulario, PrepararReconferenciaDeltaFormulario } from "./ReconferenciaDeltaFormularios";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { id } = await params;
  const [resultado, acertoResultado, deltaResultado, preferencia] = await Promise.all([
    consultarCancelamentoFinanceiroDesistencia({ matriculaId: id }),
    consultarAcertoDesistenciaContratual({ matriculaId: id }),
    consultarReconferenciaDeltaDesistencia({ matriculaId: id }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const instanteAdministrativo = (valor: Date | string) => formatarInstanteExibicao(valor, fusoExibicao, "UTC").texto;
  return <section className="space-y-5">
    <Link className="underline" href="/financeiro/desistencias">Voltar aos pedidos de desistência</Link>
    <h1 className="text-2xl font-medium">Conferência financeira da desistência · {d.matricula.codigo ?? "Matrícula"}</h1>
    <p>Proposta, aprovação e efetivação são etapas distintas. A aprovação financeira autoriza o tratamento descrito; a Secretaria ainda precisa conferir e efetivar a desistência.</p>
    {d.impedimento && <p role="status">{d.impedimento}</p>}
    <div className="overflow-x-auto"><table className="w-full text-left"><caption className="text-left font-medium">Cobranças desta matrícula</caption>
      <thead><tr><th>Tipo / situação</th><th>Vencimento</th><th>Original</th><th>Contratado</th><th>Saldo histórico</th></tr></thead>
      <tbody>{d.cobrancas.map(c => <tr key={c.id}><td>{TIPO_COBRANCA_LABEL[c.tipo]} · {STATUS_COBRANCA_LABEL[c.status]}</td><td>{c.vencimento.slice(0,10)}</td><td>{c.moeda} {c.valorOriginal}</td><td>{c.moeda} {c.valorNegociado}</td><td>{c.moeda} {c.saldo ?? "A conferir"}</td></tr>)}</tbody>
    </table></div>
    {d.podePropor && d.pedido && <PropostaFormulario key={d.pedido.estadoHash} pedidoId={d.pedido.id} estadoHash={d.pedido.estadoHash} />}
    <h2 className="text-lg font-medium">Últimas propostas financeiras</h2>
    {!d.propostas.length && <p>Nenhuma proposta registrada.</p>}
    {d.propostas.map(p => <article key={p.id} className="space-y-3 rounded border p-4">
      <h3 className="font-medium">Versão {p.versao} · {p.preparadorNome}</h3>
      <p>Preparada em {instanteAdministrativo(p.criadaEmISO)} ({fusoExibicao}; origem UTC).</p>
      <p className="whitespace-pre-wrap">{p.motivo}</p><p className="whitespace-pre-wrap">{p.evidenciaCondicoes}</p>
      {p.decisao && <p>{p.decisao.aprovada ? "Aprovada" : "Rejeitada"} por {p.decisao.decisorNome}, em {instanteAdministrativo(p.decisao.decididaEmISO)} ({fusoExibicao}; origem UTC): {p.decisao.motivo}</p>}
      {p.podeDecidir && <DecisaoFormulario propostaId={p.id} propostaHash={p.propostaHash} podeAprovar={p.podeAprovar} />}
    </article>)}
    {d.propostas.length === 20 && <p>São exibidas as vinte propostas mais recentes.</p>}
    <section className="space-y-4 border-t pt-5">
      <h2 className="text-xl font-medium">Acerto contratual antes da efetivação</h2>
      <p>Use a regra da versão contratual vigente para preparar a memória. Depois da aprovação financeira independente, a Administração decide a desistência; só então o Financeiro aplica os valores e a Secretaria efetiva.</p>
      {!acertoResultado.ok || !acertoResultado.dado ? <p role="alert">{acertoResultado.ok ? "Consulta do acerto indisponível." : acertoResultado.erro}</p> : (() => {
        const acerto = acertoResultado.dado;
        return <>
          {acerto.impedimento && <p role="status">{acerto.impedimento}</p>}
          {acerto.podePreparar && acerto.pedido && acerto.condicoes && <PrepararAcertoContratualFormulario pedidoId={acerto.pedido.id} condicoesId={acerto.condicoes.id} reapresentacao={acerto.reapresentacao} />}
          {!acerto.propostas.length && <p>Nenhuma memória contratual preparada.</p>}
          {acerto.propostas.map(proposta => <article key={proposta.id} className="space-y-3 rounded border p-4">
            <h3 className="font-medium">Memória versão {proposta.versao} de {proposta.preparadorNome} · {instanteAdministrativo(proposta.criadaEmISO)} ({fusoExibicao}; origem UTC)</h3>
            {proposta.anteriorId && <p>Reapresentada da versão anterior: {proposta.motivoReapresentacao}</p>}
            <table className="w-full text-left text-sm"><thead><tr><th>Cobrança</th><th>Devido</th><th>Saldo</th><th>Crédito</th></tr></thead><tbody>{proposta.itens.map(item => <tr key={item.cobrancaId}><td>{item.cobrancaId}</td><td>{item.moeda} {item.devido}</td><td>{item.moeda} {item.saldoDevido}</td><td>{item.moeda} {item.creditoApurado}</td></tr>)}</tbody></table>
            {!proposta.decisao && proposta.podeDecidir && <DecidirAcertoContratualFormulario propostaId={proposta.id} fotografiaHash={proposta.fotografiaHash} />}
            {proposta.decisao && <p>{proposta.decisao.aprovada ? "Aprovada" : "Rejeitada"} por {proposta.decisao.decisorNome}: {proposta.decisao.motivo}</p>}
            {proposta.decisao?.aprovada && !proposta.decisao.aplicacao && !proposta.podeAplicar && <p role="status">A aplicação aguarda decisão administrativa aprovada para este pedido e a alçada da pessoa que aprovou a memória.</p>}
            {proposta.podeAplicar && proposta.decisao && <AplicarAcertoContratualFormulario decisaoId={proposta.decisao.id} />}
            {proposta.decisao?.aplicacao && <div><p>Acerto aplicado em {instanteAdministrativo(proposta.decisao.aplicacao.criadaEmISO)} ({fusoExibicao}; origem UTC). A Secretaria pode efetivar a desistência.</p>{proposta.decisao.aplicacao.creditos.length > 0 && <p>Créditos gerados: {proposta.decisao.aplicacao.creditos.map((creditoId, indice) => <span key={creditoId}>{indice > 0 && ", "}<Link className="underline" href={`/alunos/${acerto.matricula.alunoId}/creditos/${creditoId}`}>consultar crédito</Link></span>)}</p>}</div>}
          </article>)}
          {acerto.temMaisPropostas && <p>São exibidas as vinte memórias contratuais mais recentes. Existem propostas anteriores preservadas no histórico.</p>}
        </>;
      })()}
    </section>
    <section className="space-y-4 border-t pt-5">
      <h2 className="text-xl font-medium">Reconferência pós-aplicação</h2>
      <p>Use este fluxo para um fato posterior à aplicação Q165. Ele calcula apenas a diferença e mantém recebimentos, créditos e origens anteriores preservados.</p>
      {!deltaResultado.ok || !deltaResultado.dado ? <p role="alert">{deltaResultado.ok ? "Consulta da reconferência indisponível." : deltaResultado.erro}</p> : (() => {
        const delta = deltaResultado.dado;
        return <>{delta.impedimento && <p role="status">{delta.impedimento}</p>}{delta.aplicacoesBase.map(base => <article key={base.id} className="space-y-3 rounded border p-4">
          <h3 className="font-medium">Aplicação Q165 de {instanteAdministrativo(base.criadaEmISO)} ({fusoExibicao}; origem UTC)</h3>
          {base.orientacaoPreparacao && <p role="status">{base.orientacaoPreparacao}</p>}
          {delta.podePreparar && base.podePreparar && <PrepararReconferenciaDeltaFormulario aplicacaoBaseId={base.id} />}
          {base.preparoBloqueadoPor && <p role="status">{base.preparoBloqueadoPor}</p>}
          {!base.propostas.length && <p>Nenhuma reconferência registrada.</p>}
          {base.propostas.map(proposta => <div key={proposta.id} className="space-y-3 border-t pt-3"><h4>Delta {proposta.versao} · {proposta.preparadorNome} · {proposta.estado}</h4><p>Preparada em {instanteAdministrativo(proposta.criadaEmISO)} ({fusoExibicao}; origem UTC).</p>
            {proposta.pendencia && <p role="status">{proposta.pendencia}</p>}
            <table className="w-full text-left text-sm"><thead><tr><th>Cobrança</th><th>Ajuste devido</th><th>Ajuste saldo</th><th>Crédito novo</th><th>Redução bloqueada</th></tr></thead><tbody>{proposta.itens.map(item => <tr key={item.cobrancaId}><td>{item.cobrancaId}</td><td>{item.moeda} {item.ajusteDevido}</td><td>{item.moeda} {item.ajusteSaldo}</td><td>{item.moeda} {item.creditoDelta}</td><td>{item.moeda} {item.reducaoCredito}</td></tr>)}</tbody></table>
            {proposta.creditosExternos.length > 0 && <table className="w-full text-left text-sm"><caption className="text-left font-medium">Créditos externos preservados nesta fotografia</caption><thead><tr><th>Crédito</th><th>Moeda</th><th>Saldo disponível</th></tr></thead><tbody>{proposta.creditosExternos.map(credito => <tr key={credito.id}><td>{credito.id}</td><td>{credito.moeda}</td><td>{credito.saldoDisponivel}</td></tr>)}</tbody></table>}
            {proposta.podeDecidirFinanceiro && <DecidirReconferenciaDeltaFormulario propostaId={proposta.id} fotografiaHash={proposta.fotografiaHash} administrativo={false} />}
            {proposta.podeDecidirAdministrativo && <DecidirReconferenciaDeltaFormulario propostaId={proposta.id} fotografiaHash={proposta.fotografiaHash} administrativo />}
            {proposta.decisaoFinanceira && <p>Decisão financeira: {proposta.decisaoFinanceira.aprovada ? "aprovada" : "rejeitada"} por {proposta.decisaoFinanceira.decisorNome}: {proposta.decisaoFinanceira.motivo}</p>}
            {proposta.decisaoAdministrativa && <p>Decisão administrativa: {proposta.decisaoAdministrativa.aprovada ? "aprovada" : "rejeitada"} por {proposta.decisaoAdministrativa.decisorNome}: {proposta.decisaoAdministrativa.motivo}</p>}
            {proposta.podeAplicar && proposta.decisaoFinanceira && <AplicarReconferenciaDeltaFormulario decisaoFinanceiraId={proposta.decisaoFinanceira.id} />}
            {proposta.aplicacao && <p>Reconferência aplicada em {instanteAdministrativo(proposta.aplicacao.criadaEmISO)} ({fusoExibicao}; origem UTC).</p>}
          </div>)}</article>)}</>;
      })()}
    </section>
  </section>;
}
