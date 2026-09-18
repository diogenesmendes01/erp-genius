import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAcertoTaxaPorProposta, listarHistoricoAcertosTaxa } from "@/server/contratos/aditivo-acerto-taxa-consulta";
import { AcertoTaxaFormulario } from "@/app/(app)/matriculas/[id]/contrato/aditivos/AcertoTaxaFormulario";
import { ImpactosTaxaFormulario } from "@/app/(app)/matriculas/[id]/contrato/aditivos/ImpactosTaxaFormulario";
import { DecisaoTaxa } from "../../DecisaoTaxa";
import { consultarImpactosTaxaAditivo } from "@/server/contratos/aditivo-taxa-impactos";
import { ImpactosTaxaOperacao } from "../../ImpactosTaxaOperacao";
export default async function AcertoTaxaDetalhe({ params }: { params: Promise<{ matriculaId: string; propostaId: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO); const d = await params;
  const [previa, historico, impactos] = await Promise.all([consultarAcertoTaxaPorProposta(d), listarHistoricoAcertosTaxa(d), consultarImpactosTaxaAditivo(d.propostaId)]);
  return <main className="space-y-5"><Link className="underline" href="/financeiro/acertos-taxa">Voltar aos acertos de taxa</Link><h1 className="text-2xl">Acerto da taxa · matrícula {d.matriculaId}</h1>
    {!previa.ok ? <p role="alert">{previa.erro}</p> : previa.dado?.estado === "PRONTA_PARA_SELECAO" ? <><ImpactosTaxaFormulario matriculaId={d.matriculaId} propostaId={d.propostaId} conclusaoId={previa.dado.conclusaoId} revisaoHash={previa.dado.revisaoHash} cobrancas={previa.dado.cobrancas} /><AcertoTaxaFormulario matriculaId={d.matriculaId} propostaAditivoId={d.propostaId} conclusaoId={previa.dado.conclusaoId} revisaoHash={previa.dado.revisaoHash} cobrancas={previa.dado.cobrancas} /></> : <p>{previa.dado?.mensagem}</p>}
    <ImpactosTaxaOperacao conjunto={impactos.ok ? impactos.dado ?? null : null} acertos={historico.ok ? (historico.dado ?? []).map(p => ({ id: p.id, cobrancaId: p.cobrancaId, codigo: p.codigo, moeda: p.moeda, valorNovo: p.valorNovo, vencimentoNovo: p.vencimentoNovo, status: p.status })) : []} reprepararHref={`/matriculas/${encodeURIComponent(d.matriculaId)}/contrato/aditivos/${encodeURIComponent(d.propostaId)}`} />
    <h2 className="text-xl">Histórico de propostas</h2>{!historico.ok ? <p role="alert">{historico.erro}</p> : historico.dado?.map(p => <section className="space-y-3 rounded border p-4" key={p.id}><h3 className="font-semibold">Cobrança {p.codigo} · {p.status}</h3><p>Novo valor: {p.moeda} {p.valorNovo} · Crédito: {p.moeda} {p.creditoNovo}</p>
      <dl className="grid gap-2 sm:grid-cols-2"><div><dt>Valor antes</dt><dd>{p.moeda} {p.anterior.valor ?? "Não informado"}</dd></div><div><dt>Recebido</dt><dd>{p.moeda} {p.anterior.recebido ?? "Não informado"}</dd></div></dl>
      {p.comissoes.length > 0 && <div><h4 className="font-medium">Impacto nas comissões</h4><table><thead><tr><th>Tipo</th><th>Status</th><th>Antes</th><th>Depois</th></tr></thead><tbody>{p.comissoes.map(c => <tr key={c.id}><td>{c.tipo}{c.preservada ? " (preservada)" : ""}</td><td>{c.status}</td><td>{p.moeda} {c.valorAntes ?? "—"}</td><td>{p.moeda} {c.valorDepois ?? "—"}</td></tr>)}</tbody></table></div>}
      <p className="whitespace-pre-wrap">Evidência: {p.evidencia}</p>{p.invalidacao && <p>Invalidado por {p.invalidacao.autor}: {p.invalidacao.motivo}</p>}<DecisaoTaxa propostaId={p.id} podeDecidir={p.podeDecidir} podeAplicar={p.podeAplicar} podeInvalidar={p.podeInvalidar} /></section>)}</main>;
}
