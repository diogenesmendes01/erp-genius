import {readFileSync} from "node:fs";
import {expect,it} from "vitest";
import {contratoPresencaValido,MODULO_PRESENCA} from "./contrato-presenca";
const fonte=()=>readFileSync(MODULO_PRESENCA,"utf8");
it("nominal exato permite só pulso25 e validadeoneShot de presença",()=>expect(contratoPresencaValido(MODULO_PRESENCA,fonte())).toBe(true));
it.each([
 ["URL",(s:string)=>s.replace('/api/inbox/presenca','/api/inbox/lista')],
 ["cadência",(s:string)=>s.replace('setInterval(pulso,25_000)','setInterval(pulso,20_000)')],
 ["GET",(s:string)=>s.replace('method:"POST"','method:"GET"')],
 ["timerextra",(s:string)=>s+'\nsetTimeout(expirar,1);'],
 ["segundoPulso",(s:string)=>s+'\nsetInterval(pulso,25_000);'],
 ["negócio",(s:string)=>s+'\nfetch("/api/inbox/lista");'],
 ["refresh",(s:string)=>s+'\nrouter.refresh();'],
 ["header",(s:string)=>s.replace('"X-Inbox-Presenca":"1"','"X-Inbox-Presenca":"2"')],
] as const)("nega mutante %s",(_nome,mudar)=>expect(contratoPresencaValido(MODULO_PRESENCA,mudar(fonte()))).toBe(false));
it("mesmo código emoutromódulo não recebeexceção",()=>expect(contratoPresencaValido("src/lib/outro.ts",fonte())).toBe(false));
