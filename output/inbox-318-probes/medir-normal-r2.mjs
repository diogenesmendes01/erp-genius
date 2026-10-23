import { chromium } from 'playwright-core';
import { mkdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { autenticarApp } from '../../scripts/visual/espera-app.mjs';
import { anonimizarTelefonesNoDom } from '../../scripts/visual/anonimizar-telefones.mjs';
const base='http://localhost:3110',fonte='9dd098d226a80291711bc6f1e007194949489469';
if(!process.env.INBOX_VISUAL_EMAIL||!process.env.INBOX_VISUAL_SENHA)throw Error('Credenciais fictícias locais obrigatórias por ambiente');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const saida=new URL('./normal-r2/',import.meta.url);await mkdir(saida,{recursive:true});
const resultados=[];
const metricas=()=>{
 const a=document.querySelector('#painel-contato'),s=a.querySelector(':scope > div.overflow-y-auto'),b=a.querySelector('button[aria-label="Fechar painel do contato"]'),av=a.querySelector('[data-cabecalho-contato] > span'),r=e=>{const a=e.getBoundingClientRect();return{x:a.x,y:a.y,w:a.width,h:a.height,right:a.right,bottom:a.bottom}};
 return{aside:r(a),avatar:av?r(av):null,botao:r(b),quantidadeFechar:a.querySelectorAll('button[aria-label="Fechar painel do contato"]').length,scroll:{top:s.scrollTop,height:s.clientHeight,total:s.scrollHeight},documento:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},modal:a.getAttribute('aria-modal'),tabs:[...a.querySelectorAll('[role="tab"]')].map(e=>({nome:e.textContent,selected:e.getAttribute('aria-selected'),tabindex:e.tabIndex})),tags:[...a.querySelectorAll('[data-cabecalho-contato] span.rounded-\\[13px\\]')].map(e=>({texto:e.textContent,ia:!!e.querySelector('[aria-label="Criada pela Aria"]')})),whatsApp:a.textContent.includes('WhatsApp'),optOut:!!a.querySelector('[aria-label="Opt-out do contato"]'),aria:!!a.querySelector('[aria-label="Aria"]'),focoNoPainel:a.contains(document.activeElement)};
};
const foto=async(p,n)=>{const anonim=await p.evaluate(anonimizarTelefonesNoDom);const caminho=fileURLToPath(new URL(n,saida));await p.screenshot({path:caminho,style:'[data-nextjs-toast]:not(:has([data-has-issues="true"])) { visibility:hidden!important; }'});return{arquivo:n,sha256:createHash('sha256').update(readFileSync(caminho)).digest('hex'),anonim};};
try{
for(const tema of ['light','dark'])for(const width of [390,699,700,959,960,1024,1399,1400,1440]){
 const height=500,ctx=await browser.newContext({viewport:{width,height},locale:'pt-BR',timezoneId:'America/Sao_Paulo'}),falhas=[],erros=[],externos=[];
 await ctx.addInitScript(t=>localStorage.setItem('tema',t),tema);
 await ctx.route('**/*',r=>{if(new URL(r.request().url()).origin===base)return r.continue();externos.push(new URL(r.request().url()).origin);return r.abort();});
 await autenticarApp(ctx,base,process.env.INBOX_VISUAL_EMAIL,process.env.INBOX_VISUAL_SENHA);
 const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));p.on('console',m=>{if(/hydration|hydrating|did not match|same key|unique.*key/i.test(m.text()))erros.push(m.text());});
 await p.goto(base+'/inbox?c=inbox-demo-mariana-307',{waitUntil:'domcontentloaded'});await p.locator('[data-vista][data-conectado="1"]').waitFor({state:'attached'});
 await p.locator('section[aria-label="Painel Comercial"]').waitFor({state:'attached'});
 await p.evaluate(()=>document.fonts.ready);
 const a=p.locator('#painel-contato'),gatilho=p.getByRole('button',{name:'Painel do contato',exact:true});
 if(!(await a.isVisible()))await gatilho.click();
 await a.waitFor({state:'visible'});await p.evaluate(()=>{window.__318aside=document.querySelector('#painel-contato');window.__318close=window.__318aside.querySelector('button[aria-label="Fechar painel do contato"]');});
 const esperado=width<700?'Voltar para a conversa':'Fechar painel';
 const cdp=await ctx.newCDPSession(p),{root}=await cdp.send('DOM.getDocument'),{nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#painel-contato button[aria-label="Fechar painel do contato"]'}),ax=await cdp.send('Accessibility.getPartialAXTree',{nodeId,fetchRelatives:false});
 const nomeAX=ax.nodes.find(n=>n.role?.value==='button')?.name?.value;
 if(nomeAX!==esperado)falhas.push('ACCNAME:'+nomeAX+' esperado:'+esperado);
 const antes=await p.evaluate(metricas);
 if(antes.avatar?.w!==132||antes.avatar?.h!==132)falhas.push('Avatar não132');
 if(antes.quantidadeFechar!==1||antes.botao.w!==36||antes.botao.h!==36)falhas.push('Controle fechar não único36');
 if(antes.documento.w>width+1||antes.documento.h>height+1)falhas.push('Overflow documento');
 if(antes.tabs.length!==1||antes.tabs[0].nome!=='Detalhes')falhas.push('Abas futuras/ausentes');
 const imagens=[];imagens.push(await foto(p,tema+'-'+width+'-topo.png'));
 const fim=p.getByRole('button',{name:'Registrar opt-out',exact:true});await fim.scrollIntoViewIfNeeded();
 const alcance=await fim.evaluate(el=>{const r=el.getBoundingClientRect(),a=el.closest('aside').getBoundingClientRect();return{top:r.top,bottom:r.bottom,dentro:r.top>=a.top-1&&r.bottom<=a.bottom+1};});
 if(!alcance.dentro)falhas.push('Último controle inacessível');
 const depois=await p.evaluate(metricas);imagens.push(await foto(p,tema+'-'+width+'-fim.png'));
 await p.getByRole('tab',{name:'Detalhes',exact:true}).focus();await p.keyboard.press('Home');await p.keyboard.press('End');await p.keyboard.press('ArrowLeft');await p.keyboard.press('ArrowRight');
 const focoAba=await p.getByRole('tab',{name:'Detalhes',exact:true}).evaluate(el=>document.activeElement===el);if(!focoAba)falhas.push('Foco aba');
 await p.keyboard.press('Escape');await a.waitFor({state:'hidden'});
 const retorno=await gatilho.evaluate(el=>document.activeElement===el);if(!retorno)falhas.push('Escape não devolveu foco');
 const identidade=await p.evaluate(()=>document.querySelector('#painel-contato')===window.__318aside&&window.__318aside.querySelector('button[aria-label="Fechar painel do contato"]')===window.__318close);if(!identidade)falhas.push('Remontou painel/fechar');
 resultados.push({fonte,tema,width,height,nomeAX,esperado,antes,depois,alcance,focoAba,retorno,identidade,imagens,falhas,erros,externos});console.log(tema,width,JSON.stringify({nomeAX,falhas,erros,externos}));await ctx.close();
}
}finally{await browser.close();await writeFile(new URL('medidas.json',saida),JSON.stringify({fonte,etapa:'probes privados antes do próximo fix313; não QA final',resultados},null,2));}
if(resultados.length!==18||resultados.some(r=>r.falhas.length||r.erros.length||r.externos.length))throw Error('Probe318 normal registrou falhas');
