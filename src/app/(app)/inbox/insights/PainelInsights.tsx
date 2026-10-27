"use client";

import type { ReactNode } from "react";
import type { RetomadaInsight } from "./useGeracaoInsight";
import { IconRefresh, IconSparkles } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { MensagemStatus } from "@/components/MensagemStatus";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { TEMPERATURA_LABEL, SENTIMENTO_INSIGHT_LABEL, rotular } from "@/lib/labels";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import type { InsightPainel } from "@/server/aria/insights/dto";
import type { Resultado } from "@/server/_shared/resultado";
import { useGeracaoInsight, type PortaGeracaoInsight } from "./useGeracaoInsight";
import { useRascunhoInsight } from "./useRascunhoInsight";

export interface PortaRascunhoInsight {
  textoAtual: string;
  revisao: string;
  podeUsar: boolean;
  usar: (pedido: { texto: string; geracaoId: string; revisaoEsperada: string }) => Promise<Resultado>;
}
export interface PropsPainelInsights extends Omit<PortaGeracaoInsight, "podeAtualizar"> {
  dados: InsightPainel;
  fuso: string | null;
  fusoEscola: string;
  rascunho: PortaRascunhoInsight;
  renderControles?:(controle:{bloqueado:boolean;retomar(i:RetomadaInsight):Promise<void>})=>ReactNode;
}

export function PainelInsights(props: PropsPainelInsights) {
  const { dados, fuso, fusoEscola, autorizado, ativo } = props;
  const geracao = useGeracaoInsight({ ...props, podeAtualizar: dados.podeAtualizar });
  const rascunho = useRascunhoInsight(props);
  if (!autorizado || !ativo) return null;
  const ultima = dados.ultima;
  const analise = ultima?.analise;
  const progresso = geracao.ocupado || dados.estado === "gerando" ? "Gerando Insights…" : null;
  return <section aria-label="Insights" className="space-y-4 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-medium"><IconSparkles size={16} aria-hidden/>Insights</h3>
      <Botao variante="iaFantasma" tamanho="sm" ocupado={geracao.ocupado} disabled={!dados.podeAtualizar || geracao.incerto || geracao.aguardandoLeitura} onClick={geracao.atualizar}><IconRefresh size={15} aria-hidden/>Atualizar</Botao>
    </div>
    <MensagemStatus texto={null} progresso={progresso}/>
    <FeedbackAcao erro={geracao.erro || rascunho.erro}/>
    <MensagemStatus texto={rascunho.sucesso}/>
    {rascunho.confirmacao}
    {props.renderControles?.({bloqueado:geracao.ocupado||geracao.aguardandoLeitura,retomar:geracao.retomar})}
    {dados.estado === "incerto" && <p className="text-sm text-gray-700">A análise inconclusiva pode ter gerado custo. Descartá-la e tentar novamente pode gerar novo custo.</p>}
    {dados.estado === "indisponivel" && <p className="text-sm text-gray-700">Geração indisponível no momento.</p>}
    {!ultima && <EstadoVazio>Nenhum Insight gerado ainda.</EstadoVazio>}
    {ultima && analise && <>
      {ultima.simulada && <p className="text-xs font-medium text-ai-700">Demonstração simulada</p>}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-surface-muted p-3"><dt className="text-xs text-gray-600">Temperatura</dt><dd className="text-sm font-medium">{analise.temperatura ? rotular(TEMPERATURA_LABEL, analise.temperatura) : "Não identificado"}</dd><dd className="text-xs text-gray-600">Estimativa da análise</dd></div>
        <div className="space-y-1 rounded-lg border border-gray-200 bg-surface-muted p-3"><dt className="text-xs text-gray-600">Chance de fechar</dt><dd className="text-sm font-medium">{analise.chanceFechar === null ? "Não identificado" : `${analise.chanceFechar}%`}</dd>{analise.chanceFechar !== null && <div role="meter" aria-label="Chance estimada de fechar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={analise.chanceFechar} aria-valuetext={`${analise.chanceFechar}%; estimativa da análise`} className="h-1 overflow-hidden rounded-full bg-gray-200"><div aria-hidden className="h-1 bg-brand-solid" style={{width:`${analise.chanceFechar}%`}}/></div>}</div>
        <div className="rounded-lg border border-gray-200 bg-surface-muted p-3"><dt className="text-xs text-gray-600">Sentimento</dt><dd className="text-sm font-medium">{analise.sentimento ? rotular(SENTIMENTO_INSIGHT_LABEL, analise.sentimento) : "Não identificado"}</dd></div>
        <div className="rounded-lg border border-gray-200 bg-surface-muted p-3"><dt className="text-xs text-gray-600">Melhor horário</dt><dd className="text-sm">{analise.melhorHorario ?? "Não identificado"}</dd></div>
      </dl>
      <section className="space-y-1"><h4 className="text-xs font-medium text-gray-600">Intenção detectada</h4><p className="text-sm">{analise.intencao ?? "Não identificado"}</p></section>
      <section className="space-y-2"><h4 className="text-xs font-medium text-gray-600">Sinais de compra</h4>{analise.sinais.length ? <ul className="list-inside list-disc space-y-1 text-sm">{analise.sinais.map((sinal, i) => <li key={i}>{sinal}</li>)}</ul> : <EstadoVazio>Nenhum sinal de compra identificado.</EstadoVazio>}</section>
      <section className="space-y-2"><h4 className="text-xs font-medium text-gray-600">Objeções e riscos</h4>{analise.riscos.length ? <ul className="list-inside list-disc space-y-1 text-sm">{analise.riscos.map((risco, i) => <li key={i}>{risco}</li>)}</ul> : <EstadoVazio>Nenhuma objeção ou risco identificado.</EstadoVazio>}</section>
      <section className="space-y-2 rounded-lg border border-ai-200 bg-ai-50 p-3"><h4 className="text-xs font-medium text-ai-700">Próximo melhor passo</h4><p className="text-sm font-medium">{analise.proximoPasso ?? "Não identificado"}</p>{analise.textoSugerido && <div className="space-y-2"><p className="whitespace-pre-wrap rounded-md border border-gray-200 bg-surface p-3 text-sm">{analise.textoSugerido}</p><Botao variante="ia" tamanho="sm" ocupado={rascunho.ocupado} disabled={!props.rascunho.podeUsar} onClick={rascunho.pedirUso}>Usar como rascunho</Botao></div>}</section>
      <p className="text-xs text-gray-600">Gerado em {formatarInstanteExibicao(ultima.geradoEm, fuso, fusoEscola).texto}</p>
      {dados.novasMensagens > 0 && <p className="text-xs text-gray-700">{dados.novasMensagens} novas mensagens ainda não analisadas</p>}
      {dados.contextoAlterado && <p className="text-xs text-gray-700">O contexto mudou desde a análise.</p>}
    </>}
  </section>;
}
