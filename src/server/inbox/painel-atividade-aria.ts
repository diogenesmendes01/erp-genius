import {criarLeitorHistoricoAria,contarAlteracoesExecutadas} from "./historico-aria-leitura";
import {ACAO_AGENTE_IA_LABEL,rotular} from "@/lib/labels";
import type {AcaoAgenteIATipo,EtapaLead} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import type {UsuarioSessao} from "@/server/_shared/sessao";
import {acoesDecidiveisNoInbox} from "@/server/aria/escopo-decisao-inbox";
import {configPadrao,modoDaAcao} from "@/server/aria/config-schema";
import {ACOES_MATRIZ} from "@/server/aria/matriz";
import {versaoPublicada} from "@/server/aria/versoes";
import {textoAlteracaoAria} from "./atividade-aria-texto";
export type AlteracaoAriaPainel={id:string;acao:AcaoAgenteIATipo;texto:string;em:string;desfeita:boolean;podeDesfazer:boolean;motivoIrreversivel:string|null};
export type AriaNoContato={ultimaAcao:{texto:string;confianca:number;em:string}|null;faixa:{executaAPartirDe:number;transfereAbaixoDe:number};etapa:EtapaLead|null;automatico:AcaoAgenteIATipo[];comAprovacao:AcaoAgenteIATipo[]};
export type AriaAtividade={aria:AriaNoContato|null;alteracoes:AlteracaoAriaPainel[];contadorAtividade:number};
export async function carregarAriaAtividade(u:UsuarioSessao,atendimentoId:string):Promise<AriaAtividade>{
 const vazio:AriaAtividade={aria:null,alteracoes:[],contadorAtividade:0};
 const leitor=await criarLeitorHistoricoAria(u,atendimentoId);
 if(!leitor)return vazio;
 const {atendimento:a,leadAtual:atual}=leitor;
 const [lista,ultimas,publicada]=await Promise.all([
  leitor.alteracoes(),
  leitor.pagina({status:{not:"SIMULADA"}},1),versaoPublicada(),
 ]);
 const config=publicada?.config??configPadrao();
 const decidiveis=await acoesDecidiveisNoInbox(prisma,u,a,lista);
 const alteracoes=lista.map(c=>({id:c.id,acao:c.acao,texto:textoAlteracaoAria(c.acao,c.payload),em:c.criadoEm.toISOString(),desfeita:c.status==="DESFEITA",podeDesfazer:decidiveis.has(c.id)&&c.reversivel&&(c.status==="EXECUTADA"||c.status==="APROVADA"),motivoIrreversivel:c.reversivel?null:c.motivoIrreversivel}));
 const ultima=ultimas[0];
 return {aria:{ultimaAcao:ultima?{texto:["EXECUTADA","APROVADA","DESFEITA"].includes(ultima.status)?textoAlteracaoAria(ultima.acao,ultima.payload):rotular(ACAO_AGENTE_IA_LABEL,ultima.acao),confianca:ultima.confianca,em:ultima.criadoEm.toISOString()}:null,faixa:{executaAPartirDe:config.confianca.executaAPartirDe,transfereAbaixoDe:config.confianca.transfereAbaixoDe},etapa:atual.etapa,automatico:ACOES_MATRIZ.filter(c=>modoDaAcao(config,atual.etapa,c)==="EXECUTA"),comAprovacao:ACOES_MATRIZ.filter(c=>modoDaAcao(config,atual.etapa,c)==="SUGERE")},alteracoes,contadorAtividade:contarAlteracoesExecutadas(lista)};
}
