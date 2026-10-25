import {afterAll,beforeEach,expect,it} from "vitest";
import {Papel,type OrigemEnvio,type StatusIntencao} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import {truncarBanco,criarUsuario} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {carregarAtividadePainel} from "./painel-atividade";
beforeEach(()=>truncarBanco());afterAll(()=>prisma.$disconnect());
it("333 lista todas origens autorizadas e conta somente conversas visíveis/tarefas da própria ACL",async()=>{
 const c=await cenarioPerda328(),outro=await criarUsuario([Papel.VENDEDOR]);
 const n2=await prisma.numeroWhatsApp.create({data:{telefoneE164:"+550003330001",rotulo:"Segunda333",driver:"MOTOR",finalidade:"VENDAS",donoId:c.dono.id}}),conv2=await prisma.conversaWhatsApp.create({data:{numeroId:n2.id,contatoId:c.contato.id}});
 await prisma.atendimentoWhatsApp.create({data:{conversaId:conv2.id,contextoChave:"COMERCIAL:333:segunda",finalidade:"COMERCIAL",leadId:c.op.id}});
 const nf=await prisma.numeroWhatsApp.create({data:{telefoneE164:"+550003330002",rotulo:"Fora333",driver:"MOTOR",finalidade:"COBRANCA"}}),cf=await prisma.conversaWhatsApp.create({data:{numeroId:nf.id,contatoId:c.contato.id}});await prisma.atendimentoWhatsApp.create({data:{conversaId:cf.id,contextoChave:"SECRETARIA:333",finalidade:"SECRETARIA"}});
 const base={numeroId:c.numero.id,contatoId:c.contato.id,atendimentoId:c.a.id,corpoRenderizado:"Mensagem fictícia",agendadaPara:new Date("2026-10-27T12:00Z")};
 await prisma.intencaoMensagem.create({data:{...base,id:"333-a-ia",origem:"IA",autorId:c.dono.id}});await prisma.intencaoMensagem.create({data:{...base,id:"333-b-minha",origem:"HUMANO",autorId:c.dono.id,status:"ADIADA"}});await prisma.intencaoMensagem.create({data:{...base,id:"333-c-outra",origem:"CRON",autorId:outro.id}});
 for(const [id,extra] of Object.entries({cancelada:{status:"CANCELADA" as StatusIntencao},regua:{passo:"D1"},comercial:{passoComercial:"+30min"},semagenda:{agendadaPara:null}}))await prisma.intencaoMensagem.create({data:{...base,id:"333-x-"+id,origem:"HUMANO" as OrigemEnvio,...extra}});
 await prisma.tarefa.create({data:{titulo:"Direta333",tipo:"OUTRO",setor:"COMERCIAL",fusoOrigem:"UTC",atendimentoId:c.a.id,responsavelId:c.dono.id}});await prisma.tarefa.create({data:{titulo:"Lead333",tipo:"OUTRO",setor:"COMERCIAL",fusoOrigem:"UTC",leadId:c.op.id,responsavelId:c.dono.id}});await prisma.tarefa.create({data:{titulo:"Fora333",tipo:"OUTRO",setor:"COMERCIAL",fusoOrigem:"UTC",atendimentoId:c.a.id,responsavelId:outro.id}});
 for(let i=1;i<=3;i++)await prisma.evento.create({data:{id:"333-nota-"+i,tipo:"NotaInterna",agregadoTipo:"AtendimentoWhatsApp",agregadoId:c.a.id,autorId:c.dono.id,payload:{nota:"Nota "+i},criadoEm:new Date("2026-10-25T12:0"+i+"Z")}});
 const r=await carregarAtividadePainel(c.dono,c.a.id);expect(r?.agendadas.map(m=>[m.id,m.autor.tipo,m.podeCancelar])).toEqual([["333-a-ia","aria",false],["333-b-minha","voce",true],["333-c-outra","pessoa",false]]);expect(r?.recente).toMatchObject({conversas:2,tarefasAbertas:2});expect(r?.recente.notas.map(n=>n.nota)).toEqual(["Nota 3","Nota 2"]);expect(await carregarAtividadePainel(outro,c.a.id)).toBeNull();
});
it("333 convidado com leitura sem tarefas.ver vê lista mas não recebe cancelar nem tarefas de outro",async()=>{
 const c=await cenarioPerda328(),prof=await criarUsuario([Papel.PROFESSOR]);await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.a.id,usuarioId:prof.id,concedenteId:c.dono.id,inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+3600000),motivo:"Leitura333"}});
 await prisma.intencaoMensagem.create({data:{numeroId:c.numero.id,contatoId:c.contato.id,atendimentoId:c.a.id,origem:"HUMANO",autorId:prof.id,corpoRenderizado:"Texto333",agendadaPara:new Date("2026-10-27T12:00Z")}});
 const r=await carregarAtividadePainel(prof,c.a.id);expect(r?.agendadas).toHaveLength(1);expect(r?.agendadas[0]).toMatchObject({autor:{tipo:"voce"},podeCancelar:false});expect(r?.recente.tarefasAbertas).toBe(0);
});
it("333 Admin pode cancelar IA, inclusive com autor explícito; encerrado não exige Assumir",async()=>{
 const c=await cenarioPerda328(),admin=await criarUsuario([Papel.ADMINISTRADOR]);await prisma.atendimentoWhatsApp.update({where:{id:c.a.id},data:{encerradoEm:new Date(),status:"ENCERRADO"}});await prisma.intencaoMensagem.create({data:{numeroId:c.numero.id,contatoId:c.contato.id,atendimentoId:c.a.id,origem:"IA",autorId:c.dono.id,corpoRenderizado:"Aria333",agendadaPara:new Date("2026-10-27T12:00Z")}});
 expect((await carregarAtividadePainel(admin,c.a.id))?.agendadas[0]).toMatchObject({autor:{tipo:"aria"},podeCancelar:true});
});