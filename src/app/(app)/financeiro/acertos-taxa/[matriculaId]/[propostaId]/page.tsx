import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAcertoTaxaPorProposta, listarHistoricoAcertosTaxa } from "@/server/contratos/aditivo-acerto-taxa-consulta";
import { AcertoTaxaFormulario } from "@/app/(app)/matriculas/[id]/contrato/aditivos/AcertoTaxaFormulario";
import { ImpactosTaxaFormulario } from "@/app/(app)/matriculas/[id]/contrato/aditivos/ImpactosTaxaFormulario";
import { DecisaoTaxa } from "../../DecisaoTaxa";
import { consultarImpactosTaxaAditivo } from "@/server/contratos/aditivo-taxa-impactos";
import { ImpactosTaxaOperacao } from "../../ImpactosTaxaOperacao";
import { formatarMoeda } from "@/lib/dinheiro";
import { STATUS_COMISSAO_LABEL, rotular } from "@/lib/labels";
import { VoltarPara } from "@/components/VoltarPara";
export default async function AcertoTaxaDetalhe({ params }: { params: Promise<{ matriculaId: string; propostaId: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO); const d = await params;
  const [previa, historico, impactos] = await Promise.all([consultarAcertoTaxaPorProposta(d), listarHistoricoAcertosTaxa(d), consultarImpactosTaxaAditivo(d)]);
  const podePreparar = impactos.ok && (!impactos.dado || ["REJEITADO", "OBSOLETO"].includes(impactos.dado.status));
  return <main className="space-y-5"><VoltarPara href="/financeiro/acertos-taxa" /><h1 className="text-2xl">Acerto da taxa · matrícula {d.matriculaId}</h1>
    {!previa.ok ? <p role="alert">{previa.erro}</p> : previa.dado?.estado === "PRONTA_PARA_SELECAO" ? <>{podePreparar && <section id="preparar-impactos"><ImpactosTaxaFormulario matriculaId={d.matriculaId} propostaId={d.propostaId} conclusaoId={previa.dado.conclusaoId} revisaoHash={previa.dado.revisaoHash} cobrancas={previa.dado.cobrancas} /></section>}<AcertoTaxaFormulario matriculaId={d.matriculaId} propostaAditivoId={d.propostaId} conclusaoId={previa.dado.conclusaoId} revisaoHash={previa.dado.revisaoHash} cobrancas={previa.dado.cobrancas} /></> : <p>{previa.dado?.mensagem}</p>}
    {!impactos.ok && <p role="alert">{impactos.erro}</p>}
    {impactos.ok && <ImpactosTaxaOperacao conjunto={impactos.ok ? impactos.dado ?? null : null} acertos={historico.ok ? (historico.dado ?? []).map(p => ({ id: p.id, cobrancaId: p.cobrancaId, codigo: p.codigo, moeda: p.moeda, valorNovo: p.valorNovo, vencimentoNovo: p.vencimentoNovo, status: p.status })) : []} reprepararHref={`/financeiro/acertos-taxa/${encodeURIComponent(d.matriculaId)}/${encodeURIComponent(d.propostaId)}#preparar-impactos`} />}
    <h2 className="text-xl">Histórico de propostas</h2>{!historico.ok ? <p role="alert">{historico.erro}</p> : historico.dado?.map(p => <section className="space-y-3 rounded border p-4" key={p.id}><h3 className="font-medium">Cobrança {p.codigo} · {p.status}</h3><p>Novo valor: {formatarMoeda(p.valorNovo, p.moeda)} · Crédito: {formatarMoeda(p.creditoNovo, p.moeda)}</p>
      <dl className="grid gap-2 sm:grid-cols-2"><div><dt>Valor antes</dt><dd>{p.anterior.valor != null ? formatarMoeda(p.anterior.valor, p.moeda) : "Não informado"}</dd></div><div><dt>Recebido</dt><dd>{p.anterior.recebido != null ? formatarMoeda(p.anterior.recebido, p.moeda) : "Não informado"}</dd></div></dl>
      {p.comissoes.length > 0 && <div><h4 className="font-medium">Impacto nas comissões</h4><table><thead><tr><th>Tipo</th><th>Status</th><th>Antes</th><th>Depois</th></tr></thead><tbody>{p.comissoes.map(c => <tr key={c.id}><td>{c.tipo}{c.preservada ? " (preservada)" : ""}</td><td>{rotular(STATUS_COMISSAO_LABEL, c.status)}</td><td>{c.valorAntes != null ? formatarMoeda(c.valorAntes, p.moeda) : "—"}</td><td>{c.valorDepois != null ? formatarMoeda(c.valorDepois, p.moeda) : "—"}</td></tr>)}</tbody></table></div>}
      <p className="whitespace-pre-wrap">Evidência: {p.evidencia}</p>{p.invalidacao && <p>Invalidado por {p.invalidacao.autor}: {p.invalidacao.motivo}</p>}<DecisaoTaxa propostaId={p.id} podeDecidir={p.podeDecidir} podeAplicar={p.podeAplicar} podeInvalidar={p.podeInvalidar} /></section>)}</main>;
}
