import { chromium } from "playwright-core";
import { writeFile } from "node:fs/promises";
import { autenticarApp, esperarConteudoApp } from "../../scripts/visual/espera-app.mjs";
if (!process.env.INBOX_VISUAL_EMAIL || !process.env.INBOX_VISUAL_SENHA) throw new Error("Defina as credenciais fictícias locais por ambiente.");
const base="http://localhost:3110",resultados=[];
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
try {
 const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:"pt-BR"});
 await ctx.route("**/*",(r)=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await autenticarApp(ctx,base,process.env.INBOX_VISUAL_EMAIL,process.env.INBOX_VISUAL_SENHA);
 const p=await ctx.newPage();
 for(const width of [1024,390]){
  await p.setViewportSize({width,height:width===390?844:900});await p.goto(`${base}/inbox?c=inbox-demo-mariana-307`);
  await esperarConteudoApp(p,"conversa",width===1440?"desktop":width===1024?"tablet":"celular");
  const painel=p.locator('#painel-contato');if(!(await painel.isVisible()))await p.getByRole('button',{name:'Painel do contato',exact:true}).click();
  const raizes=await p.evaluate(()=>['section[aria-label="Conversas"]','section[aria-label="Conversa"]','aside.sticky'].map(seletor=>({seletor,inert:!!document.querySelector(seletor)?.closest('[inert]')})));
  const externo=p.locator('summary').filter({hasText:'Abrir atendimento'});
  const alvo=await externo.evaluate((el)=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,inert:!!el.closest('[inert]'),alvoClicavel:el.contains(document.elementFromPoint(x,y)),texto:el.textContent};});
  const cdp=await ctx.newCDPSession(p); const arvore=await cdp.send('Accessibility.getFullAXTree');
  const dom=await cdp.send('DOM.getDocument'); const nosAT=[];
  for(const seletor of ['section[aria-label="Conversas"]','section[aria-label="Conversa"]','aside.sticky']) { const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:seletor}); const ax=await cdp.send('Accessibility.getPartialAXTree',{nodeId});nosAT.push({seletor,ignorado:ax.nodes[0].ignored}); }
  const botoesExternos=arvore.nodes.filter(n=>!n.ignored && /Abrir atendimento/.test(n.name?.value||''));
  await externo.evaluate((el)=>el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();window.__cliqueExterno308=true;},{capture:true,once:true}));
  await p.mouse.click(alvo.x,alvo.y);
  resultados.push({width,raizes,nosAT,role:await painel.getAttribute('role'),modal:await painel.getAttribute('aria-modal'),externo:alvo,cliqueRecebido:await p.evaluate(()=>window.__cliqueExterno308===true),arvoreContemNovo:botoesExternos.length>0, nosATExternos:botoesExternos.map(n=>({nome:n.name?.value,role:n.role?.value})),acaoExecutada:false});
  await p.setViewportSize({width:1400,height:900});
  const colunaSolta=await p.evaluate(()=>!document.querySelector('section[aria-label="Conversa"]')?.closest('[inert]')&&!document.querySelector('aside.sticky')?.closest('[inert]'));
  await p.setViewportSize({width:1024,height:768});await painel.waitFor({state:'hidden'});await p.getByRole('button',{name:'Painel do contato',exact:true}).click();
  await p.setViewportSize({width:959,height:768}); await painel.waitFor({state:'hidden'});
  const umaSolta=await p.evaluate(()=>!document.querySelector('section[aria-label="Conversa"]')?.closest('[inert]')&&!document.querySelector('aside.sticky')?.closest('[inert]'));
  Object.assign(resultados.at(-1),{colunaSolta,umaSolta});

 }
 await ctx.close();
}finally{await browser.close();await writeFile(new URL('semantica-overlay.json',import.meta.url),JSON.stringify(resultados,null,2));}
// Ruling integrador: origem disabled de OptOut é preexistente e será corrigida separadamente.
// Mantém focoRetorna/ativo no JSON, mas este gate308 exige fechar somente o filho e conservar o painel.
console.log(JSON.stringify(resultados,null,2));
if(resultados.some(r=>!r.externo.inert||r.cliqueRecebido||r.arvoreContemNovo||r.raizes.some(n=>!n.inert)||r.nosAT.some(n=>!n.ignorado)||!r.colunaSolta||!r.umaSolta))throw new Error("Fundo modal acessível");
