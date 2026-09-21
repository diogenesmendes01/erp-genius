"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepararImpactosTaxaAditivo } from "@/server/contratos/aditivo-taxa-impactos";

type Cobranca = { id: string; codigo: string | null; moeda: string; valorNegociado: string; vencimento: string };

export function ImpactosTaxaFormulario({ matriculaId, propostaId, conclusaoId, revisaoHash, cobrancas }: { matriculaId: string; propostaId: string; conclusaoId: string; revisaoHash: string; cobrancas: Cobranca[] }) {
  const router = useRouter();
  const [decisoes, setDecisoes] = useState<Record<string, "AFETADA" | "PRESERVADA">>(() => Object.fromEntries(cobrancas.map(c => [c.id, "AFETADA"])));
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  const linhas = cobrancas.map(c => ({ cobrancaId: c.id, decisao: decisoes[c.id] ?? "AFETADA", justificativa: (justificativas[c.id] ?? "").trim() }));
  const podePreparar = linhas.length > 0 && linhas.every(l => l.justificativa.length >= 5);

  async function preparar() {
    if (ocupado || !podePreparar) return;
    const dados = { matriculaId, propostaId, conclusaoId, revisaoHash, linhas };
    const entrada = JSON.stringify(dados);
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    setOcupado(true); setMensagem("");
    try {
      const r = await prepararImpactosTaxaAditivo({ ...dados, chaveIdempotencia: tentativa.current.chave });
      if (!r.ok) { setMensagem(r.erro); return; }
      setMensagem("Conjunto preparado. O Financeiro deve vincular os acertos das taxas afetadas antes da aprovação independente.");
      tentativa.current = null; router.refresh();
    } catch { setMensagem("Não foi possível confirmar o preparo. Tente novamente com os mesmos dados."); }
    finally { setOcupado(false); }
  }

  return <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Impactos de todas as taxas</h2>
    <p>Classifique cada cobrança de taxa. Cobranças preservadas também exigem justificativa; a assinatura não altera valores sozinha.</p>
    {!cobrancas.length ? <p role="status">Nenhuma cobrança de taxa foi encontrada para esta matrícula.</p> : <fieldset disabled={ocupado} className="space-y-3">{cobrancas.map(c => <article className="space-y-2 rounded border p-3" key={c.id}>
      <p className="font-medium">{c.codigo ?? "Taxa sem código"} · {c.moeda} {c.valorNegociado} · vencimento {c.vencimento.slice(0, 10)}</p>
      <label className="block">Tratamento<select className="ml-2 rounded border p-1" value={decisoes[c.id] ?? "AFETADA"} onChange={e => setDecisoes(atual => ({ ...atual, [c.id]: e.target.value as "AFETADA" | "PRESERVADA" }))}><option value="AFETADA">Afetada pelo aditivo</option><option value="PRESERVADA">Preservada</option></select></label>
      <label className="block">Justificativa<textarea className="mt-1 block w-full rounded border p-2" minLength={5} maxLength={2000} value={justificativas[c.id] ?? ""} onChange={e => setJustificativas(atual => ({ ...atual, [c.id]: e.target.value }))} /></label>
    </article>)}</fieldset>}
    <button type="button" disabled={!podePreparar || ocupado} onClick={preparar}>{ocupado ? "Preparando…" : "Preparar conjunto de impactos"}</button>
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
