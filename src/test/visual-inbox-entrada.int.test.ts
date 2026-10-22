import { afterAll, beforeEach, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { criarDemoInbox, inserirEntradaDemoInbox } from "../../scripts/visual/demo-inbox";
import { assinarInbox, iniciarEscuta, type AvisoInbox } from "@/server/inbox/barramento";
import { contarConversasNaoLidas } from "@/server/inbox/nao-lidas";
beforeEach(async()=>{await truncarBanco();await prisma.usuario.createMany({data:[{email:"admin@genius.com",nome:"Admin demo",senhaHash:"teste-local",papeis:[Papel.ADMINISTRADOR]},{email:"joao@genius.com",nome:"João demo",senhaHash:"teste-local",papeis:[Papel.VENDEDOR]}]});});
afterAll(()=>prisma.$disconnect());
it("entrada insere só na fixture, muda contagem pessoal e publica SSE por trigger sem transporte",async()=>{
 const ids=await criarDemoInbox(prisma);const admin=await prisma.usuario.findUniqueOrThrow({where:{email:"admin@genius.com"}});const a=await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:ids.thiago}});
 await prisma.preferenciaConversaUsuario.upsert({where:{usuarioId_conversaId:{usuarioId:admin.id,conversaId:a.conversaId}},create:{usuarioId:admin.id,conversaId:a.conversaId,lidaAte:new Date()},update:{lidaAte:new Date(),marcadaNaoLida:false}});
 const u={id:admin.id,nome:admin.nome,papeis:admin.papeis};const antes=await contarConversasNaoLidas(u); await iniciarEscuta(process.env.DATABASE_URL!);const avisos:AvisoInbox[]=[];const sair=assinarInbox(v=>avisos.push(v));
 try{const m=await inserirEntradaDemoInbox(prisma,"thiago");expect(m.direcao).toBe("ENTRADA");expect(m.atendimentoId).toBe(ids.thiago);expect(await contarConversasNaoLidas(u)).toBe(antes+1);await viWait(()=>expect(avisos.filter(v=>v.tipo==="mensagem.nova"&&v.mensagemId===m.id)).toHaveLength(1));}finally{sair();}
 await expect(inserirEntradaDemoInbox(prisma,"outro")).rejects.toThrow();
});
async function viWait(f:()=>void){const {vi}=await import("vitest");await vi.waitFor(f,{timeout:3000});}
