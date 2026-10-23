import { describe, expect, it, vi } from "vitest";
import { itensDoMenuConversa } from "./MenuConversa";
import { AVISO_RECURSO_MOTOR } from "@/components/conversa/recursos-canal";
import { podeExecutar } from "@/server/inbox/permissoes";
import { Papel } from "@prisma/client";
const ids = ["naoLida", "fixar", "silenciar", "nota", "agendar", "pendentes", "buscar", "atribuir", "devolver", "convidar", "encerrar", "bloquear"];
const acoes = Object.fromEntries(ids.map(k => [k, vi.fn()]));
const menu = (pode: Parameters<typeof itensDoMenuConversa>[0]["pode"], ativo=false) => itensDoMenuConversa({ pode, acoes, fixada: ativo, silenciada: ativo });
describe("menu da conversa315", () => {
 it("ordem completa, divisores e ação pessoal real", () => {
  const m=menu(()=>true); expect(m.map(i=>i.id)).toEqual(ids);
  expect(m.filter(i=>i.divisorDepois).map(i=>i.id)).toEqual(["silenciar","buscar","convidar"]);
  m[0].aoEscolher(); expect(acoes.naoLida).toHaveBeenCalledOnce();
  expect(m.every(i=>typeof i.aoEscolher === "function")).toBe(true);
 });
 it("sem capacidade de negócio mantém pessoais; busca não anuncia função inexistente", () => {
  const m=menu(()=>false); expect(m.map(i=>i.id)).toEqual(["naoLida","fixar","silenciar","buscar"]);
  expect(m.find(i=>i.id==="buscar")).toMatchObject({desabilitado:true,dica:"Em breve"});
 });
 it("rótulos pessoais e bloqueio explicam a capacidade indisponível",()=>{
  const m=menu(()=>true,true); expect(m.find(i=>i.id==="fixar")).toMatchObject({rotulo:"Desafixar conversa",dica:"só você"});
  expect(m.find(i=>i.id==="silenciar")).toMatchObject({rotulo:"Reativar notificações",dica:"8 h · só você"});
  expect(m.find(i=>i.id==="bloquear")).toMatchObject({perigo:true,desabilitado:true,dica:AVISO_RECURSO_MOTOR});
  expect(m.some(i=>/status|arquivar|mesclar|exportar/i.test(i.rotulo))).toBe(false);
 });
 it("mapeia notaInterna e pendências usando capacidades reais de Financeiro na fila",()=>{
  const pode: Parameters<typeof itensDoMenuConversa>[0]["pode"] = a=>podeExecutar({id:"u",papeis:[Papel.FINANCEIRO]},a,{setor:"FINANCEIRO",responsavelId:null,linhaComercial:false,donoLinhaId:null});
  const m=menu(pode); expect(m.map(i=>i.id)).toContain("pendentes"); expect(m.map(i=>i.id)).toContain("agendar");
  expect(m.some(i=>i.id==="nota")).toBe(pode("notaInterna"));
  expect(menu(a=>a==="notaInterna").map(i=>i.id)).toEqual(["naoLida","fixar","silenciar","nota","buscar"]);
 });
});
