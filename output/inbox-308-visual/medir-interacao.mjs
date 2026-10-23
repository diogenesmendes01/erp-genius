import { chromium } from "playwright-core";
import { writeFile } from "node:fs/promises";
import { autenticarApp, esperarConteudoApp } from "../../scripts/visual/espera-app.mjs";
if (!process.env.INBOX_VISUAL_EMAIL || !process.env.INBOX_VISUAL_SENHA) throw new Error("Defina as credenciais fictícias locais em INBOX_VISUAL_EMAIL/INBOX_VISUAL_SENHA.");
const base = "http://localhost:3110";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const casos = [[1440,900],[1024,768],[390,844],[700,768],[768,768],[959,768],[960,768],[1280,768],[1400,768],[1440,500],[1024,500],[390,500],[700,500],[768,500],[960,500],[1400,500]];
const resultados = [];
try {
 for (const tema of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  await ctx.addInitScript((tema) => localStorage.setItem("tema", tema), tema);
  await ctx.route("**/*", (r) => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
  await autenticarApp(ctx, base, process.env.INBOX_VISUAL_EMAIL, process.env.INBOX_VISUAL_SENHA);
  const p = await ctx.newPage(), erros = []; p.on("pageerror", (e) => erros.push(e.message)); p.on("console", (e) => { if (/hydration|hydrating|did not match|same key|unique.*key/i.test(e.text())) erros.push(e.text()); });
  for (const [width,height] of casos) {
   await p.setViewportSize({width,height}); await p.goto(`${base}/inbox?c=inbox-demo-beatriz-307`);
   await esperarConteudoApp(p,"humano-compositor",width>=1400?"desktop":width>=960?"tablet":"celular");
   const toggle = p.locator('button[aria-controls="painel-contato"]'), painel = p.locator('#painel-contato');
   const falhas = [];
   if (await painel.isVisible()) { await toggle.click(); await painel.waitFor({state:"hidden"}); }
   await toggle.focus(); await p.keyboard.press("Enter"); await painel.waitFor({state:"visible"});
   await p.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Fechar painel do contato");
   const aberto = await painel.evaluate((el) => { const r=el.getBoundingClientRect(); return {width:r.width,height:r.height,x:r.x,y:r.y,right:r.right,bottom:r.bottom,inert:el.inert,role:el.getAttribute("role")}; });
   if (aberto.right>width+1 || aberto.bottom>height+1 || aberto.y<0 || aberto.inert) falhas.push("painel fora/inert");
   if(width<1400) {
    await painel.evaluate((el) => { const campos=[...el.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]')].filter((e)=>e.getBoundingClientRect().width>0 && !e.closest('[inert]')); campos.at(-1)?.focus(); });
    await p.keyboard.press("Tab");
    if(!(await painel.evaluate((el)=>el.contains(document.activeElement)))) falhas.push("Tab escapou do painel");
   }
   await p.keyboard.press("Escape"); await painel.waitFor({state:"hidden"});
   const retorno = await toggle.evaluate((el)=>document.activeElement===el); if(!retorno) falhas.push("foco não retornou");
   // Bridge em lista, formulário aberto e sino real (sem abrir destino/ação de negócio).
   await p.goto(`${base}/inbox`); await esperarConteudoApp(p,"sem-selecao",width>=960?"tablet":"celular");
   const resumo=p.locator('summary').filter({hasText:"Abrir atendimento"}); await resumo.click();
   const form=p.getByRole('region',{name:"Abrir atendimento",exact:true}); await form.waitFor({state:"visible"});
   await form.getByRole('button',{name:'Abrir atendimento',exact:true}).scrollIntoViewIfNeeded();
   const formulario=await form.evaluate((el)=>{const b=el.querySelector('form button'),r=b.getBoundingClientRect(),l=document.querySelector('section[aria-label="Conversas"]');return{botao:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom},listaAltura:l.getBoundingClientRect().height,documento:document.documentElement.scrollHeight,viewport:innerHeight};});
   if(formulario.botao.bottom>height+1 || formulario.botao.y<0 || formulario.documento>height+1) falhas.push("formulário inacessível/scroll externo");
   if(width===390 && height===500) await p.screenshot({path:new URL(`${width}x${height}-${tema}-formulario-final.png`,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,"$1")});
   const sino=p.getByRole('button',{name:/^Notificações/}); await sino.scrollIntoViewIfNeeded(); await sino.click();
   const dialogo=p.getByRole('dialog',{name:"Notificações",exact:true}); await dialogo.waitFor({state:"visible"}); await p.keyboard.press("Escape"); await dialogo.waitFor({state:"hidden"});
   if(!(await sino.evaluate((el)=>document.activeElement===el))) falhas.push("sino sem retorno de foco");
   if([390,1024,1440].includes(width)) await p.screenshot({path:new URL(`${width}x${height}-${tema}-formulario.png`,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,"$1"),style:'[data-nextjs-toast]:not(:has([data-has-issues="true"])) { visibility: hidden !important; }'});
   resultados.push({tema,width,height,aberto,retorno,formulario,falhas,pageerrors:[...erros]}); process.stdout.write(`${tema} ${width}x${height}: ${falhas.join(',')||'OK'}\n`);
  }
  // Mudanças de modo sem desmontagem nem foco em nó oculto.
  await p.setViewportSize({width:1024,height:768}); await p.goto(`${base}/inbox?c=inbox-demo-beatriz-307`); await esperarConteudoApp(p,"humano-compositor","tablet");
  await p.getByRole('button',{name:"Painel do contato",exact:true}).click();
  await p.locator('#painel-contato').evaluate((el)=>{window.__painelMedido=el;});
  await p.setViewportSize({width:1400,height:768}); await p.locator('#painel-contato button').first().focus(); await p.setViewportSize({width:959,height:768});
  await p.locator('#painel-contato').waitFor({state:'hidden'});
  const resize=await p.evaluate(()=>({mesmaMontagem:document.querySelector('#painel-contato')===window.__painelMedido,ativo:document.activeElement?.getAttribute('aria-controls'),focoVisivel:document.activeElement?.getBoundingClientRect().width>0,pressionado:document.querySelector('button[aria-controls="painel-contato"]').getAttribute('aria-pressed')}));
  resultados.push({tema,tipo:"resize",...resize,falhas:resize.mesmaMontagem&&resize.focoVisivel&&resize.ativo==='painel-contato'?[]:['resize/foco falhou']});
  await ctx.close();
 }
} finally {await browser.close();await writeFile(new URL('interacao-formulario.json',import.meta.url),JSON.stringify(resultados,null,2));}
if(resultados.some((r)=>r.falhas.length||r.pageerrors?.length)) throw new Error('Interação registrou falhas');
