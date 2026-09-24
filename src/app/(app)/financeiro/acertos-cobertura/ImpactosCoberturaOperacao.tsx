"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { aplicarImpactosCoberturaAditivo, decidirImpactosCoberturaAditivo, obsoletarImpactosCoberturaAditivo } from "@/server/contratos/aditivo-cobertura";
import { MensagemStatus } from "@/components/MensagemStatus";

type Politica = { escolha: "PRESERVAR_REFERENCIA" } | { escolha: "MUDAR_REFERENCIA"; referencia: "MES_CIVIL" | "CICLO_MATRICULA"; dataReferencia: string };
type Conjunto = { id: string; status: string; politica: Politica; motivo: string; evidencia: string; decisao: { aprovada: boolean; motivo: string } | null; podeDecidir: boolean; podeAplicar: boolean; podeObsoletar: boolean; pendencias: { afetadasSemAplicacao: number }; impactos: { cobrancaId: string; classificacao: string; justificativa: string; aplicado: boolean; coberturaInicioAnterior: string | null; coberturaFimAnterior: string | null; coberturaInicioNova: string | null; coberturaFimNova: string | null; cobranca: { codigo: string | null; moeda: string; coberturaInicio: string | null; coberturaFim: string | null; vencimento: string; status: string } }[] };

function descreverPolitica(politica: Politica) {
  return politica.escolha === "PRESERVAR_REFERENCIA"
    ? "Preservar a referência contratual vigente para os ciclos futuros."
    : `Alterar a referência dos ciclos futuros para ${politica.referencia === "MES_CIVIL" ? "mês civil" : "ciclo mensal da matrícula"}, a partir de ${politica.dataReferencia}.`;
}

export function ImpactosCoberturaOperacao({ conjunto, reprepararHref }: { conjunto: Conjunto | null; reprepararHref: string }) {
  const router = useRouter(); const [motivo, setMotivo] = useState(""), [mensagem, setMensagem] = useState(""), [ocupado, setOcupado] = useState(false); const tentativa = useRef<{ operacao: string; motivo: string; chave: string } | null>(null);
  async function executar(operacao: "aprovar" | "rejeitar" | "aplicar" | "obsoletar") {
    if (!conjunto || ocupado || ((operacao === "aprovar" || operacao === "rejeitar" || operacao === "obsoletar") && motivo.trim().length < 5)) return;
    const entrada = `${operacao}:${motivo.trim()}`; if (tentativa.current?.operacao !== entrada) tentativa.current = { operacao: entrada, motivo: motivo.trim(), chave: crypto.randomUUID() };
    setOcupado(true); setMensagem("");
    try { const r = operacao === "aplicar" ? await aplicarImpactosCoberturaAditivo({ conjuntoId: conjunto.id, chaveIdempotencia: tentativa.current.chave }) : operacao === "obsoletar" ? await obsoletarImpactosCoberturaAditivo({ conjuntoId: conjunto.id, motivo: tentativa.current.motivo, chaveIdempotencia: tentativa.current.chave }) : await decidirImpactosCoberturaAditivo({ conjuntoId: conjunto.id, aprovada: operacao === "aprovar", motivo: tentativa.current.motivo, chaveIdempotencia: tentativa.current.chave }); if (!r.ok) { setMensagem(r.erro); return; } tentativa.current = null; setMensagem(operacao === "aplicar" ? "Coberturas aplicadas e conjunto completo." : operacao === "obsoletar" ? "Conjunto obsoleto preservado para reconferência." : "Decisão independente registrada."); router.refresh(); }
    catch { setMensagem("Não foi possível confirmar a operação. Repita a mesma tentativa para consultar o resultado."); } finally { setOcupado(false); }
  }
  if (!conjunto) return <section className="rounded border p-4"><h2 className="text-xl">Conjunto de cobertura</h2><p role="status">O conjunto ainda não foi preparado.</p></section>;
  return <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Conjunto de cobertura · {conjunto.status}</h2><p>Política formalizada no aditivo assinado: {descreverPolitica(conjunto.politica)}</p><p>Motivo do preparo: {conjunto.motivo}</p><p>Evidência da conferência: {conjunto.evidencia}</p>{conjunto.decisao && <p>Decisão registrada: {conjunto.decisao.aprovada ? "aprovada" : "rejeitada"}. Motivo: {conjunto.decisao.motivo}</p>}{conjunto.impactos.map(i => <article key={i.cobrancaId} className="rounded border p-3"><p className="font-medium">{i.cobranca.codigo ?? "Mensalidade sem código"} · {i.classificacao}</p><p>Cobertura anterior: {i.coberturaInicioAnterior ?? "não informada"} até {i.coberturaFimAnterior ?? "não informada"}. {i.classificacao === "AFETADA" && <>Resultado proposto: {i.coberturaInicioNova} até {i.coberturaFimNova}.</>}</p><p>{i.justificativa}</p><p role="status">{i.aplicado ? "Aplicação registrada." : i.classificacao === "AFETADA" ? "Aguardando aplicação." : "Preservada sem aplicação."}</p></article>)}
    {conjunto.pendencias.afetadasSemAplicacao > 0 && <p role="status">Há {conjunto.pendencias.afetadasSemAplicacao} mensalidade(s) afetada(s) sem aplicação.</p>}
    {(conjunto.podeDecidir || conjunto.podeObsoletar) && <label className="block">Motivo<textarea className="mt-1 block w-full rounded border p-2" minLength={5} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>}
    {conjunto.podeDecidir && <><button type="button" disabled={ocupado || motivo.trim().length < 5} onClick={() => executar("aprovar")}>Aprovar conjunto</button>{" "}<button type="button" disabled={ocupado || motivo.trim().length < 5} onClick={() => executar("rejeitar")}>Rejeitar conjunto</button></>}
    {conjunto.podeAplicar && <button type="button" disabled={ocupado} onClick={() => executar("aplicar")}>Aplicar coberturas aprovadas</button>}
    {conjunto.podeObsoletar && <button type="button" disabled={ocupado || motivo.trim().length < 5} onClick={() => executar("obsoletar")}>{conjunto.status === "APROVADO" ? "Confirmar divergência material" : "Descartar conjunto pendente"}</button>}
    {["REJEITADO", "OBSOLETO"].includes(conjunto.status) && <a className="underline" href={reprepararHref}>Reconferir mensalidades e preparar novo conjunto</a>}<MensagemStatus texto={mensagem} />
  </section>;
}
