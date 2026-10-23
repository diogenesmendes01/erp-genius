import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const fonte=process.env.INBOX_VISUAL_FONTE,harness='23cdbc35a1a87dcf6465b7775c43ee6829ade567',destino='output/inbox-316-probes/formal-r2';
if(!fonte)throw Error("Fonte congelada explícita obrigatória");
const m=JSON.parse(await readFile('tmp/visual/manifesto.json','utf8'));
if(m.fonteApp!==fonte||m.capturas.length!==6||m.capturas.some(c=>c.estado!=='busca-conversa'||c.alvo!=='app'||c.falhas.length||c.referenciaFuncionalPrototipo!==null||!c.motivoSemReferencia))throw Error('Manifesto não é busca316 app-only na fonte correta');
await mkdir(destino,{recursive:true});
for(const c of m.capturas){if(path.basename(c.arquivo)!==c.arquivo||!c.arquivo.endsWith('.png'))throw Error('Arquivo inválido');await copyFile('tmp/visual/'+c.arquivo,destino+'/'+c.arquivo);c.sha256=createHash('sha256').update(await readFile(destino+'/'+c.arquivo)).digest('hex');}
m.fonteProduto=fonte;m.fonteHarnessGit=harness;await writeFile(destino+'/manifesto.json',JSON.stringify(m,null,2)+'\n');console.log('6PNG app-only preservadas com SHA256');
