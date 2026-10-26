"use client";
import {IconNote} from "@tabler/icons-react";
import {EstadoVazio} from "@/components/EstadoVazio";
import {formatarInstanteExibicao} from "@/server/operacao/fuso-exibicao";
import type {AtividadePainel} from "@/server/inbox/painel-atividade";
import {AgendadasAtividade} from "./AgendadasAtividade";
export function AbaAtividade({dados,atendimentoId,fuso,fusoEscola,aoMudar}:{dados:AtividadePainel;atendimentoId:string;fuso:string|null;fusoEscola:string;aoMudar():void}){
 const recente=dados.recente;
 return <div className="space-y-4"><AgendadasAtividade itens={dados.agendadas} atendimentoId={atendimentoId} fuso={fuso} fusoEscola={fusoEscola} aoMudar={aoMudar}/><section className="space-y-2" aria-label="Atividade recente"><h3 className="text-sm font-medium">Atividade recente</h3><p className="text-xs text-gray-600">Última interação {recente.ultimaInteracaoEm?formatarInstanteExibicao(recente.ultimaInteracaoEm,fuso,fusoEscola).texto:"Sem interação registrada"} · {recente.conversas} conversas · {recente.tarefasAbertas} tarefa(s) aberta(s)</p>{recente.notas.length?<ul className="space-y-3">{recente.notas.map(n=><li key={n.id} className="flex min-w-0 items-start gap-2"><IconNote size={16} className="mt-0.5 shrink-0 text-amber-700" aria-hidden/><div className="min-w-0"><p className="line-clamp-2 whitespace-pre-wrap text-[13px] [overflow-wrap:anywhere]">{n.nota}</p><p className="mt-1 text-xs text-gray-500">{n.autorNome??"Sistema"} · {formatarInstanteExibicao(n.criadoEm,fuso,fusoEscola).texto}</p></div></li>)}</ul>:<EstadoVazio>Nenhuma nota interna ainda.</EstadoVazio>}</section></div>;
}