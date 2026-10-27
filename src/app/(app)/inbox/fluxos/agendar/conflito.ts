export function agendadaProxima(quando:Date,agendadas:readonly {id:string;agendadaPara:string}[],ignorarId?:string):{id:string;agendadaPara:string}|null{
 const alvo=quando.getTime();if(!Number.isFinite(alvo))return null;
 return agendadas.flatMap(a=>{const delta=Math.abs(new Date(a.agendadaPara).getTime()-alvo);return a.id!==ignorarId&&Number.isFinite(delta)&&delta<7200000?[{a,delta}]:[];})
  .sort((a,b)=>a.delta-b.delta||(a.a.id<b.a.id?-1:a.a.id>b.a.id?1:0))[0]?.a??null;
}