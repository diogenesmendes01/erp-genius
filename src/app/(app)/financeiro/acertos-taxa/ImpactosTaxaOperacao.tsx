"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completarImpactosTaxaAditivo, decidirImpactosTaxaAditivo, vincularImpactoTaxaAditivo } from "@/server/contratos/aditivo-taxa-impactos";

type Impacto = { cobrancaId: string; codigo: string | null; decisao: "AFETADA" | "PRESERVADA"; justificativa: string; aplicado: boolean };
type Acerto = { id: string; codigo: string; status: string };
export function ImpactosTaxaOperacao({ conjunto, acertos }: { conjunto: { id: string; status: string; impactos: Impacto[] } | null; acertos: Acerto[] }) {
  const router = useRouter(); const [motivo, setMotivo] = useState(""); const [selecoes, setSelecoes] = useState<Record<string, string>>({}); const [mensagem, setMensagem] = useState(""); const [ocupado, setOcupado] = useState(false); const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  async function executar(operacao: "aprovar" | "rejeitar" | "concluir" | "vincular", cobrancaId?: string) {
    const propostaAcertoId = cobrancaId ? selecoes[cobrancaId] : undefined;
    if (ocupado || (operacao !== "concluir" && operacao !== "vincular" && motivo.trim().length < 5) || (operacao === "vincular" && !propostaAcertoId) || !conjunto) return;
    const entrada = JSON.stringify({ operacao, conjuntoId: conjunto.id, cobrancaId, propostaAcertoId, motivo: motivo.trim() });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    setOcupado(true); setMensagem("");
    try {
      const r = operacao === "vincular" ? await vincularImpactoTaxaAditivo({ conjuntoId: conjunto.id, cobrancaId: cobrancaId!, propostaAcertoId: propostaAcertoId! }) : operacao === "concluir" ? await completarImpactosTaxaAditivo({ conjuntoId: conjunto.id }) : await decidirImpactosTaxaAditivo({ conjuntoId: conjunto.id, aprovada: operacao === "aprovar", motivo: motivo.trim(), chaveIdempotencia: tentativa.current.chave });
      if (!r.ok) { setMensagem(r.erro); return; }
      setMensagem(operacao === "vincular" ? "Acerto vinculado à taxa afetada." : operacao === "concluir" ? "Conjunto completo registrado." : "Decisão do conjunto registrada."); tentativa.current = null; router.refresh();
    } catch { setMensagem("Não foi possível confirmar a operação. Tente novamente para conferir a mesma tentativa."); }
    finally { setOcupado(false); }
  }
  if (!conjunto) return <section className="rounded border p-4"><h2 className="text-xl">Impactos de taxa</h2><p role="status">O conjunto ainda não foi preparado na proposta do aditivo.</p></section>;
  return <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Conjunto de impactos · {conjunto.status}</h2>
    {conjunto.impactos.map(i => <article key={i.cobrancaId} className="rounded border p-3"><p className="font-medium">{i.codigo ?? i.cobrancaId} · {i.decisao}</p><p>{i.justificativa}</p>{i.decisao === "AFETADA" && <>{i.aplicado ? <p role="status">Acerto aplicado e vinculado.</p> : <label className="block">Acerto aplicado para vincular<select className="ml-2 rounded border p-1" value={selecoes[i.cobrancaId] ?? ""} onChange={e => setSelecoes(s => ({ ...s, [i.cobrancaId]: e.target.value }))}><option value="">Selecione</option>{acertos.filter(a => a.codigo === (i.codigo ?? i.cobrancaId) && a.status === "APLICADA").map(a => <option key={a.id} value={a.id}>{a.id}</option>)}</select><button className="ml-2 rounded border px-2 py-1" type="button" disabled={ocupado || !selecoes[i.cobrancaId]} onClick={() => executar("vincular", i.cobrancaId)}>Vincular</button></label>}</>}</article>)}
    {conjunto.status === "PENDENTE" && <label className="block">Motivo da decisão<textarea className="mt-1 block w-full rounded border p-2" minLength={5} maxLength={2000} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>}
    {conjunto.status === "PENDENTE" && <><button type="button" disabled={ocupado || motivo.trim().length < 5} onClick={() => executar("aprovar")}>Aprovar conjunto</button>{" "}<button type="button" disabled={ocupado || motivo.trim().length < 5} onClick={() => executar("rejeitar")}>Rejeitar conjunto</button></>}
    {conjunto.status === "APROVADO" && <button type="button" disabled={ocupado} onClick={() => executar("concluir")}>Concluir impactos aplicados</button>}{mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
