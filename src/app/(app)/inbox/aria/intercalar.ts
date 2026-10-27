import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
import type { ItemSugestaoThread } from "@/components/conversa/itens-thread";
export type { ItemSugestaoThread } from "@/components/conversa/itens-thread";
export function agruparPorTurno(cartoes:readonly SugestaoAriaThread[]):SugestaoAriaThread[][]{
 const grupos:SugestaoAriaThread[][]=[],porTurno=new Map<string,SugestaoAriaThread[]>();
 for(const s of cartoes){
  if(s.status!=="SUGERIDA"){grupos.push([s]);continue;}
  const g=porTurno.get(s.turnoId);
  if(g)g.push(s);else{const novo=[s];porTurno.set(s.turnoId,novo);grupos.push(novo);}
 }
 return grupos;
}
export function intercalarSugestoes<I>(itens:readonly I[],instante:(i:I)=>string|null,sugestoes:readonly SugestaoAriaThread[],o:{inicioJanela:string|null;fimJanela?:string|null}):(I|ItemSugestaoThread)[]{
 const inicio=o.inicioJanela===null?null:Date.parse(o.inicioJanela);
 const fim=o.fimJanela==null?null:Date.parse(o.fimJanela);
 const epoch=(s:string|null)=>{const n=s===null?NaN:Date.parse(s);return Number.isFinite(n)?n:Infinity;};
 const datados=itens.map(i=>({item:i as I|ItemSugestaoThread,em:instante(i)}));
 const visiveis=sugestoes.filter(s=>!(fim!==null&&epoch(s.criadoEm)>fim)&&!(inicio!==null&&s.status!=="SUGERIDA"&&Date.parse(s.criadoEm)<inicio));
 for(const grupo of agruparPorTurno(visiveis)){
  const s=grupo.reduce((a,b)=>epoch(b.criadoEm)<epoch(a.criadoEm)?b:a);
  datados.push({item:{tipo:"sugestao-aria",id:"sugestao-aria:"+s.id,s,...(grupo.length>1?{pacote:grupo}:{})},em:s.criadoEm});
 }
 return datados.sort((a,b)=>{const x=epoch(a.em),y=epoch(b.em);return x===y?0:x<y?-1:1;}).map(x=>x.item);
}
