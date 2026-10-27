import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { Papel } from "@prisma/client";
const m=vi.hoisted(()=>({enviar:vi.fn(),auth:vi.fn()}));
vi.mock("@/server/whatsapp/drivers/motor",()=>({driverMotor:{enviarTexto:m.enviar,enviarTemplate:vi.fn(),enviarMidia:vi.fn()}}));
vi.mock("@/lib/auth",()=>({auth:m.auth}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { prisma } from "@/lib/prisma";
import { criarUsuario,seedCatalogoMinimo,truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { configPadrao } from "../aria/config-schema";
import { provedorSimulado } from "../aria/provedor/simulado";
import { processarTurnoAria } from "../aria/turno/orquestrador";
import { despacharFila } from "./despachante";
import { assumirConversaDaAria } from "./acoes-atendimento";
let c:Awaited<ReturnType<typeof cenario>>;
async function cenario(){
 const cat=await seedCatalogoMinimo(),admin=await criarUsuario([Papel.ADMINISTRADOR]);const{numero}=await seedCanal({estado:"ATIVA"});
 const op=await prisma.oportunidade.create({data:{nome:"Fixture357",paisId:cat.pais.id,telefoneE164:"+50680000358",vendedorDonoId:admin.id}});
 const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:"+50680000358",leadId:op.id}});const at=await prisma.$transaction(tx=>garantirAtendimento(tx,{numeroId:numero.id,contatoId:contato.id,finalidade:"COMERCIAL",leadId:op.id}));
 await prisma.versaoAgenteIA.create({data:{numero:1,status:"PUBLICADA",config:configPadrao(),criadaPorId:admin.id,publicadaPorId:admin.id,publicadaEm:new Date()}});await prisma.agenteIA.create({data:{id:"aria",estado:"ATIVA"}});
 const msg=await prisma.mensagemWhatsApp.create({data:{numeroId:numero.id,conversaId:at.conversaId,atendimentoId:at.id,direcao:"ENTRADA",corpo:"Quero saber das turmas",driver:"MOTOR",criadoEm:new Date(Date.now()-1000)}});
 m.auth.mockResolvedValue({user:{id:admin.id}});
 expect(await processarTurnoAria(msg.id,{provedor:{nome:"simulado",async gerar(p){return{...await provedorSimulado.gerar(p),texto:JSON.stringify({resposta:"Temos turmas à noite, quer conhecer?",documentoId:null,acoes:[],confianca:95,handoff:null,fontes:[],humor:null})};}}})).toMatchObject({resultado:"RESPONDEU"});
 const intencao=await prisma.intencaoMensagem.findFirstOrThrow({where:{atendimentoId:at.id,origem:"IA"}});return{at,intencao};
}
beforeEach(async()=>{await truncarBanco();vi.resetAllMocks();m.enviar.mockResolvedValue({providerMessageId:"fake357claim",mensagemIdMotor:"fake357claim"});vi.stubEnv("WHATSAPP_LIVE","1");c=await cenario();});
afterEach(()=>vi.unstubAllEnvs());
it("357 assumir antes do claim cancela a intenção e nunca chama o driver fake",async()=>{
 expect((await assumirConversaDaAria(c.at.id)).ok).toBe(true);expect(await despacharFila()).toMatchObject({despachadas:0});expect(m.enviar).not.toHaveBeenCalled();expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:c.intencao.id}})).status).toBe("CANCELADA");
});
it("357 claim ENVIANDO já confirmado não é fingido cancelado; driver fake em voo conclui",async()=>{
 m.enviar.mockImplementationOnce(async()=>{
  expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:c.intencao.id}})).status).toBe("ENVIANDO");
  expect((await assumirConversaDaAria(c.at.id)).ok).toBe(true);
  expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:c.intencao.id}})).status).toBe("ENVIANDO");
  return{providerMessageId:"fake357claim",mensagemIdMotor:"fake357claim"};
 });
 expect(await despacharFila()).toMatchObject({despachadas:1});expect(m.enviar).toHaveBeenCalledOnce();expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:c.intencao.id}})).status).toBe("DESPACHADA");expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.at.id}})).iaPausaMotivo).toBe("MANUAL");
});
