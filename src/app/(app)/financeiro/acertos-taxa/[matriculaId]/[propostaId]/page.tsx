import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAcertoTaxaPorProposta, listarHistoricoAcertosTaxa } from "@/server/contratos/aditivo-acerto-taxa-consulta";
import { AcertoTaxaFormulario } from "@/app/(app)/matriculas/[id]/contrato/aditivos/AcertoTaxaFormulario";
import { DecisaoTaxa } from "../../DecisaoTaxa";
export default async function AcertoTaxaDetalhe({ params }: { params: Promise<{ matriculaId: string; propostaId: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO);
  const d = await params;
  const [previa, historico] = await Promise.all([consultarAcertoTaxaPorProposta(d), listarHistoricoAcertosTaxa(d)]);
  return <main className="space-y-5"><Link className="underline" href="/financeiro/acertos-taxa">Voltar aos acertos de taxa</Link><h1 className="text-2xl">Acerto da taxa · matrícula {d.matriculaId}</h1>
    {!previa.ok ? <p role="alert">{previa.erro}</p> : previa.dado?.estado === "PRONTA_PARA_SELECAO" ? <AcertoTaxaFormulario matriculaId={d.matriculaId} propostaAditivoId={d.propostaId} conclusaoId={previa.dado.conclusaoId} revisaoHash={previa.dado.revisaoHash} cobrancas={previa.dado.cobrancas} /> : <p>{previa.dado?.mensagem}</p>}
    <h2 className="text-xl">Histórico de propostas</h2>
    {!historico.ok ? <p role="alert">{historico.erro}</p> : <>{!historico.dado?.length && <p>Nenhum acerto proposto.</p>}{historico.dado?.map(p => <section className="space-y-3 rounded border p-4" key={p.id}>
      <h3 className="font-semibold">Cobrança {p.codigo} · {p.status}</h3><p>Preparado por {p.preparador} em {p.criadaEm}.</p><p className="whitespace-pre-wrap">{p.motivo}</p>
      <p>Novo valor: {p.moeda} {p.valorNovo} · Vencimento: {p.vencimentoNovo} · Crédito a reconhecer: {p.moeda} {p.creditoNovo}.</p>
      <dl className="grid gap-2 sm:grid-cols-2"><div><dt>Valor antes do acerto</dt><dd>{p.moeda} {p.anterior.valor ?? "Não informado"}</dd></div><div><dt>Vencimento anterior</dt><dd>{p.anterior.vencimento ?? "Não informado"}</dd></div><div><dt>Recebimentos conferidos</dt><dd>{p.moeda} {p.anterior.recebido ?? "Não informado"}</dd></div><div><dt>Liquidado com crédito</dt><dd>{p.moeda} {p.anterior.creditoLiquidado ?? "Não informado"}</dd></div><div><dt>Crédito já reconhecido</dt><dd>{p.moeda} {p.anterior.creditoOriginado ?? "Não informado"}</dd></div></dl><p className="whitespace-pre-wrap">Evidência: {p.evidencia}</p>
      {p.decisao && <p>{p.decisao.aprovada ? "Aprovado" : "Rejeitado"} por {p.decisao.autor} em {p.decisao.data}: {p.decisao.motivo}</p>}
      {p.aplicacao && <p>Aplicado por {p.aplicacao.autor} em {p.aplicacao.data}. Valor anterior: {p.moeda} {p.aplicacao.valorAnterior}.</p>}
      <DecisaoTaxa propostaId={p.id} podeDecidir={p.podeDecidir} podeAplicar={p.podeAplicar} />
    </section>)}</>}
  </main>;
}
