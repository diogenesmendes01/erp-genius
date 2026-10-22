import { DriverWhatsApp, Papel } from "@prisma/client";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { contarConversasNaoLidas } from "./nao-lidas";
import { contarChipsInbox, listarAtendimentosPagina } from "./consultas-pagina";
type U = Awaited<ReturnType<typeof criarUsuario>>; let admin: U, outro: U, numeroId: string, seq=0;
const sess = (u: U) => ({ id:u.id, nome:u.nome, papeis:u.papeis });
beforeEach(async () => { await truncarBanco(); admin=await criarUsuario([Papel.ADMINISTRADOR]); outro=await criarUsuario([Papel.VENDEDOR]); numeroId=(await prisma.numeroWhatsApp.create({data:{telefoneE164:"+5511999990000",rotulo:"Demo teste",driver:DriverWhatsApp.BAILEYS,finalidade:"COBRANCA"}})).id; });
afterAll(() => prisma.$disconnect());
async function criar(naoLidas=0) { const c=await prisma.contatoWhatsApp.create({data:{telefoneE164:"+5069"+String(++seq).padStart(7,"0")}}); const conv=await prisma.conversaWhatsApp.create({data:{numeroId,contatoId:c.id}});return prisma.atendimentoWhatsApp.create({data:{conversaId:conv.id,contextoChave:"SECRETARIA::",finalidade:"SECRETARIA",naoLidas}}); }
it("mesma regra pessoal do chip310 no escopo inteiro; conta conversas, não mensagens", async () => {
 const a=await criar(3); await criar(1); await criar(); expect(await contarConversasNaoLidas(sess(admin))).toBe(2); expect((await contarChipsInbox(sess(admin),{})).naoLidas).toBe(2);
 await prisma.preferenciaConversaUsuario.create({data:{usuarioId:admin.id,conversaId:a.conversaId,lidaAte:new Date()}}); expect(await contarConversasNaoLidas(sess(admin))).toBe(1); expect((await listarAtendimentosPagina(sess(admin),{naoLidas:true},null)).itens).toHaveLength(1);
});
it("marcada pessoal e entrada posterior contam, saída e leitura alheia não contaminam", async () => {
 const lida=await criar(5), marcada=await criar(), nova=await criar(); const ate=new Date("2026-10-01T00:00:00Z");
 for(const a of [lida,nova]) await prisma.preferenciaConversaUsuario.create({data:{usuarioId:admin.id,conversaId:a.conversaId,lidaAte:ate}});
 await prisma.preferenciaConversaUsuario.create({data:{usuarioId:admin.id,conversaId:marcada.conversaId,marcadaNaoLida:true}});
 for(const [a,direcao] of [[lida,"SAIDA"],[nova,"ENTRADA"]] as const) await prisma.mensagemWhatsApp.create({data:{numeroId,conversaId:a.conversaId,atendimentoId:a.id,direcao,driver:DriverWhatsApp.BAILEYS,criadoEm:new Date("2026-10-02T00:00:00Z")}});
 expect(await contarConversasNaoLidas(sess(admin))).toBe(2); expect((await contarChipsInbox(sess(admin),{})).naoLidas).toBe(2);
 const adm2=await criarUsuario([Papel.ADMINISTRADOR]); expect(await contarConversasNaoLidas(sess(adm2))).toBe(1);
});
it("fora do escopo é0; sem papel não consulta banco", async () => {
 await criar(3); expect(await contarConversasNaoLidas(sess(outro))).toBe(0);
 const count=vi.spyOn(prisma.atendimentoWhatsApp,"count"), raw=vi.spyOn(prisma,"$queryRaw");
 try { expect(await contarConversasNaoLidas({id:"sem",nome:"sem",papeis:[Papel.ALUNO]})).toBe(0); expect(count).not.toHaveBeenCalled();expect(raw).not.toHaveBeenCalled(); }finally{count.mockRestore();raw.mockRestore();}
});
