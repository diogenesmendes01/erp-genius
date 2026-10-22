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
 for(const width of [1440,1024,390]){
  await p.setViewportSize({width,height:width===390?844:900});await p.goto(`${base}/inbox?c=inbox-demo-mariana-307`);
  await esperarConteudoApp(p,"conversa",width===1440?"desktop":width===1024?"tablet":"celular");
  const painel=p.locator('#painel-contato');if(!(await painel.isVisible()))await p.getByRole('button',{name:'Painel do contato',exact:true}).click();
  await painel.getByRole('button',{name:'Registrar opt-out',exact:true}).focus(); await painel.getByRole('button',{name:'Registrar opt-out',exact:true}).click();
  const confirmacao=p.getByRole('alertdialog',{name:'Registrar o opt-out de Mariana Costa?',exact:true});await confirmacao.waitFor({state:'visible'});
  await p.keyboard.press('Escape');await confirmacao.waitFor({state:'hidden'});
  const ativo=await p.evaluate(()=>({tag:document.activeElement?.tagName,rotulo:document.activeElement?.getAttribute('aria-label'),texto:document.activeElement?.textContent?.slice(0,60)}));
  const permanece=await painel.isVisible(), foco=await painel.getByRole('button',{name:'Registrar opt-out',exact:true}).evaluate((el)=>document.activeElement===el);
  resultados.push({width,painelPermanece:permanece,focoRetorna:foco,ativo,acaoConfirmada:false});process.stdout.write(`${width}: painel=${permanece} foco=${foco} ativo=${JSON.stringify(ativo)}\n`);
 }
 await ctx.close();
}finally{await browser.close();await writeFile(new URL('dialogo-filho.json',import.meta.url),JSON.stringify(resultados,null,2));}
// Ruling integrador: origem disabled de OptOut é preexistente e será corrigida separadamente.
// Mantém focoRetorna/ativo no JSON, mas este gate308 exige fechar somente o filho e conservar o painel.
if(resultados.some((r)=>!r.painelPermanece))throw new Error('Escape atingiu painel por trás da confirmação');
