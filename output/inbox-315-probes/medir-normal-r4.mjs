import { chromium } from 'playwright-core';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { autenticarApp, esperarConteudoApp, esperarHidratacaoApp } from '../../scripts/visual/espera-app.mjs';
import { anonimizarTelefonesNoDom } from '../../scripts/visual/anonimizar-telefones.mjs';
import { problemaReactNaCaptura } from '../../scripts/visual/nucleo-captura.mjs';
const base='http://localhost:3110',fonte='f7df2ea9f9815d1f37e6dadcba7808992901e77f',saida=new URL('./normal-r4/',import.meta.url),resultados=[];
if(!process.env.INBOX_VISUAL_EMAIL||!process.env.INBOX_VISUAL_SENHA)throw Error('Credenciais fictícias locais por ambiente obrigatórias');
await mkdir(saida,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const foto=async(p,n)=>{const politica=await p.evaluate(anonimizarTelefonesNoDom),a=fileURLToPath(new URL(n,saida));await p.screenshot({path:a,style:'[data-nextjs-toast]:not(:has([data-has-issues="true"])) { visibility:hidden!important; }'});return{arquivo:n,sha256:createHash('sha256').update(await readFile(a)).digest('hex'),politica};};
const medidas=()=>{
 const h=document.querySelector('section[aria-label="Conversa"] > header'),r=e=>{const a=e.getBoundingClientRect();return{x:a.x,y:a.y,w:a.width,h:a.height,right:a.right,bottom:a.bottom};},vis=e=>{const a=r(e);return a.w>0&&a.h>0;};
 return{header:r(h),botoes:[...h.querySelectorAll('button')].filter(vis).map(e=>({nome:e.getAttribute('aria-label')||e.textContent.trim(),disabled:e.disabled,rect:r(e)})),nome:{texto:h.querySelector('p[title]').textContent,rect:r(h.querySelector('p[title]'))},status:{texto:h.querySelector('span[title]').textContent,rect:r(h.querySelector('span[title]'))},documento:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}};
};
const menuMedidas=()=>{const m=document.querySelector('[role="menu"][aria-label="Mais ações da conversa"]'),r=m.getBoundingClientRect(),a=document.activeElement,ar=a.getBoundingClientRect();return{rect:{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right},scroll:{top:m.scrollTop,total:m.scrollHeight,altura:m.clientHeight},top:getComputedStyle(m).top,bottom:getComputedStyle(m).bottom,foco:{nome:a.textContent.trim(),disabled:a.disabled,dentro:m.contains(a)&&ar.top>=r.top-1&&ar.bottom<=r.bottom+1},itens:[...m.querySelectorAll('[role="menuitem"]')].map(e=>({nome:e.textContent.trim(),disabled:e.disabled}))};};
try{for(const tema of ['light','dark'])for(const width of [320,390,699,700,959,960,1024,1399,1400,1440]){
 const height=500,ctx=await browser.newContext({viewport:{width,height},locale:'pt-BR',timezoneId:'America/Sao_Paulo'}),falhas=[],erros=[],externos=[];
 await ctx.addInitScript(t=>{if(location.protocol==='http:')localStorage.setItem('tema',t);},tema);
 await ctx.route('**/*',r=>{if(new URL(r.request().url()).origin===base)return r.continue();externos.push(new URL(r.request().url()).origin);return r.abort();});
 await autenticarApp(ctx,base,process.env.INBOX_VISUAL_EMAIL,process.env.INBOX_VISUAL_SENHA);const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));p.on('console',m=>{if(problemaReactNaCaptura(m.text()))erros.push(m.text());});
 try{
 await p.goto(base+'/inbox?c=inbox-demo-mariana-307',{waitUntil:'domcontentloaded'});await esperarHidratacaoApp(p);await esperarConteudoApp(p,'conversa',width>=1400?'desktop':'celular');await p.evaluate(()=>document.fonts.ready);
 const antes=await p.evaluate(medidas),imagens=[await foto(p,tema+"-"+width+"-header.png")];
 if(Math.abs(antes.header.h-68)>.5)falhas.push('Altura header:'+antes.header.h);
 if(antes.documento.w>width+1||antes.documento.h>height+1||antes.nome.rect.w<=0||antes.status.rect.w<=0)falhas.push('Overflow/nome/status sem espaço');
 if(antes.botoes.some(b=>b.rect.x<antes.header.x-1||b.rect.right>antes.header.right+1||b.rect.y<antes.header.y-1||b.rect.bottom>antes.header.bottom+1))falhas.push('Botões fora header');
 if(width<640&&antes.botoes.filter(b=>['Transferir','Assumir conversa','Mais ações da conversa'].includes(b.nome)).some(b=>b.rect.h<44||b.rect.w<44))falhas.push('Alvo móvel abaixo44');
 if((width<960)!==antes.botoes.some(b=>b.nome==='Voltar para a lista'))falhas.push('Corte Voltar960');
 const gatilho=p.getByRole('button',{name:'Mais ações da conversa',exact:true}),menu=p.getByRole('menu',{name:'Mais ações da conversa',exact:true});await gatilho.click();await menu.waitFor({state:'visible'});
 const topo=await p.evaluate(menuMedidas);if(topo.rect.x< -1||topo.rect.right>width+1||topo.rect.bottom>height+1||topo.rect.y< -1)falhas.push('Menu fora viewport');if(width<700&&(Math.abs(topo.rect.bottom-height)>1||topo.rect.h>height*.85+1))falhas.push('Folha móvel fora bottom/85dvh');
 imagens.push(await foto(p,tema+'-'+width+'-menu-topo.png'));
 await p.keyboard.press('End');const fim=await p.evaluate(menuMedidas);if(!fim.foco.dentro||fim.foco.disabled)falhas.push('End não revela último habilitado');
 await p.keyboard.press('Home');const inicio=await p.evaluate(menuMedidas);if(!inicio.foco.dentro||inicio.foco.nome!=='Marcar como não lida')falhas.push('Home não revela primeiro');
 const bloqueio=menu.getByRole('menuitem',{name:/Bloquear contato/}),buscar=menu.getByRole('menuitem',{name:/Buscar na conversa/});if(!(await bloqueio.isDisabled())||!(await buscar.isDisabled()))falhas.push('Indisponíveis habilitados');await bloqueio.scrollIntoViewIfNeeded();await menu.waitFor({state:'visible'});imagens.push(await foto(p,tema+'-'+width+'-menu-fim.png'));
 await p.keyboard.press('Escape');await menu.waitFor({state:'hidden'});const retorno=await gatilho.evaluate(e=>document.activeElement===e);if(!retorno)falhas.push('Escape não devolve foco');
 await gatilho.click();await p.setViewportSize({width:width+1,height});await menu.waitFor({state:'hidden'});await p.setViewportSize({width,height});
 await gatilho.click();await menu.waitFor({state:'visible'});await p.evaluate(()=>document.dispatchEvent(new Event('scroll',{bubbles:true})));await menu.waitFor({state:'hidden'});
 await gatilho.click();await menu.getByRole('menuitem',{name:'Nota interna',exact:true}).click();const dialogo=p.getByRole('dialog',{name:'Nota interna',exact:true});await dialogo.waitFor({state:'visible'});await p.keyboard.press('Escape');await dialogo.waitFor({state:'hidden'});const retornoDialogo=await gatilho.evaluate(e=>document.activeElement===e);if(!retornoDialogo)falhas.push('Diálogo não retorna ao gatilho');
 const aside=p.locator('#painel-contato'),botaoPainel=p.getByRole('button',{name:'Painel do contato',exact:true});
 const painelInicial=await aside.isVisible();if(painelInicial){await botaoPainel.click();await aside.waitFor({state:'hidden'});}
 await botaoPainel.click();await aside.waitFor({state:'visible'});const painelAberto=await aside.evaluate(e=>({visivel:e.getBoundingClientRect().width>0,unico:document.querySelectorAll('#painel-contato').length===1}));
 await aside.getByRole('button',{name:width<700?'Voltar para a conversa':'Fechar painel',exact:true}).click();await aside.waitFor({state:'hidden'});const focoPainel=await botaoPainel.evaluate(e=>document.activeElement===e);if(!painelAberto.unico||!focoPainel)falhas.push('Painel não único/retorno do gatilho');
 resultados.push({fonte,tema,width,height,antes,topo,fim,inicio,retorno,retornoDialogo,painelInicial,painelAberto,focoPainel,imagens,falhas,erros,externos});console.log(tema,width,JSON.stringify({falhas,erros,externos,header:antes.header,controls:antes.botoes.map(b=>({nome:b.nome,w:b.rect.w,h:b.rect.h})),menu:topo.rect,end:fim.foco}));
 }catch(e){resultados.push({fonte,tema,width,height,falhas:[String(e)],erros,externos});console.log(tema,width,'FALHOU',String(e));throw e;}finally{await ctx.close();}
}}
finally{await browser.close();await writeFile(new URL('medidas.json',saida),JSON.stringify({fonte,fixture:'snapshot307314 normal; nenhum submit/write de negócio',resultados},null,2));}
if(resultados.length!==20||resultados.some(r=>r.falhas.length||r.erros.length||r.externos.length))throw Error('Probe315 registrou falhas');
