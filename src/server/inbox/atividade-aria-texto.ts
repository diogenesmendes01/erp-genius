import type {AcaoAgenteIATipo,EtapaLead} from "@prisma/client";
import {ALTERACAO_ARIA_LABEL,ETAPA_LABEL,rotular} from "@/lib/labels";
export function textoAlteracaoAria(acao:AcaoAgenteIATipo,payload:unknown):string{
 const p=payload!==null&&typeof payload==="object"&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
 const texto=(chave:string)=>typeof p[chave]==="string"?(p[chave] as string).trim():"";
 if(acao==="TAG"&&texto("nome"))return `Adicionou a tag ${texto("nome")}`;
 if(acao==="CRIAR_TAREFA"&&texto("titulo"))return `Criou a tarefa ${texto("titulo")}`;
 if(acao==="ATUALIZAR_CAMPO"&&texto("nomeCampo"))return `Preencheu ${texto("nomeCampo")}`;
 if(acao==="MOVER_ETAPA"&&Object.prototype.hasOwnProperty.call(ETAPA_LABEL,texto("para")))return `Moveu para ${rotular(ETAPA_LABEL,texto("para") as EtapaLead)}`;
 return rotular(ALTERACAO_ARIA_LABEL,acao);
}
export function faixaConfianca(valor:number,faixa:{executaAPartirDe:number;transfereAbaixoDe:number}):"alta"|"media"|"baixa"{
 if(valor>=faixa.executaAPartirDe)return "alta";
 return valor<faixa.transfereAbaixoDe?"baixa":"media";
}