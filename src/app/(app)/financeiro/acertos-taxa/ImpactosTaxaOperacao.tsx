"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { completarImpactosTaxaAditivo, decidirImpactosTaxaAditivo, obsoletarImpactosTaxaAditivo, vincularImpactoTaxaAditivo } from "@/server/contratos/aditivo-taxa-impactos";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { formatarMoeda } from "@/lib/dinheiro";
import { STATUS_COBRANCA_LABEL, rotular, STATUS_CONJUNTO_IMPACTOS_TAXA_ADITIVO_LABEL, DECISAO_IMPACTO_TAXA_ADITIVO_LABEL, STATUS_PROPOSTA_ACERTO_TAXA_ADITIVO_LABEL } from "@/lib/labels";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";

type Impacto = { cobrancaId: string; cobranca: { id: string; codigo: string | null; moeda: string; valorNegociado: string; vencimento: string; status: string }; decisao: "AFETADA" | "PRESERVADA"; justificativa: string; propostaAcertoId: string | null; acertoStatus: string | null; aplicado: boolean };
type Acerto = { id: string; cobrancaId: string; codigo: string; moeda: string; valorNovo: string; vencimentoNovo: string; status: string };
type Conjunto = { id: string; status: string; podeVincular: boolean; podeDecidir: boolean; podeConcluir: boolean; podeObsoletar: boolean; pendencias: { afetadasSemVinculo: number; afetadasSemAplicacao: number }; impactos: Impacto[] };
export function ImpactosTaxaOperacao({ conjunto, acertos, reprepararHref }: { conjunto: Conjunto | null; acertos: Acerto[]; reprepararHref: string }) {
  // Decidir e obsoletar levam chave de idempotência estável; vincular e concluir devolvem o registro existente quando repetidos.
  // Na falha de transporte, reenviar a mesma operação confere o resultado.
  const router = useRouter(); const [motivo, setMotivo] = useState(""); const [selecoes, setSelecoes] = useState<Record<string, string>>({}); const acao = useAcaoCliente({ idempotente: true }); const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  const ocupado = acao.ocupado;
  async function executar(operacao: "aprovar" | "rejeitar" | "concluir" | "vincular" | "obsoletar", cobrancaId?: string) {
    const propostaAcertoId = cobrancaId ? selecoes[cobrancaId] : undefined;
    if (ocupado || (operacao !== "concluir" && operacao !== "vincular" && motivo.trim().length < 5) || (operacao === "vincular" && !propostaAcertoId) || !conjunto) return;
    const entrada = JSON.stringify({ operacao, conjuntoId: conjunto.id, cobrancaId, propostaAcertoId, motivo: motivo.trim() });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const conjuntoId = conjunto.id, chave = tentativa.current.chave;
    const d = await acao.executar<unknown>(() => operacao === "vincular" ? vincularImpactoTaxaAditivo({ conjuntoId, cobrancaId: cobrancaId!, propostaAcertoId: propostaAcertoId! }) : operacao === "concluir" ? completarImpactosTaxaAditivo({ conjuntoId }) : operacao === "obsoletar" ? obsoletarImpactosTaxaAditivo({ conjuntoId, motivo: motivo.trim(), chaveIdempotencia: chave }) : decidirImpactosTaxaAditivo({ conjuntoId, aprovada: operacao === "aprovar", motivo: motivo.trim(), chaveIdempotencia: chave }),
      operacao === "vincular" ? "Acerto vinculado à taxa afetada." : operacao === "concluir" ? "Conjunto completo registrado." : "Decisão do conjunto registrada.");
    if (d?.tipo === "ok") { tentativa.current = null; router.refresh(); }
  }
  if (!conjunto) return <section className="rounded border p-4"><h2 className="text-xl">Impactos de taxa</h2><p role="status">O conjunto ainda não foi preparado na proposta do aditivo.</p></section>;
  return <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Conjunto de impactos · {rotular(STATUS_CONJUNTO_IMPACTOS_TAXA_ADITIVO_LABEL, conjunto.status)}</h2>
    {conjunto.impactos.map(i => <article key={i.cobrancaId} className="rounded border p-3"><p className="font-medium">{i.cobranca.codigo ?? "Taxa sem código"} · {rotular(DECISAO_IMPACTO_TAXA_ADITIVO_LABEL, i.decisao)}</p><p>{formatarMoeda(i.cobranca.valorNegociado, i.cobranca.moeda)} · vencimento {formatarDataCivil(i.cobranca.vencimento)} · {rotular(STATUS_COBRANCA_LABEL, i.cobranca.status)}</p><p>{i.justificativa}</p>{i.decisao === "AFETADA" && <>{i.propostaAcertoId ? <p role="status">Acerto vinculado ({i.acertoStatus ? rotular(STATUS_PROPOSTA_ACERTO_TAXA_ADITIVO_LABEL, i.acertoStatus) : "sem estado"}){i.aplicado ? "; aplicação registrada." : "; aguardando aplicação."}</p> : conjunto.podeVincular ? <label className="block">Acerto desta cobrança<select className="ml-2 rounded border p-1" value={selecoes[i.cobrancaId] ?? ""} onChange={e => setSelecoes(s => ({ ...s, [i.cobrancaId]: e.target.value }))}><option value="">Selecione a proposta</option>{acertos.filter(a => a.cobrancaId === i.cobrancaId && ["PENDENTE", "APROVADA", "APLICADA"].includes(a.status)).map(a => <option key={a.id} value={a.id}>{a.codigo} · {formatarMoeda(a.valorNovo, a.moeda)} · {formatarDataCivil(a.vencimentoNovo)} · {rotular(STATUS_PROPOSTA_ACERTO_TAXA_ADITIVO_LABEL, a.status)}</option>)}</select><button className={`${botaoClasses({ variante: "secundario", tamanho: "sm" })} ml-2`} type="button" disabled={ocupado || !selecoes[i.cobrancaId]} onClick={() => executar("vincular", i.cobrancaId)}>Vincular acerto</button></label> : <p role="status">Acerto ainda não vinculado.</p>}</>}</article>)}
    {conjunto.pendencias.afetadasSemVinculo > 0 && <p role="alert">Há {conjunto.pendencias.afetadasSemVinculo} taxa(s) afetada(s) sem acerto vinculado; a aprovação permanece indisponível.</p>}
    {conjunto.pendencias.afetadasSemAplicacao > 0 && <p role="status">Há {conjunto.pendencias.afetadasSemAplicacao} taxa(s) afetada(s) sem aplicação; a conclusão permanece indisponível.</p>}
    {conjunto.podeDecidir && <label className="block">Motivo da decisão<CampoTexto className="mt-1 block w-full rounded border p-2" minLength={5} maxLength={2000} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>}
    {conjunto.podeDecidir && <><button className={botaoClasses()} type="button" disabled={ocupado || motivo.trim().length < 5 || conjunto.pendencias.afetadasSemVinculo > 0} onClick={() => executar("aprovar")}>Aprovar conjunto</button>{" "}<button className={botaoClasses({ variante: "perigo" })} type="button" disabled={ocupado || motivo.trim().length < 5} onClick={() => executar("rejeitar")}>Rejeitar conjunto</button></>}
    {conjunto.podeConcluir && <button className={botaoClasses()} type="button" disabled={ocupado || conjunto.pendencias.afetadasSemAplicacao > 0} onClick={() => executar("concluir")}>Concluir impactos aplicados</button>}
    {conjunto.podeObsoletar && <><label className="block">Motivo para reconstruir o conjunto<CampoTexto className="mt-1 block w-full rounded border p-2" minLength={5} maxLength={2000} value={motivo} onChange={e => setMotivo(e.target.value)} /></label><button className={botaoClasses({ variante: "perigo" })} type="button" disabled={ocupado || motivo.trim().length < 5} onClick={() => executar("obsoletar")}>{conjunto.status === "APROVADO" ? "Confirmar fotografia divergente" : "Descartar conjunto pendente para reconferir"}</button></>}
    {["REJEITADO", "OBSOLETO"].includes(conjunto.status) && <p role="status">Este conjunto preserva seu histórico e não pode ser reaberto. <Link className="underline" href={reprepararHref}>Reconferir todas as taxas e preparar novo conjunto</Link>.</p>}<FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </section>;
}
