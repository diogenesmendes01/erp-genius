import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SeletorNumero } from "./SeletorNumero";
import type { OpcoesFiltroInbox } from "@/server/inbox/opcoes-filtro";
const numeros:OpcoesFiltroInbox["numeros"]=[{id:"n1",rotulo:"Central",saude:"conectado"},{id:"n2",rotulo:"Secretaria",saude:"instavel"},{id:"n3",rotulo:"Recepção",saude:"desconectado"}];
const html=(p={})=>renderToStaticMarkup(createElement(SeletorNumero,{numeros,selecionado:null,podeGerenciar:false,aoEscolher:()=>{},...p}));
it("D17 mantém seletor com saúde pública para qualquer papel e só Admin recebe Gerenciar",()=>{
 expect(html()).toContain("Todos os números · 1 conectado");expect(html()).not.toContain('aria-modal');
 const h=html({abertoInicial:true,selecionado:"n2",podeGerenciar:true});
 for(const t of ['Ver conversas de','Instável','bg-amber-600','bg-brand-solid','bg-gray-400','aria-pressed="true"','href="/configuracao/whatsapp"','Gerenciar números em Configurações'])expect(h).toContain(t);
 expect(html({abertoInicial:true})).not.toContain("Gerenciar números");expect(h).not.toContain("telefone");
});
it("rótulo representa seleção conhecida e plural0/2 sem contar instáveis",()=>{
 expect(html({selecionado:"n2"})).toContain("Secretaria");expect(html({numeros:[]})).toContain("0 conectados");
 expect(html({numeros:[numeros[0],{id:"n4",rotulo:"Comercial",saude:"conectado"}]})).toContain("2 conectados");
 expect(html({selecionado:"fora-do-escopo"})).toContain("Todos os números");
});
