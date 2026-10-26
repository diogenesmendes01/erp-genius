import {afterAll,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn()}));
vi.mock("@/lib/auth",()=>({auth:m.auth}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco} from "@/test/integracao";
import {cenarioCadastroPessoa} from "@/test/inbox-cadastro-pessoa";
import {diaUtilAs} from "@/test/janela-envio";
import {agendarMensagem} from "@/server/crm/mensagens-agendadas";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
/** Autoria nativa para futura lease: nenhuma execução/RED observado nesta faseFS. */
beforeEach(async()=>{await truncarBanco();m.auth.mockReset();});
afterAll(()=>prisma.$disconnect());
async function cenario(){const c=await cenarioCadastroPessoa();await prisma.configIA.upsert({where:{id:"ia"},create:{id:"ia"},update:{}});await prisma.oportunidade.update({where:{id:c.op.id},data:{telefoneE164:c.contato.telefoneE164}});m.auth.mockResolvedValue({user:{id:c.dono.id}});return c;}
it("API legada com atendimento não bypassa D11 quando responsável é nulo",async()=>{const c=await cenario();expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.atendimento.id}})).responsavelId).toBeNull();expect(await atendimentoVisivel(c.dono,c.atendimento.id,true,prisma)).not.toBeNull();const r=await agendarMensagem({atendimentoId:c.atendimento.id,numeroId:c.numero.id,texto:"Fictício sem assumir",agendadaPara:diaUtilAs(10,"America/Costa_Rica").toISOString()});expect(r).toEqual({ok:false,erro:expect.stringMatching(/Assuma/)});expect(await prisma.intencaoMensagem.count()).toBe(0);expect(await prisma.evento.count({where:{tipo:"MensagemAgendada"}})).toBe(0);});
it("API legada com atendimento não bypassa D11 com responsável de outra pessoa",async()=>{const c=await cenario();await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{responsavelId:c.outro.id,iaPausadaEm:new Date()}});expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.atendimento.id}})).responsavelId).toBe(c.outro.id);expect(await atendimentoVisivel(c.dono,c.atendimento.id,true,prisma)).not.toBeNull();const r=await agendarMensagem({atendimentoId:c.atendimento.id,numeroId:c.numero.id,texto:"Fictício de outra responsabilidade",agendadaPara:diaUtilAs(10,"America/Costa_Rica").toISOString()});expect(r).toEqual({ok:false,erro:expect.stringMatching(/Assuma/)});expect(await prisma.intencaoMensagem.count()).toBe(0);});
it("controle CRM sem atendimento preserva agendamento sem responsável fictício",async()=>{const c=await cenario();expect(await atendimentoVisivel(c.dono,c.atendimento.id,true,prisma)).not.toBeNull();const r=await agendarMensagem({numeroId:c.numero.id,texto:"Fictício CRM",leadId:c.op.id,agendadaPara:diaUtilAs(10,"America/Costa_Rica").toISOString()});expect(r.ok).toBe(true);if(!r.ok||!r.dado)throw Error("Controle CRM não agendou");expect(await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:r.dado.id}})).toMatchObject({atendimentoId:null,origem:"HUMANO",autorId:c.dono.id});});

it("N1 ator sem acesso recebe a mesma resposta para alvo oculto e inexistente com número errado",async()=>{
 const c=await cenario();
 expect(await atendimentoVisivel(c.dono,c.atendimento.id,true,prisma)).not.toBeNull();
 expect(await atendimentoVisivel(c.outro,c.atendimento.id,true,prisma)).toBeNull();
 expect((await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}})).telefoneE164).toBe(c.contato.telefoneE164);
 m.auth.mockResolvedValue({user:{id:c.outro.id}});
 const entrada={numeroId:"numero-ficticio-inexistente-N1",texto:"Fictício N1 sem acesso",agendadaPara:diaUtilAs(10,"America/Costa_Rica").toISOString()};
 const oculto=await agendarMensagem({...entrada,atendimentoId:c.atendimento.id});
 const inexistente=await agendarMensagem({...entrada,atendimentoId:c.atendimento.id+"-inexistente"});
 expect(oculto).toEqual({ok:false,erro:"Atendimento não encontrado."});
 expect(inexistente).toEqual(oculto);
 expect(await prisma.intencaoMensagem.count()).toBe(0);
 expect(await prisma.evento.count({where:{tipo:"MensagemAgendada"}})).toBe(0);
});
it("N1 ator autorizado com responsabilidade atual conserva recusa do número errado",async()=>{
 const c=await cenario();
 await prisma.atendimentoWhatsApp.update({where:{id:c.atendimento.id},data:{responsavelId:c.dono.id,iaPausadaEm:new Date()}});
 expect(await atendimentoVisivel(c.dono,c.atendimento.id,true,prisma)).not.toBeNull();
 const r=await agendarMensagem({atendimentoId:c.atendimento.id,numeroId:"numero-ficticio-inexistente-N1",texto:"Fictício N1 autorizado",agendadaPara:diaUtilAs(10,"America/Costa_Rica").toISOString()});
 expect(r).toEqual({ok:false,erro:"Número de envio indisponível."});
 expect(await prisma.intencaoMensagem.count()).toBe(0);
 expect(await prisma.evento.count({where:{tipo:"MensagemAgendada"}})).toBe(0);
});
