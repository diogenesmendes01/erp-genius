import { chromium } from 'playwright-core';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { autenticarApp,esperarHidratacaoApp } from '../../scripts/visual/espera-app.mjs';
import { anonimizarTelefonesNoDom } from '../../scripts/visual/anonimizar-telefones.mjs';
import { problemaReactNaCaptura } from '../../scripts/visual/nucleo-captura.mjs';
const base='http://localhost:3110',fonte=process.env.INBOX_VISUAL_FONTE,saida=new URL('./foco-await-r3/',import.meta.url),resultados=[];
if(fonte!=='47b8ac0d85c29e30a55137d59c53affd7e916ecc')throw Error('Probe reservado à fonte47b congelada');
await mkdir(saida,{recursive:true});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{for(const tema of ['light','dark'])for(const [width,height]of [[1440,900],[1024,768],[390,500],[320,500]]){
 const c=await b.newContext({viewport:{width,height},locale:'pt-BR',timezoneId:'America/Sao_Paulo'}),r={tema,width,height,falhas:[],erros:[],externos:[]};let liberar=()=>{};
 try{
  await c.addInitScript(t=>{if(location.protocol==='http:')localStorage.setItem('tema',t);},tema);
  await c.route('**/*',route=>{if(new URL(route.request().url()).origin===base)return route.continue();r.externos.push(new URL(route.request().url()).origin);return route.abort();});
  await autenticarApp(c,base,process.env.INBOX_VISUAL_EMAIL,process.env.INBOX_VISUAL_SENHA);
  const p=await c.newPage();p.on('pageerror',e=>r.erros.push(e.message));p.on('console',m=>{if(problemaReactNaCaptura(m.text()))r.erros.push(m.text());});
  await p.goto(base+'/inbox?c=inbox-demo-beatriz-307',{waitUntil:'domcontentloaded'});await esperarHidratacaoApp(p);
  await p.locator('section[aria-label="Conversa"] [data-mensagem-id]').first().waitFor({state:'visible'});
  await p.getByRole('textbox',{name:'Digite uma mensagem',exact:true}).focus();await p.keyboard.press('Control+f');
  const campo=p.locator('input[aria-label="Buscar na conversa"]');await campo.fill('busca 316');
  let recebeu;const recebida=new Promise(resolve=>{recebeu=resolve;});const bloqueio=new Promise(resolve=>{liberar=resolve;});
  // Somente a GET antes= explicitamente acionada pelo botão fica retida; nenhum POST ou dado é alterado.
  await p.route(u=>u.pathname==='/api/inbox/atendimentos/inbox-demo-beatriz-307/mensagens'&&u.searchParams.has('antes'),async route=>{recebeu();await bloqueio;await route.continue();},{times:1});
  const resposta=p.waitForResponse(q=>q.request().method()==='GET'&&new URL(q.url()).searchParams.has('antes')&&q.ok());
  await p.getByRole('button',{name:'Carregar anteriores',exact:true}).click();await recebida;
  r.focoAntesDaResposta=await campo.evaluate(e=>document.activeElement===e);
  const focoFora=await p.evaluateHandle(()=>{const regiao=document.querySelector('section[aria-label="Conversa"]');const el=[...document.querySelectorAll('button,a,input')].find(e=>!regiao.contains(e)&&e.getClientRects().length&&!e.closest('[inert]'));el.focus();return el;});
  r.focoForaDuranteAwait=await focoFora.evaluate(e=>document.activeElement===e);
  liberar();await resposta;await p.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Carregar anteriores');return!b||!b.disabled;});
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  r.focoForaAposResposta=await focoFora.evaluate(e=>document.activeElement===e);r.documentY=await p.evaluate(()=>window.scrollY);
  if(!r.focoAntesDaResposta||!r.focoForaDuranteAwait||!r.focoForaAposResposta||r.documentY!==0)r.falhas.push('Handoff ou foco externo durante await inválido');
  const arquivo=tema+'-'+width+'.png';r.politica=await p.evaluate(anonimizarTelefonesNoDom);await p.screenshot({path:fileURLToPath(new URL(arquivo,saida)),style:'[data-nextjs-toast]:not(:has([data-has-issues="true"])) { visibility:hidden!important; }'});
  r.imagem={arquivo,sha256:createHash('sha256').update(await readFile(new URL(arquivo,saida))).digest('hex')};
 }catch(e){r.falhas.push(String(e));}finally{liberar();await c.close();resultados.push(r);await writeFile(new URL('medidas.json',saida),JSON.stringify({fonte,harness:'23cdbc35a1a87dcf6465b7775c43ee6829ade567',politica:'GET UI antes= retida somente no browser para controlar await; foco externo deliberado, sem refoco pelo probe após resposta.',resultados},null,2));console.log(tema,width,JSON.stringify(r.falhas));}
}}finally{await b.close();}
if(resultados.length!==8||resultados.some(r=>r.falhas.length||r.erros.length||r.externos.length))throw Error('Foco await316 falhou');
