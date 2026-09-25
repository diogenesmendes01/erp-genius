"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepararImpactosCoberturaAditivo } from "@/server/contratos/aditivo-cobertura";
import { MensagemStatus } from "@/components/MensagemStatus";
import { formatarDataCivil } from "@/lib/data-civil";

type Cobranca = { id: string; codigo: string | null; moeda: string; vencimento: string; coberturaInicio: string | null; coberturaFim: string | null };
type Politica = { escolha: "PRESERVAR_REFERENCIA" } | { escolha: "MUDAR_REFERENCIA"; referencia: "MES_CIVIL" | "CICLO_MATRICULA"; dataReferencia: string };

function descreverPolitica(politica: Politica) {
  return politica.escolha === "PRESERVAR_REFERENCIA"
    ? "Preservar a referência contratual vigente para os ciclos futuros."
    : `Alterar a referência dos ciclos futuros para ${politica.referencia === "MES_CIVIL" ? "mês civil" : "ciclo mensal da matrícula"}, a partir de ${formatarDataCivil(politica.dataReferencia)}.`;
}

export function ImpactosCoberturaFormulario({ matriculaId, propostaId, conclusaoId, revisaoHash, politica, cobrancas }: { matriculaId: string; propostaId: string; conclusaoId: string; revisaoHash: string; politica: Politica; cobrancas: Cobranca[] }) {
  const router = useRouter();
  const [classificacoes, setClassificacoes] = useState<Record<string, "AFETADA" | "PRESERVADA">>(() => Object.fromEntries(cobrancas.map(c => [c.id, "AFETADA"])));
  const [limites, setLimites] = useState<Record<string, { inicio: string; fim: string }>>({});
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState(""), [evidencia, setEvidencia] = useState(""), [mensagem, setMensagem] = useState(""), [ocupado, setOcupado] = useState(false);
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  const linhas = cobrancas.map(c => ({ cobrancaId: c.id, classificacao: classificacoes[c.id] ?? "AFETADA", coberturaInicioNova: limites[c.id]?.inicio || undefined, coberturaFimNova: limites[c.id]?.fim || undefined, justificativa: (justificativas[c.id] ?? "").trim() }));
  const podePreparar = linhas.length > 0 && motivo.trim().length >= 5 && evidencia.trim().length >= 5 && linhas.every(l => l.justificativa.length >= 5 && (l.classificacao === "PRESERVADA" || (!!l.coberturaInicioNova && !!l.coberturaFimNova && l.coberturaInicioNova <= l.coberturaFimNova)));
  async function preparar() {
    if (!podePreparar || ocupado) return;
    const dados = { matriculaId, propostaId, conclusaoId, revisaoHash, linhas, motivo: motivo.trim(), evidencia: evidencia.trim() }, entrada = JSON.stringify(dados);
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    setOcupado(true); setMensagem("");
    try { const r = await prepararImpactosCoberturaAditivo({ ...dados, chaveIdempotencia: tentativa.current.chave }); if (!r.ok) { setMensagem(r.erro); return; } tentativa.current = null; setMensagem("Conjunto de cobertura preparado para aprovação independente."); router.refresh(); }
    catch { setMensagem("Não foi possível confirmar o preparo. Repita a mesma tentativa para consultar o resultado."); }
    finally { setOcupado(false); }
  }
  return <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Impactos de cobertura das mensalidades</h2><p>Política formalizada no aditivo assinado: {descreverPolitica(politica)}</p><p>Classifique todas as mensalidades. Para cada afetada, informe os limites corrigidos; uma preservada não recebe novos limites.</p>
    {!cobrancas.length ? <p role="status">Nenhuma mensalidade existe nesta matrícula.</p> : cobrancas.map(c => { const afetada = (classificacoes[c.id] ?? "AFETADA") === "AFETADA"; return <article className="space-y-2 rounded border p-3" key={c.id}><p className="font-medium">{c.codigo ?? "Mensalidade sem código"} · {c.moeda} · vencimento {formatarDataCivil(c.vencimento)}</p><p>Cobertura atual: {c.coberturaInicio ?? "não informada"} até {c.coberturaFim ?? "não informada"}.</p><label>Tratamento <select className="ml-2 rounded border p-1" value={classificacoes[c.id] ?? "AFETADA"} onChange={e => setClassificacoes(a => ({ ...a, [c.id]: e.target.value as "AFETADA" | "PRESERVADA" }))}><option value="AFETADA">Afetada pelo aditivo</option><option value="PRESERVADA">Preservada</option></select></label>{afetada && <div className="flex gap-2"><label>Início novo<input className="ml-2 rounded border p-1" type="date" value={limites[c.id]?.inicio ?? ""} onChange={e => setLimites(a => ({ ...a, [c.id]: { ...a[c.id], inicio: e.target.value } }))} /></label><label>Fim novo<input className="ml-2 rounded border p-1" type="date" value={limites[c.id]?.fim ?? ""} onChange={e => setLimites(a => ({ ...a, [c.id]: { ...a[c.id], fim: e.target.value } }))} /></label></div>}<label className="block">Justificativa<textarea className="mt-1 block w-full rounded border p-2" minLength={5} value={justificativas[c.id] ?? ""} onChange={e => setJustificativas(a => ({ ...a, [c.id]: e.target.value }))} /></label></article>; })}
    <label className="block">Motivo do conjunto<textarea className="mt-1 block w-full rounded border p-2" minLength={5} value={motivo} onChange={e => setMotivo(e.target.value)} /></label><label className="block">Evidência da conferência<textarea className="mt-1 block w-full rounded border p-2" minLength={5} value={evidencia} onChange={e => setEvidencia(e.target.value)} /></label><button type="button" disabled={ocupado || !podePreparar} onClick={preparar}>{ocupado ? "Preparando…" : "Preparar impactos de cobertura"}</button><MensagemStatus texto={mensagem} />
  </section>;
}
