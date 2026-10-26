import {faixaConfianca} from "@/server/inbox/atividade-aria-texto";
import {IconSparkles} from "@tabler/icons-react";
import {ACAO_AGENTE_IA_LABEL,ETAPA_LABEL,rotular} from "@/lib/labels";
import {formatarInstanteExibicao} from "@/server/operacao/fuso-exibicao";
import type {AriaNoContato} from "@/server/inbox/painel-atividade-aria";
export function ResumoAria({dado,fuso,fusoEscola}:{dado:AriaNoContato;fuso:string|null;fusoEscola:string}){
 const ultima=dado.ultimaAcao;
 const nivel=ultima?faixaConfianca(ultima.confianca,dado.faixa):null;
 const cor=nivel==="alta"?"bg-brand-solid":nivel==="media"?"bg-amber-600":"bg-danger";
 const confianca=nivel?(nivel==="alta"?"Confiança alta":nivel==="baixa"?"Confiança baixa":"Confiança média"):null;
 return <section aria-label="Aria neste contato" className="space-y-3 rounded-lg border border-ai-200 bg-ai-50 p-3">
  <h3 className="flex items-center gap-2 text-sm font-medium text-ai-700"><IconSparkles size={16} aria-hidden/>Aria neste contato</h3>
  {ultima?<div className="space-y-2"><p className="text-[13.5px] [overflow-wrap:anywhere]">{ultima.texto}</p><p className="font-mono text-[11px] text-gray-600">{formatarInstanteExibicao(ultima.em,fuso,fusoEscola).texto}</p><p className={"text-xs "+(nivel==="media"?"text-amber-700":"text-gray-700")}>{confianca} · <span className="font-mono tabular-nums">{ultima.confianca}%</span></p><div role="meter" aria-label="Confiança da última ação" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ultima.confianca} aria-valuetext={`${confianca}; alta a partir de ${dado.faixa.executaAPartirDe}%; baixa abaixo de ${dado.faixa.transfereAbaixoDe}%`} className="h-1 w-full overflow-hidden rounded-full bg-gray-200"><div aria-hidden className={"h-1 "+cor} style={{width:`${ultima.confianca}%`}}/></div></div>:<p className="text-xs text-gray-600">Aria ainda não atuou neste contato.</p>}
  <div className="space-y-1 text-xs text-gray-700"><p className="[overflow-wrap:anywhere]">Automático{dado.etapa?" em "+rotular(ETAPA_LABEL,dado.etapa):""}: {dado.automatico.map(a=>rotular(ACAO_AGENTE_IA_LABEL,a)).join(", ")||"nenhuma"}</p><p className="[overflow-wrap:anywhere]">Com aprovação: {dado.comAprovacao.map(a=>rotular(ACAO_AGENTE_IA_LABEL,a)).join(", ")||"nenhuma"}</p></div>
 </section>;
}