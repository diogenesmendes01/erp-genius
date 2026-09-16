import Link from "next/link";
import { STATUS_COBRANCA_LABEL, TIPO_COBRANCA_LABEL } from "@/lib/labels";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCancelamentoFinanceiroDesistencia } from "@/server/matricula/desistencia-financeiro-consulta";
import { PropostaFormulario, DecisaoFormulario } from "./Formularios";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { id } = await params;
  const resultado = await consultarCancelamentoFinanceiroDesistencia({ matriculaId: id });
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
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
      <p className="whitespace-pre-wrap">{p.motivo}</p><p className="whitespace-pre-wrap">{p.evidenciaCondicoes}</p>
      {p.decisao && <p>{p.decisao.aprovada ? "Aprovada" : "Rejeitada"} por {p.decisao.decisorNome}: {p.decisao.motivo}</p>}
      {p.podeDecidir && <DecisaoFormulario propostaId={p.id} propostaHash={p.propostaHash} podeAprovar={p.podeAprovar} />}
    </article>)}
    {d.propostas.length === 20 && <p>São exibidas as vinte propostas mais recentes.</p>}
  </section>;
}
