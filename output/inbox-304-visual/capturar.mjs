import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const fase = process.argv[2] ?? "antes";
if (!["antes", "depois", "diagnostico"].includes(fase)) throw new Error("Fase inválida");
const base = "http://localhost:3110";
const atendimento = process.env.INBOX_VISUAL_ATENDIMENTO;
const email = process.env.INBOX_VISUAL_EMAIL;
const senha = process.env.INBOX_VISUAL_PASSWORD;
if (!atendimento || !email || !senha) throw new Error("Informe apenas credenciais/atendimento de fixture local pelas variáveis INBOX_VISUAL_*. Não as publique.");
const pasta = path.resolve("output/inbox-304-visual", fase);
await fs.mkdir(pasta, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const resultados = [];
try {
  for (const [width, height] of [[1440,900],[1024,768],[390,844],[700,768],[390,500],[1440,500]]) {
    for (const tema of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: {width,height}, deviceScaleFactor: 1 });
      await context.addInitScript((t) => localStorage.setItem("tema",t), tema);
      await context.route("**/*", (route) => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      const {csrfToken} = await (await context.request.get(`${base}/api/auth/csrf`)).json();
      const auth = await context.request.post(`${base}/api/auth/callback/credentials`, {
        headers: {"X-Auth-Return-Redirect":"1"}, form: {csrfToken,email,senha,callbackUrl:`${base}/inbox`},
      });
      if (!auth.ok()) throw new Error(`Autenticação local falhou: ${auth.status()}`);
      const page = await context.newPage(); page.setDefaultTimeout(120_000);
      const erros = []; page.on("pageerror",e=>erros.push(e.message));
      for (const selecionado of [false,true]) {
        await page.goto(`${base}/inbox${selecionado ? `?c=${atendimento}` : ""}`, {waitUntil:"domcontentloaded"});
        await page.locator("[data-vista]").waitFor();
        await page.evaluate(()=>document.fonts.ready);
        if (selecionado) await page.getByRole("region",{name:"Conversa",exact:true}).getByText("Tenho interesse em inglês.",{exact:true}).waitFor();
        await page.waitForTimeout(200);
        const metricas = await page.evaluate(() => {
          const rect=(el)=>{if(!el)return null;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {top:r.top,bottom:r.bottom,width:r.width,height:r.height,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,overflowY:s.overflowY,paddingTop:s.paddingTop,paddingBottom:s.paddingBottom};};
          const inbox=document.querySelector("[data-vista]"),main=document.querySelector("main#conteudo"),pagina=main?.lastElementChild;
          const barra=[...document.querySelectorAll("header")].find(h=>h.classList.contains("md:hidden"));
          return {formularioRegiao:rect(document.querySelector('[role="region"][aria-label="Abrir atendimento"]')),filtrosRegiao:rect(document.querySelector('[role="region"][aria-label="Filtros de conversas"]')),cabecalhoThread:rect(document.querySelector('section[aria-label="Conversa"] > header')),innerHeight,documentHeight:document.documentElement.scrollHeight,documentWidth:document.documentElement.scrollWidth,semRolagemExterna:document.documentElement.scrollHeight<=innerHeight,main:rect(main),pagina:rect(pagina),barra:rect(barra),form:rect(document.querySelector('button[type="submit"]')?.closest("form")??[...document.querySelectorAll("form")].find(f=>f.textContent.includes("Abrir atendimento"))),inbox:rect(inbox),lista:rect(document.querySelector('section[aria-label="Conversas"] > .flex-1.overflow-y-auto')),thread:rect(document.querySelector('section[aria-label="Conversa"] > .flex-1.overflow-y-auto'))};
        });
        const provaScroll = await page.evaluate(() => ["Conversas","Conversa"].map(nome=>{
          const el=document.querySelector(`section[aria-label="${nome}"] > .flex-1.overflow-y-auto`);
          if (!el || el.closest("section").getBoundingClientRect().height===0) return {nome,visivel:false};
          const prova=document.createElement("div");prova.style.height="2000px";prova.setAttribute("aria-hidden","true");el.appendChild(prova);
          const anterior=el.scrollTop;el.scrollTop=50;const moveu=el.scrollTop>0;el.scrollTop=anterior;prova.remove();
          return {nome,visivel:true,moveu,altura:el.clientHeight};
        }));
        const controlesAcessiveis = await page.evaluate(() => [...document.querySelectorAll('[role="region"][aria-label="Abrir atendimento"], [role="region"][aria-label="Filtros de conversas"], section[aria-label="Conversa"] > header')].filter(el=>el.getBoundingClientRect().height>0).map(regiao=>{
          const anteriores=[];
          for(let el=regiao;el;el=el.parentElement) anteriores.push([el,el.scrollTop]);
          const controles=[...regiao.querySelectorAll('select,input,button,a[href]')].filter(el=>el.getBoundingClientRect().height>0);
          const alcancaveis=controles.map(el=>{el.scrollIntoView({block:"nearest",inline:"nearest"});const r=el.getBoundingClientRect(),p=regiao.getBoundingClientRect();return r.top>=p.top-1&&r.bottom<=p.bottom+1;});
          for(const [el,top] of anteriores) el.scrollTop=top;
          return {regiao:regiao.getAttribute("aria-label")??"cabeçalho da conversa",controles:controles.length,todosAlcancaveis:alcancaveis.every(Boolean)};
        }));
        const nome=`${width}x${height}-${tema}-${selecionado?"selecionado":"lista"}`;
        await page.screenshot({path:path.join(pasta,`${nome}.png`),fullPage:true});
        resultados.push({width,height,tema,selecionado,formulario:"aberto (estado atual da página)",...metricas,provaScroll,controlesAcessiveis,erros:[...erros]});
        console.log(JSON.stringify({fase,width,height,tema,selecionado,documentHeight:metricas.documentHeight,inboxHeight:metricas.inbox?.height,barraHeight:metricas.barra?.height,formHeight:metricas.form?.height,semRolagemExterna:metricas.semRolagemExterna,provaScroll}));
      }
      await context.close();
    }
  }
} finally {await browser.close();}
await fs.writeFile(path.join(pasta,"metricas.json"),JSON.stringify(resultados,null,2)+"\n");

if (fase === "depois" && resultados.some(r=>!r.semRolagemExterna || r.provaScroll.some(s=>s.visivel&&!s.moveu) || r.controlesAcessiveis.some(c=>!c.todosAlcancaveis))) {
  throw new Error("Falha de geometria, rolagem interna ou acesso a controles; verificar metricas.json local.");
}
