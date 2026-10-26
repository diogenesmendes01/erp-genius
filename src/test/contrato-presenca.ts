/** Exceção nominal de dois timers de presença efêmera; não autoriza polling de dados de negócio. */
export const MODULO_PRESENCA="src/lib/presenca-inbox-cliente.ts";
export function contratoPresencaValido(path:string,fonte:string):boolean{
 if(path!==MODULO_PRESENCA)return false;
 const pulso="setInterval(pulso,25_000)",foto="setTimeout(expirar,restante)";
 if(fonte.split(pulso).length!==2||fonte.split(foto).length!==2)return false;
 const semTimers=fonte.replace(pulso,"").replace(foto,"");
 if(/setInterval\s*\(|setTimeout\s*\(|router\.refresh\s*\(|new EventSource/.test(semTimers))return false;
 if((fonte.match(/\bfetch\s*\(/g)??[]).length!==1)return false;
 return fonte.includes('fetch("/api/inbox/presenca",{method:"POST",credentials:"same-origin"')&&fonte.includes('"X-Inbox-Presenca":"1"')&&!/method\s*:\s*["']GET["']/.test(fonte);
}
