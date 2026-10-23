import { chromium } from "playwright-core";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { autenticarApp } from "../../scripts/visual/espera-app.mjs";
if (!process.env.INBOX_VISUAL_EMAIL || !process.env.INBOX_VISUAL_SENHA) throw new Error("Credenciais fictícias locais por ambiente são obrigatórias.");
const base="http://localhost:3110",resultados=[];
const fonte=process.env.INBOX_VISUAL_FONTE;if(!fonte)throw Error("SHA obrigatório");
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const estilo='[data-nextjs-toast]:not(:has([data-has-issues="true"])) { visibility: hidden !important; }';
const foto=async(p,n)=>p.screenshot({path:fileURLToPath(new URL("normais-final/"+n,import.meta.url)),style:estilo});
try {
 for(const tema of ["light","dark"]) for(const [width,height] of [[1440,900],[1024,768],[390,844]]){
  const ctx=await browser.newContext({viewport:{width,height},locale:"pt-BR",timezoneId:"America/Sao_Paulo"});
  await ctx.addInitScript(tema=>localStorage.setItem("tema",tema),tema);
  const externos=[],erros=[];
  await ctx.route("**/*",r=>{if(new URL(r.request().url()).origin===base)return r.continue();externos.push(new URL(r.request().url()).origin);return r.abort();});
  await autenticarApp(ctx,base,process.env.INBOX_VISUAL_EMAIL,process.env.INBOX_VISUAL_SENHA);
  const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));p.on('console',m=>{if(/hydration|hydrating|did not match|same key|unique.*key/i.test(m.text()))erros.push(m.text());});
  await p.goto(base+'/inbox?c=inbox-demo-beatriz-307',{waitUntil:'domcontentloaded'});
  await p.locator('[data-vista][data-conectado="1"]').waitFor({state:'attached'});
  await p.locator('[data-mensagem-id="inbox-314-msg-voce"]').waitFor({state:'attached'});
  await p.locator('[data-nota-id="inbox-314-nota-sem-autor"]').waitFor({state:'attached'});
  await p.evaluate(()=>document.fonts.ready);
  const falhas=[];
  const api=await ctx.request.get(base+'/api/inbox/atendimentos/inbox-demo-beatriz-307/mensagens');if(!api.ok())throw Error('API local sem conteúdo');const pagina=await api.json();
  const contagem={mensagens:pagina.mensagens.length,notas:pagina.notas?.length??0,temMais:pagina.temMais,antes:!!pagina.antes};
  const autoriaAPI={voce:pagina.mensagens.find(m=>m.id==='inbox-314-msg-voce')?.propria,anterior:pagina.mensagens.find(m=>m.id==='inbox-demo-msg-beatriz-falhou-307')?.propria};
  const metricas=await p.evaluate(()=>{
   const thread=document.querySelector('section[aria-label="Conversa"]'),scroll=thread.querySelector('div.overflow-y-auto'),r=thread.getBoundingClientRect();
   const autores={};for(const chave of ['voce','camila','carlos','carlos-sequencia','aria']){const el=document.querySelector('[data-mensagem-id="inbox-314-msg-'+chave+'"]');autores[chave]={cabecalho:[...el.querySelectorAll('span')].find(e=>e.classList.contains('mb-[3px]'))?.textContent.trim()??null,texto:el.textContent};}
   const notas=[...document.querySelectorAll('[data-nota-id]')].filter(e=>e.dataset.notaId.startsWith('inbox-314-')).map(el=>({id:el.dataset.notaId,role:el.getAttribute('role'),texto:el.textContent,acoes:el.querySelectorAll('button,[role="menu"],img,video,audio,[title="Enviada"],[title="Lida"]').length}));
   const linhas=[...thread.querySelectorAll('[data-mensagem-id],[data-nota-id]')].map(el=>{const caixa=el.firstElementChild.getBoundingClientRect();return{id:el.getAttribute('data-mensagem-id')||el.dataset.notaId,x:caixa.x,right:caixa.right,width:caixa.width};});
   const dias=[...thread.querySelectorAll('div.rounded-md')].filter(e=>/Hoje|Ontem|^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/.test(e.textContent)).map(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return{rotulo:e.textContent,desvioCentro:Math.abs((a.left+a.right-b.left-b.right)/2)};});
   const lida=document.querySelector('[data-mensagem-id="inbox-314-msg-voce"] [title="Lida"]');
   const anterior=document.querySelector('[data-mensagem-id="inbox-demo-msg-beatriz-falhou-307"]');
   const voceAnterior=[...anterior.querySelectorAll('span')].find(e=>e.classList.contains('mb-[3px]'))?.textContent.trim();
   const rows=[...thread.querySelectorAll('[data-mensagem-id],[data-nota-id]')],indice=rows.findIndex(e=>e.getAttribute('data-mensagem-id')==='inbox-314-msg-voce');
   const antesVoce=rows[indice-1]?.getAttribute('data-mensagem-id');
   return{autores,voceAnterior,antesVoce,notas,linhas,dias,lida:!!lida,erroLegado:!!document.querySelector('[data-mensagem-id="inbox-demo-msg-beatriz-falhou-307"] [title="Não enviada"]'),thread:{x:r.x,right:r.right,width:r.width},documento:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},scroll:{height:scroll.clientHeight,scrollHeight:scroll.scrollHeight}};
  });
  const voceIdentificado=metricas.autores.voce.cabecalho==='Você'||(metricas.autores.voce.cabecalho===null&&metricas.voceAnterior==='Você'&&metricas.antesVoce==='inbox-demo-msg-beatriz-falhou-307'&&autoriaAPI.voce&&autoriaAPI.anterior);
  if(!voceIdentificado||!metricas.autores.camila.cabecalho?.includes('Camila')||!metricas.autores.carlos.cabecalho?.includes('Carlos')||metricas.autores['carlos-sequencia'].cabecalho!==null||metricas.autores.aria.cabecalho!=='Aria · IA')falhas.push('Autoria/seq incorreta');
  if(metricas.notas.length!==3||metricas.notas.some(n=>n.role!=='note'||n.acoes!==0))falhas.push('Nota com transporte/semântica incorretos');
  if(!metricas.notas.find(n=>n.id==='inbox-314-nota-atendimento')?.texto.includes('Nota interna · só equipe')||!metricas.notas.find(n=>n.id==='inbox-314-nota-oportunidade')?.texto.includes('Nota da oportunidade · só equipe')||!metricas.notas.find(n=>n.id==='inbox-314-nota-sem-autor')?.texto.includes('Autor não informado'))falhas.push('Origem/autor da nota ausentes');
  if(!metricas.lida||!metricas.erroLegado)falhas.push('Status LIDA/FALHOU ausentes');
  if(!metricas.dias.some(d=>d.rotulo==='Hoje')||!metricas.dias.some(d=>d.rotulo==='Ontem')||metricas.dias.some(d=>d.desvioCentro>1))falhas.push('Dias/centralização incorretos');
  if(metricas.documento.height>height+1||metricas.documento.width>width+1||metricas.linhas.some(l=>l.x<metricas.thread.x-1||l.right>metricas.thread.right+1))falhas.push('Overflow de página/balão');
  const scroll=p.locator('section[aria-label="Conversa"] > div.overflow-y-auto');
  await scroll.evaluate(el=>el.scrollTop=0);await foto(p,tema+'-'+width+'-thread-topo.png');
  await p.locator('[data-mensagem-id="inbox-314-msg-voce"]').scrollIntoViewIfNeeded();await foto(p,tema+'-'+width+'-autores.png');
  await p.locator('[data-nota-id="inbox-314-nota-sem-autor"]').scrollIntoViewIfNeeded();await foto(p,tema+'-'+width+'-notas.png');
  const alvo=p.locator('[data-mensagem-id="inbox-314-msg-carlos-sequencia"] button[aria-haspopup="menu"]');await alvo.scrollIntoViewIfNeeded();await alvo.focus();
  // Aguarda a rolagem gerada pelo próprio preparo do teste antes de abrir o menu que fecha em scroll externo.
  await p.evaluate(()=>new Promise(resolve=>{let anterior='',iguais=0;function quadro(){const e=document.querySelector('[data-mensagem-id="inbox-314-msg-carlos-sequencia"] button'),r=e.getBoundingClientRect(),atual=[r.x,r.y].join(',');iguais=atual===anterior?iguais+1:0;anterior=atual;if(iguais>=3)resolve();else requestAnimationFrame(quadro);}requestAnimationFrame(quadro);}));
  await p.keyboard.press('Enter');
  const menu=p.getByRole('menu',{name:'Opções da mensagem',exact:true});await menu.waitFor({state:'visible'});
  const menuOk=await menu.evaluate(el=>{const r=el.getBoundingClientRect();return{dentro:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,foco:el.contains(document.activeElement)};});
  await p.keyboard.press('Escape');await menu.waitFor({state:'hidden'});const retorno=await alvo.evaluate(el=>document.activeElement===el);if(!menuOk.dentro||!menuOk.foco||!retorno)falhas.push('Menu305/foco fora');
  await p.goto(base+'/inbox?c=inbox-demo-lucas-307',{waitUntil:'domcontentloaded'});await p.locator('[data-vista][data-conectado="1"]').waitFor({state:'attached'});
  const evento=p.getByText('Transferido de Secretaria',{exact:true});await evento.waitFor({state:'visible'});await evento.scrollIntoViewIfNeeded();
  const transferencia=await evento.evaluate(el=>({foraHeader:!el.closest('header'),emThread:!!el.closest('section[aria-label="Conversa"]'),texto:el.textContent}));if(!transferencia.foraHeader||!transferencia.emThread)falhas.push('Transferência fora do evento');
  await foto(p,tema+'-'+width+'-transferencia.png');
  resultados.push({fonte,tema,width,height,contagem,autoriaAPI,metricas,menuOk,retorno,transferencia,falhas,erros,externos});console.log(tema,width,JSON.stringify({falhas,erros,externos,contagem}));await ctx.close();
 }
}finally{await browser.close();await writeFile(new URL('normais-final/medidas-normais.json',import.meta.url),JSON.stringify(resultados,null,2));}
if(resultados.length!==6||resultados.some(r=>r.falhas.length||r.erros.length||r.externos.length))throw Error('Prova normal314 registrou falha');
