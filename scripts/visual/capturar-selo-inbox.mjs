#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright-core";
import { resolverBancoTeste } from "../test-profile.mjs";
import { autenticarApp } from "./espera-app.mjs";
import { TAMANHOS, cancelamentoDeMensagensRecuperado } from "./nucleo-captura.mjs";
const raiz = fileURLToPath(new URL("../../", import.meta.url));
const destino = path.join(raiz, "output/inbox-311-visual");
const AJUDA = "Uso: node scripts/visual/capturar-selo-inbox.mjs [--base http://localhost:3111]";
async function main() {
  const args=process.argv.slice(2); if(args.includes("--help")){process.stdout.write(AJUDA+"\n");return;}
  if(args.length && (args.length!==2||args[0]!=="--base"))throw Error(AJUDA);
  const base=new URL(args[1]??"http://localhost:3111");
  if(base.protocol!=="http:"||!["localhost","127.0.0.1"].includes(base.hostname)||!base.port||base.pathname!=="/"||base.search||base.hash||base.username||base.password)throw Error("Base local obrigatória.");
  const {url,perfil}=resolverBancoTeste(raiz);const db=new URL(url);
  if(perfil!=="dev-gravacoes"||!["localhost","127.0.0.1"].includes(db.hostname)||db.port!=="54329"||db.pathname!=="/erp_genius_test_dev_gravacoes"||db.search||db.hash)throw Error("Captura311 exige exclusivamente perfil local dev-gravacoes.");
  const demo=JSON.parse(await readFile(path.join(raiz,"tmp/visual/demo-ids.json"),"utf8"));
  const chaves=["mariana","ventura","beatriz","lucas","thiago","semNome","fernanda"];
  if(demo.perfil!==perfil||Object.keys(demo.ids).length!==7||chaves.some(k=>demo.ids[k]!=="inbox-demo-"+(k==="semNome"?"sem-nome":k)+"-307"))throw Error("IDs da fixture inesperados.");
  const prisma=new PrismaClient({datasources:{db:{url}}});
  try {
    const admin=await prisma.usuario.findUniqueOrThrow({where:{email:"admin@genius.com"}});
    const fixtures=await prisma.atendimentoWhatsApp.findMany({where:{id:{in:Object.values(demo.ids)}},include:{conversa:{include:{numero:true}}}});
    if(fixtures.length!==7||fixtures.some(a=>a.conversa.numeroId!=="inbox-demo-numero-307"||a.conversa.numero.driver!=="BAILEYS"||a.conversa.numero.sessao!=="DESCONECTADO"))throw Error("Fixture deve ser local e desconectada.");
    await prisma.$transaction(fixtures.map(a=>{const naoLida=[demo.ids.thiago,demo.ids.ventura].includes(a.id);const data={lidaAte:naoLida?null:new Date(),marcadaNaoLida:naoLida};return prisma.preferenciaConversaUsuario.upsert({where:{usuarioId_conversaId:{usuarioId:admin.id,conversaId:a.conversaId}},create:{usuarioId:admin.id,conversaId:a.conversaId,...data},update:data});}));
  } finally {await prisma.$disconnect();}
  await mkdir(destino,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM??"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--no-sandbox"]});
  const falhas=[],abortados=[],concluidos=new Set(),pendentes=[],capturas=[],fases=[];
  const contexto=await browser.newContext({viewport:{width:1440,height:900},locale:"pt-BR",timezoneId:"America/Sao_Paulo"});
  try {
    await contexto.route("**/*",route=>{const u=new URL(route.request().url());if(u.origin===base.origin)return route.continue();falhas.push("Tráfego externo: "+u.origin+u.pathname);return route.abort();});
    await contexto.addInitScript(()=>{
      const stats={sseAtivas:0,sseMaximas:0,sseCriadas:0,buscasAtivas:0,buscasMaximas:0,buscas:0,leituras:0};window.__inbox311=stats;
      const Nativa=window.EventSource;window.EventSource=class extends Nativa {constructor(url,opcoes){super(url,opcoes);this.conta=new URL(String(url),location.href).pathname==="/api/inbox/eventos";this.fechada=false;if(this.conta){stats.sseCriadas++;stats.sseMaximas=Math.max(stats.sseMaximas,++stats.sseAtivas);}}close(){if(this.conta&&!this.fechada){this.fechada=true;stats.sseAtivas--;}super.close();}};
      const buscar=window.fetch;window.fetch=async function(...args){const alvo=new URL(String(args[0] instanceof Request?args[0].url:args[0]),location.href);const conta=alvo.pathname==="/api/inbox/nao-lidas";if(conta){stats.buscas++;stats.buscasMaximas=Math.max(stats.buscasMaximas,++stats.buscasAtivas);}try{return await buscar.apply(this,args);}finally{if(conta)stats.buscasAtivas--;}};
    });
    const pagina=await contexto.newPage();
    function observar(p){p.on("pageerror",e=>falhas.push("pageerror: "+e.message));p.on("response",r=>{if(r.status()===404)falhas.push("404: "+r.url());});p.on("requestfailed",r=>abortados.push({url:r.url(),method:r.method(),erro:r.failure()?.errorText??""}));p.on("requestfinished",r=>{if(r.method()==="GET")pendentes.push(r.response().then(v=>{if(v?.ok())concluidos.add("GET "+r.url());}));});p.on("request",r=>{if(r.method()==="POST"&&r.headers()["next-action"])void p.evaluate(()=>{window.__inbox311.leituras++;}).catch(()=>{});});p.setDefaultTimeout(30000);}
    observar(pagina);await autenticarApp(contexto,base.origin,process.env.INBOX_VISUAL_EMAIL??"admin@genius.com",process.env.INBOX_VISUAL_SENHA??"genius123");await pagina.goto(base.origin+"/inbox",{waitUntil:"domcontentloaded"});
    const stats=async p=>p.evaluate(()=>window.__inbox311);
    const conferir=async p=>{await p.waitForFunction(()=>window.__inbox311?.sseCriadas>0&&window.__inbox311.buscas>0&&window.__inbox311.buscasAtivas===0);const s=await stats(p);if(s.sseAtivas!==1||s.sseMaximas!==1||s.buscasMaximas>1)throw Error("Concorrência inválida: "+JSON.stringify(s));return s;};
    async function fecharMenu(){const d=pagina.getByRole("dialog",{name:"Menu",exact:true});if(await d.isVisible()){await d.getByRole("button",{name:"Fechar",exact:true}).click();await d.waitFor({state:"hidden"});}await pagina.waitForFunction(()=>{const e=document.getElementById("menu-navegacao");return !e||(e.getBoundingClientRect().right<=1&&e.getAnimations().every(a=>a.playState!=="running"));});}
    async function contar(total,p=pagina){await p.waitForFunction(n=>[...document.querySelectorAll('a[href="/inbox"] .sr-only')].some(el=>el.parentElement?.firstChild?.textContent===String(n)),total);}
    async function fotos(fase,total){
      for(const tema of ["escuro","claro"])for(const [tamanho,[width,height]] of Object.entries(TAMANHOS)){
        await fecharMenu();await pagina.setViewportSize({width,height});await pagina.waitForFunction(()=>!document.querySelector('aside[role="dialog"][aria-label="Menu"]'));
        const escuro=await pagina.locator("html").evaluate(e=>e.classList.contains("dark"));if(escuro!==(tema==="escuro"))await pagina.getByRole("button",{name:"Alternar tema",exact:true}).click();
        if(width<768){await pagina.getByRole("button",{name:/^Abrir menu/}).click();await pagina.getByRole("dialog",{name:"Menu",exact:true}).waitFor({state:"visible"});await pagina.waitForFunction(()=>{const e=document.querySelector('aside[role="dialog"][aria-label="Menu"]');if(!e)return false;const a=e.getBoundingClientRect();return a.left>=-1&&a.right<=innerWidth+1&&e.getAnimations().every(v=>v.playState!=="running");});}
        await contar(total);await pagina.evaluate(()=>document.fonts.ready);await pagina.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=="running"||a.effect?.getTiming().iterations===Infinity));const sidebarLargura=await pagina.locator('aside[class*="w-56"]').evaluate(e=>e.getBoundingClientRect().width);if(width>=768&&sidebarLargura!==224)throw Error("Sidebar mudou de largura: "+sidebarLargura);const arquivo="app-"+tema+"-"+tamanho+"-"+fase+".png";
        await pagina.screenshot({path:path.join(destino,arquivo),style:'[data-nextjs-toast]:not(:has([data-has-issues="true"])) { visibility: hidden !important; }'});capturas.push({fase,total,tema,tamanho,width,height,sidebarLargura,arquivo});process.stdout.write(arquivo+" OK\n");
      }fases.push({fase,total,stats:await conferir(pagina)});
    }
    async function navegar(rotulo){await fecharMenu();await pagina.setViewportSize({width:1440,height:900});await pagina.getByRole("navigation",{name:"Navegação principal",exact:true}).getByRole("link",{name:new RegExp("^"+rotulo)}).click();}
    await contar(2);await fotos("antes",2);await fecharMenu();await pagina.setViewportSize({width:1440,height:900});await pagina.getByRole("region",{name:"Conversas",exact:true}).getByText("Thiago Moreira",{exact:true}).click();await pagina.getByRole("region",{name:"Conversa",exact:true}).getByText("Podem me chamar amanhã?",{exact:true}).waitFor({state:"visible"});await contar(1);await fotos("lida",1);
    await navegar("Home");await pagina.waitForURL("**/home");
    const segunda=await contexto.newPage();observar(segunda);await segunda.goto(base.origin+"/home",{waitUntil:"domcontentloaded"});await contar(1,segunda);await conferir(segunda);
    const entrada=()=>execFileSync(process.execPath,[path.join(raiz,"node_modules/tsx/dist/cli.mjs"),path.join(raiz,"scripts/visual/demo-inbox.ts"),"--entrada","thiago"],{cwd:raiz,encoding:"utf8"});
    entrada();await contar(2);await contar(2,segunda);await navegar("Inbox");await pagina.waitForURL("**/inbox");await fotos("entrada-sem-selecao",2);fases.push({fase:"segunda-aba",total:2,stats:await conferir(segunda)});
    await fecharMenu();await pagina.setViewportSize({width:1440,height:900});await pagina.getByRole("region",{name:"Conversas",exact:true}).getByText("Thiago Moreira",{exact:true}).click();await contar(1);const leiturasAntes=(await stats(pagina)).leituras;const antes=await pagina.getByRole("region",{name:"Conversa",exact:true}).getByText("Entrada fictícia #311 para thiago.",{exact:true}).count();entrada();await pagina.waitForFunction(n=>[...document.querySelectorAll('[aria-label="Conversa"] *')].filter(e=>e.childElementCount===0&&e.textContent==="Entrada fictícia #311 para thiago.").length>n,antes);await pagina.waitForFunction(n=>window.__inbox311.leituras>n&&window.__inbox311.buscasAtivas===0,leiturasAntes);await contar(1);await fotos("entrada-chat-aberto",1);
    if((await stats(pagina)).leituras-leiturasAntes>2)throw Error("Leitura repetiu em loop.");
    await Promise.all(pendentes);const diagnosticos=[];for(const r of abortados){if(cancelamentoDeMensagensRecuperado(r,concluidos,base.origin,true))diagnosticos.push(r);else falhas.push(r);}
    await writeFile(path.join(destino,"manifesto.json"),JSON.stringify({perfil,base:base.origin,capturas,fases,falhas,diagnosticos,ruling:"Após2→1, navegarHome desmonta conversa selecionada; entrada CLI em duasabas sobe2. Chataberto reconcilia1 sem loops."},null,2)+"\n");
    if(falhas.length)throw Error("Falhas registradas no manifesto: "+falhas.length);process.stdout.write("Captura311 concluída: "+capturas.length+" PNGs;24esperados.\n");
  }catch(erro){await writeFile(path.join(destino,"manifesto-incompleto.json"),JSON.stringify({perfil,base:base.origin,capturas,fases,falhas,erro:String(erro)},null,2)+"\n");throw erro;}finally{await contexto.close();await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
