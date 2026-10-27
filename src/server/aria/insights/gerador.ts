import { chaveConfigurada,escolherProvedor,provedorSimulado } from "../provedor";
import { ErroProvedorIA,type PedidoIA,type ProvedorIA,type RespostaIA } from "../provedor/tipos";
import { modeloPermitido } from "../provedor/custo";
import { UsoInsightSchema,envelopeRespostaControladaInsight,envelopeRespostaInsight,type EnvelopeInsight,type PortaGeradorInsight } from "./envelope";

type CodigoIncerto=Extract<EnvelopeInsight,{tipo:"incerto"}>["codigo"];
function codigoIncerto(erro:unknown):CodigoIncerto {
  const c=erro instanceof ErroProvedorIA?erro.codigo:null;
  return c==="CORPO_INVALIDO"||c==="DEADLINE"||c==="ABORTADO_APOS_ENVIO"||c==="MODELO_DESCONHECIDO"||c==="MODELO_DIVERGENTE"?c:"TRANSPORTE";
}
export function criarPortaGeradorInsight(provedor:ProvedorIA,modeloEsperado:string):PortaGeradorInsight {
  return {async gerar(pedido,controle){
    if(provedor.nome!=="anthropic")return {tipo:"nao-enviada",fase:"nao-enviado",codigo:"PROVEDOR_INDISPONIVEL"};
    const inicio=performance.now();
    let resposta:RespostaIA|undefined;
    const latencia=()=>Math.min(2_147_483_647,Math.max(0,Math.round(performance.now()-inicio)));
    try {
      resposta=await provedor.gerar({...pedido,controle});
      return envelopeRespostaControladaInsight({...resposta,latenciaMs:latencia()},modeloEsperado);
    } catch(erro){
      const d=(erro instanceof ErroProvedorIA?erro.diagnostico:undefined)??resposta?.diagnostico;
      if(d?.fase==="nao-enviado")return {tipo:"nao-enviada",fase:"nao-enviado",codigo:erro instanceof ErroProvedorIA&&erro.codigo==="ABORTADO_ANTES_ENVIO"?"ABORTADO_ANTES_ENVIO":"CONFIG_INVALIDA"};
      const observado=d?.modeloObservado;
      const modelo=typeof observado==="string"&&modeloPermitido(observado)?observado:null;
      const u=UsoInsightSchema.safeParse(d?.uso);
      const codigo=modelo&&modelo!==modeloEsperado?"MODELO_DIVERGENTE":codigoIncerto(erro);
      return {tipo:"incerto",fase:"possivelmente-enviado",modelo,provedor:"anthropic",latenciaMs:latencia(),codigo,uso:u.success?u.data:null};
    }
  }};
}
export interface MetaGeracaoInsight {modelo:string;provedor:string;simulada:boolean}
export interface ServicosGeracaoInsight {
  disponivel:()=>boolean;
  executar:(meta:MetaGeracaoInsight,pedido:PedidoIA)=>Promise<EnvelopeInsight>;
}
export const servicosPadraoInsight:ServicosGeracaoInsight={
  disponivel:chaveConfigurada,
  async executar(meta,pedido){
    if(meta.simulada){
      if(meta.modelo!=="simulado"||meta.provedor!=="simulado")return {tipo:"nao-enviada",fase:"nao-enviado",codigo:"CONFIG_INVALIDA"};
      const r=await provedorSimulado.gerar(pedido);
      const analise={temperatura:null,chanceFechar:null,sentimento:null,melhorHorario:null,intencao:null,sinais:[],riscos:[],proximoPasso:null,textoSugerido:null};
      return envelopeRespostaInsight({modelo:"simulado",provedor:"simulado",latenciaMs:r.latenciaMs},{texto:JSON.stringify(analise),recusa:r.recusa,
        uso:{tokensEntrada:r.tokensEntrada,tokensSaida:r.tokensSaida,tokensCache:r.tokensCache,tokensEscritaCache:r.tokensEscritaCache}});
    }
    if(meta.provedor!=="anthropic")return {tipo:"nao-enviada",fase:"nao-enviado",codigo:"PROVEDOR_INDISPONIVEL"};
    let provedor:ProvedorIA;
    try{provedor=escolherProvedor({conversa:meta.modelo,classificacao:meta.modelo});}
    catch{return {tipo:"nao-enviada",fase:"nao-enviado",codigo:"CONFIG_INVALIDA"};}
    return criarPortaGeradorInsight(provedor,meta.modelo).gerar(pedido,{deadlineMs:30000,maxRetries:0});
  },
};
