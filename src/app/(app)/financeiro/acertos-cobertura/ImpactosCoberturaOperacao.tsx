"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { aplicarImpactosCoberturaAditivo, decidirImpactosCoberturaAditivo, obsoletarImpactosCoberturaAditivo } from "@/server/contratos/aditivo-cobertura";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
import { STATUS_CONJUNTO_IMPACTOS_COBERTURA_ADITIVO_LABEL, CLASSIFICACAO_IMPACTO_COBERTURA_ADITIVO_LABEL, rotular } from "@/lib/labels";

type Politica = { escolha: "PRESERVAR_REFERENCIA" } | { escolha: "MUDAR_REFERENCIA"; referencia: "MES_CIVIL" | "CICLO_MATRICULA"; dataReferencia: string };
type Conjunto = { id: string; status: string; politica: Politica; motivo: string; evidencia: string; decisao: { aprovada: boolean; motivo: string } | null; podeDecidir: boolean; podeAplicar: boolean; podeObsoletar: boolean; pendencias: { afetadasSemAplicacao: number }; impactos: { cobrancaId: string; classificacao: string; justificativa: string; aplicado: boolean; coberturaInicioAnterior: string | null; coberturaFimAnterior: string | null; coberturaInicioNova: string | null; coberturaFimNova: string | null; cobranca: { codigo: string | null; moeda: string; coberturaInicio: string | null; coberturaFim: string | null; vencimento: string; status: string } }[] };

function descreverPolitica(politica: Politica) {
  return politica.escolha === "PRESERVAR_REFERENCIA"
    ? "Preservar a referência contratual vigente para os ciclos futuros."
    : `Alterar a referência dos ciclos futuros para ${politica.referencia === "MES_CIVIL" ? "mês civil" : "ciclo mensal da matrícula"}, a partir de ${formatarDataCivil(politica.dataReferencia)}.`;
}

export function ImpactosCoberturaOperacao({ conjunto, reprepararHref }: { conjunto: Conjunto | null; reprepararHref: string }) {
  // As três actions recebem chave de idempotência estável: na falha de transporte, reenviar a mesma operação confere o resultado.
  const router = useRouter(); const [motivo, setMotivo] = useState(""); const acao = useAcaoCliente({ idempotente: true }); const tentativa = useRef<{ operacao: string; motivo: string; chave: string } | null>(null);
  const ocupado = acao.ocupado;
  async function executar(operacao: "aprovar" | "rejeitar" | "aplicar" | "obsoletar") {
    if (!conjunto || ocupado || ((operacao === "aprovar" || operacao === "rejeitar" || operacao === "obsoletar") && motivo.trim().length < 5)) return;
    const entrada = `${operacao}:${motivo.trim()}`; if (tentativa.current?.operacao !== entrada) tentativa.current = { operacao: entrada, motivo: motivo.trim(), chave: crypto.randomUUID() };
    const conjuntoId = conjunto.id, { motivo: motivoEnviado, chave } = tentativa.current;
    const d = await acao.executar<unknown>(() => operacao === "aplicar" ? aplicarImpactosCoberturaAditivo({ conjuntoId, chaveIdempotencia: chave }) : operacao === "obsoletar" ? obsoletarImpactosCoberturaAditivo({ conjuntoId, motivo: motivoEnviado, chaveIdempotencia: chave }) : decidirImpactosCoberturaAditivo({ conjuntoId, aprovada: operacao === "aprovar", motivo: motivoEnviado, chaveIdempotencia: chave }), operacao === "aplicar" ? "Coberturas aplicadas e conjunto completo." : operacao === "obsoletar" ? "Conjunto obsoleto preservado para reconferência." : "Decisão independente registrada.");
    if (d?.tipo === "ok") { tentativa.current = null; router.refresh(); }
  }
  if (!conjunto) return <section className="rounded border p-4"><h2 className="text-xl">Conjunto de cobertura</h2><p role="status">O conjunto ainda não foi preparado.</p></section>;
  return <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Conjunto de cobertura · {rotular(STATUS_CONJUNTO_IMPACTOS_COBERTURA_ADITIVO_LABEL, conjunto.status)}</h2><p>Política formalizada no aditivo assinado: {descreverPolitica(conjunto.politica)}</p><p>Motivo do preparo: {conjunto.motivo}</p><p>Evidência da conferência: {conjunto.evidencia}</p>{conjunto.decisao && <p>Decisão registrada: {conjunto.decisao.aprovada ? "aprovada" : "rejeitada"}. Motivo: {conjunto.decisao.motivo}</p>}{conjunto.impactos.map(i => <article key={i.cobrancaId} className="rounded border p-3"><p className="font-medium">{i.cobranca.codigo ?? "Mensalidade sem código"} · {rotular(CLASSIFICACAO_IMPACTO_COBERTURA_ADITIVO_LABEL, i.classificacao)}</p><p>Cobertura anterior: {formatarDataCivil(i.coberturaInicioAnterior, "não informada")} até {formatarDataCivil(i.coberturaFimAnterior, "não informada")}. {i.classificacao === "AFETADA" && <>Resultado proposto: {formatarDataCivil(i.coberturaInicioNova)} até {formatarDataCivil(i.coberturaFimNova)}.</>}</p><p>{i.justificativa}</p><p role="status">{i.aplicado ? "Aplicação registrada." : i.classificacao === "AFETADA" ? "Aguardando aplicação." : "Preservada sem aplicação."}</p></article>)}
    {conjunto.pendencias.afetadasSemAplicacao > 0 && <p role="status">Há {conjunto.pendencias.afetadasSemAplicacao} mensalidade(s) afetada(s) sem aplicação.</p>}
    {(conjunto.podeDecidir || conjunto.podeObsoletar) && <label className="block">Motivo<CampoTexto className="mt-1 block w-full rounded border p-2" minLength={5} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>}
    {conjunto.podeDecidir && <><button className={botaoClasses()} type="button" disabled={ocupado || motivo.trim().length < 5} onClick={() => executar("aprovar")}>Aprovar conjunto</button>{" "}<button className={botaoClasses({ variante: "perigo" })} type="button" disabled={ocupado || motivo.trim().length < 5} onClick={() => executar("rejeitar")}>Rejeitar conjunto</button></>}
    {conjunto.podeAplicar && <button className={botaoClasses()} type="button" disabled={ocupado} onClick={() => executar("aplicar")}>Aplicar coberturas aprovadas</button>}
    {conjunto.podeObsoletar && <button className={botaoClasses({ variante: "perigo" })} type="button" disabled={ocupado || motivo.trim().length < 5} onClick={() => executar("obsoletar")}>{conjunto.status === "APROVADO" ? "Confirmar divergência material" : "Descartar conjunto pendente"}</button>}
    {["REJEITADO", "OBSOLETO"].includes(conjunto.status) && <a className="underline" href={reprepararHref}>Reconferir mensalidades e preparar novo conjunto</a>}<FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </section>;
}
