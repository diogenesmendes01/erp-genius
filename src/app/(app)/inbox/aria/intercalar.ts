import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
import type { ItemSugestaoThread } from "@/components/conversa/itens-thread";
export type { ItemSugestaoThread } from "@/components/conversa/itens-thread";
/** Só composição visual: não participa de cursor, limite ou transporte da thread. */
export function intercalarSugestoes<I>(itens:readonly I[],instante:(i:I)=>string|null,sugestoes:readonly SugestaoAriaThread[],o:{inicioJanela:string|null;fimJanela?:string|null}):(I|ItemSugestaoThread)[]{
 const inicio=o.inicioJanela===null?null:Date.parse(o.inicioJanela);
 const fim=o.fimJanela==null?null:Date.parse(o.fimJanela);
 const epoch=(s:string|null)=>{const n=s===null?NaN:Date.parse(s);return Number.isFinite(n)?n:Infinity;};
 const datados=itens.map(i=>({item:i as I|ItemSugestaoThread,em:instante(i)}));
 for(const s of sugestoes){
  if(fim!==null&&epoch(s.criadoEm)>fim)continue;
  if(inicio!==null&&s.status!=="SUGERIDA"&&Date.parse(s.criadoEm)<inicio)continue;
  datados.push({item:{tipo:"sugestao-aria",id:"sugestao-aria:"+s.id,s},em:s.criadoEm});
 }
 return datados.sort((a,b)=>{const x=epoch(a.em),y=epoch(b.em);return x===y?0:x<y?-1:1;}).map(x=>x.item);
}
