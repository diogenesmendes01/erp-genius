import {describe,it,expect} from "vitest";
import {AcaoAgenteIATipo} from "@prisma/client";
import {textoAlteracaoAria,faixaConfianca} from "./atividade-aria-texto";

describe("texto das alterações Aria",()=>{
 it("resume ações sem expor IDs como nomes",()=>{
  expect(textoAlteracaoAria("TAG",{nome:"Interessado",tagId:"interno"})).toBe("Adicionou a tag Interessado");
  expect(textoAlteracaoAria("TAG",{tagId:"interno"})).toBe("Adicionou uma tag");
  expect(textoAlteracaoAria("CRIAR_TAREFA",{titulo:"Telefonar"})).toBe("Criou a tarefa Telefonar");
  expect(textoAlteracaoAria("ATUALIZAR_CAMPO",{nomeCampo:"Interesse"})).toBe("Preencheu Interesse");
 });
 it("aceita payload desconhecido sem interpolar objetos",()=>{
  for(const p of [null,[],"segredo",{nome:{}},{titulo:42}]){
   for(const acao of Object.values(AcaoAgenteIATipo)){
    const texto=textoAlteracaoAria(acao,p);
    expect(texto).not.toContain("[object Object]");
    expect(texto).not.toContain("segredo");
    expect(texto.length).toBeGreaterThan(0);
   }
  }
 });
 it.each([
  ["MOVER_ETAPA",{para:"QUALIFICADO"},"Moveu para Qualificado"],
  ["MARCAR_PERDIDO",{},"Marcou como perdido"],
  ["AGENDAR_MENSAGEM",{},"Agendou uma mensagem"],
  ["NOTA_INTERNA",{},"Registrou uma nota interna"],
  ["RESPONDER",{},"Preparou uma resposta"],
  ["ENVIAR_DOCUMENTO",{},"Preparou o envio de documento"],
  ["CONDICAO_COMERCIAL",{},"Preparou uma condição comercial"],
  ["HANDOFF",{},"Pediu ajuda a uma pessoa"],
 ] as const)("descreve %s em português",(acao,payload,esperado)=>{
  expect(textoAlteracaoAria(acao,payload)).toBe(esperado);
 });
 it("não converte etapa desconhecida em rótulo ou ID",()=>{
  expect(textoAlteracaoAria("MOVER_ETAPA",{para:"lead-interno"})).toBe("Moveu a etapa");
 });
 it("usa os limites publicados inclusivos, inclusive75/55",()=>{
  const f={executaAPartirDe:75,transfereAbaixoDe:55};
  expect([54,55,74,75,100].map(v=>faixaConfianca(v,f))).toEqual(["baixa","media","media","alta","alta"]);
  expect(faixaConfianca(79,{executaAPartirDe:80,transfereAbaixoDe:50})).toBe("media");
 });
});
it("444 C4 fallbacks históricos usam passado sem modificar rótulo neutro da sugestão",async()=>{
 const {ACAO_AGENTE_IA_LABEL}=await import("@/lib/labels");
 for(const [acao,texto] of [["TAG","Adicionou uma tag"],["ATUALIZAR_CAMPO","Preencheu um campo"],["MOVER_ETAPA","Moveu a etapa"],["CRIAR_TAREFA","Criou uma tarefa"]] as const){
  expect(textoAlteracaoAria(acao,null)).toBe(texto);
  expect(textoAlteracaoAria(acao,{tagId:"id-interno",campoId:"campo-interno",para:"etapa-interna"})).toBe(texto);
 }
 expect(ACAO_AGENTE_IA_LABEL.TAG).toBe("Aplicar tag");expect(ACAO_AGENTE_IA_LABEL.MOVER_ETAPA).toBe("Mover de etapa");
});
