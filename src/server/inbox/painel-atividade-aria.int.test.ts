import {afterAll,beforeEach,expect,it} from "vitest";
import {Papel,type StatusAcaoAgenteIA} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import {truncarBanco,criarUsuario} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {configPadrao} from "@/server/aria/config-schema";
import {carregarCabecalhoPainel} from "./painel-detalhes";
import {carregarAtividadePainel} from "./painel-atividade";
import {carregarAriaAtividade} from "./painel-atividade-aria";
beforeEach(()=>truncarBanco());afterAll(()=>prisma.$disconnect());
async function cenario(){
 const c=await cenarioPerda328();
 await prisma.atendimentoWhatsApp.update({where:{id:c.a.id},data:{responsavelId:c.dono.id}});
 const m=await prisma.mensagemWhatsApp.create({data:{atendimentoId:c.a.id,conversaId:c.conversa.id,numeroId:c.numero.id,direcao:"ENTRADA",corpo:"Fixture334",driver:"MOTOR",status:"ENTREGUE"}});
 const turno=await prisma.turnoAgenteIA.create({data:{ancoraMensagemId:m.id,atendimentoId:c.a.id,tipo:"ATENDIMENTO",resultado:"EM_ANDAMENTO"}});
 const criar=(id:string,status:StatusAcaoAgenteIA="EXECUTADA",oportunidadeId:string=c.op.id)=>prisma.acaoAgenteIA.create({data:{id,turnoId:turno.id,atendimentoId:c.a.id,oportunidadeId,acao:"NOTA_INTERNA",modoConfigurado:"EXECUTA",status,confianca:77,payload:{},reversivel:true,criadoEm:new Date("2026-10-25T10:00Z")}});
 return {...c,criar,turno};
}
it("334 leitor sem decisão vê histórico, responsável D1 recebe botão",async()=>{
 const c=await cenario(),prof=await criarUsuario([Papel.PROFESSOR]);
 await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.a.id,usuarioId:prof.id,concedenteId:c.dono.id,inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+60000),motivo:"Leitura334"}});
 await c.criar("334-a");
 expect((await carregarAriaAtividade(prof,c.a.id)).alteracoes).toMatchObject([{id:"334-a",podeDesfazer:false}]);
 expect((await carregarAriaAtividade(c.dono,c.a.id)).alteracoes).toMatchObject([{id:"334-a",podeDesfazer:true}]);
});
it("334 preenche30 após excluir mais de100 ações de lead oculto e conta mesma lista",async()=>{
 const c=await cenario(),outro=await criarUsuario([Papel.VENDEDOR]);
 const op=await prisma.oportunidade.create({data:{nome:"Oculta334",vendedorDonoId:outro.id}});
 for(let i=0;i<31;i++)await c.criar("334-a-"+String(i).padStart(3,"0"),i===30?"DESFEITA":"EXECUTADA");
 for(let i=0;i<105;i++)await c.criar("334-z-"+String(i).padStart(3,"0"),"EXECUTADA",op.id);
 const r=await carregarAriaAtividade(c.dono,c.a.id);
 expect(r.alteracoes).toHaveLength(30);expect(r.alteracoes[0].id).toBe("334-a-030");expect(r.alteracoes.at(-1)?.id).toBe("334-a-001");expect(r.contadorAtividade).toBe(29);
 expect(r.aria?.ultimaAcao?.texto).not.toContain("Oculta334");
 expect((await carregarCabecalhoPainel(c.dono,c.a.id))?.contadorAtividade).toBe(29);
 expect((await carregarAtividadePainel(c.dono,c.a.id))?.alteracoes.map(a=>a.id)).toEqual(r.alteracoes.map(a=>a.id));
});
it("334 configuração publicada soberana, rascunho ignorado, fallback canônico",async()=>{
 const c=await cenario();await c.criar("334-a");
 expect((await carregarAriaAtividade(c.dono,c.a.id)).aria?.faixa).toEqual({executaAPartirDe:80,transfereAbaixoDe:50});
 const config=configPadrao();config.confianca={...config.confianca,executaAPartirDe:75,transfereAbaixoDe:55};
 await prisma.versaoAgenteIA.create({data:{numero:1,status:"PUBLICADA",config,criadaPorId:c.dono.id}});
 await prisma.versaoAgenteIA.create({data:{numero:2,status:"RASCUNHO",config:configPadrao(),criadaPorId:c.dono.id}});
 expect((await carregarAriaAtividade(c.dono,c.a.id)).aria?.faixa).toEqual({executaAPartirDe:75,transfereAbaixoDe:55});
 await prisma.versaoAgenteIA.updateMany({where:{status:"PUBLICADA"},data:{config:{invalida:true}}});
 await expect(carregarAriaAtividade(c.dono,c.a.id)).rejects.toThrow();
});
it("334 fora do escopo não expõe lista ou configuração",async()=>{
 const c=await cenario(),outro=await criarUsuario([Papel.VENDEDOR]);await c.criar("334-a");
 expect(await carregarAriaAtividade(outro,c.a.id)).toEqual({aria:null,alteracoes:[],contadorAtividade:0});
 await prisma.atendimentoWhatsApp.update({where:{id:c.a.id},data:{finalidade:"SECRETARIA",leadId:null}});
 const admin=await criarUsuario([Papel.ADMINISTRADOR]);expect(await carregarAriaAtividade(admin,c.a.id)).toEqual({aria:null,alteracoes:[],contadorAtividade:0});
});
it("334 última ação e Pessoa usam a mesma autorização, sem fallback de IDs",async()=>{
 const c=await cenario(),outro=await criarUsuario([Papel.VENDEDOR]);
 const pessoa=await prisma.pessoa.create({data:{nome:"Visível334"}}),oculta=await prisma.pessoa.create({data:{nome:"Oculta334"}});
 await prisma.oportunidade.update({where:{id:c.op.id},data:{pessoaId:pessoa.id}});
 const op=await prisma.oportunidade.create({data:{nome:"Oculta334",pessoaId:oculta.id,vendedorDonoId:outro.id}});
 for(const [id,status,leadId,titulo] of [["334-a","EXECUTADA",c.op.id,"Visível334"],["334-z","EXECUTADA",op.id,"Segredo334"],["334-zz","SIMULADA",c.op.id,"Simulada334"]] as const){
  const acao=await c.criar(id,status,leadId);await prisma.acaoAgenteIA.update({where:{id:acao.id},data:{acao:"CRIAR_TAREFA",payload:{titulo}}});
 }
 const incompat=await c.criar("334-zzz");await prisma.acaoAgenteIA.update({where:{id:incompat.id},data:{acao:"TAG",payload:{pessoaId:oculta.id,nome:"Sigilosa334",tagId:"id-interno"}}});
 const r=await carregarAriaAtividade(c.dono,c.a.id);expect(r.alteracoes.map(a=>a.id)).toEqual(["334-a"]);expect(r.aria?.ultimaAcao?.texto).toBe("Criou a tarefa Visível334");expect(JSON.stringify(r)).not.toContain("Segredo334");expect(JSON.stringify(r)).not.toContain("Sigilosa334");
});
it("334 convite expirado e comercial sem lead não recebem módulo Aria",async()=>{
 const c=await cenario(),prof=await criarUsuario([Papel.PROFESSOR]);await c.criar("334-a");
 await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.a.id,usuarioId:prof.id,concedenteId:c.dono.id,inicio:new Date(Date.now()-120000),fim:new Date(Date.now()-60000),motivo:"Expirado334"}});
 expect((await carregarAriaAtividade(prof,c.a.id)).aria).toBeNull();
 await prisma.atendimentoWhatsApp.update({where:{id:c.a.id},data:{leadId:null}});
 const admin=await criarUsuario([Papel.ADMINISTRADOR]);expect(await carregarAriaAtividade(admin,c.a.id)).toEqual({aria:null,alteracoes:[],contadorAtividade:0});
});
it("334 última sugestão não afirma alteração ainda não executada",async()=>{
 const c=await cenario();const s=await c.criar("334-sugestao","SUGERIDA");await prisma.acaoAgenteIA.update({where:{id:s.id},data:{acao:"MOVER_ETAPA",payload:{para:"PERDIDO"}}});
 const r=await carregarAriaAtividade(c.dono,c.a.id);expect(r.aria?.ultimaAcao?.texto).toBe("Mover de etapa");expect(r.alteracoes).toEqual([]);expect(r.contadorAtividade).toBe(0);
});