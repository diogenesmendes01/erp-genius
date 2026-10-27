import {politicaDeFabrica} from "../cobrancas/politica";
import {fusoDaEscola} from "../relatorios/atendimento";
import {recusaForaDaJanela} from "../whatsapp/janela-agendamento";
import {Client} from "pg";
import {randomUUID,createHash} from "node:crypto";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {CANAL_INBOX,type AvisoInbox} from "@/server/inbox/barramento";
import {afterAll,beforeEach,expect,it,vi} from "vitest";
import {Papel,type Prisma} from "@prisma/client";
const h=vi.hoisted(()=>({auth:vi.fn()}));
vi.mock("@/lib/auth",()=>({auth:h.auth}));
vi.mock("@/server/_shared/sessao",async original=>{const real=await original<typeof import("@/server/_shared/sessao")>();return {...real,exigirSessao:async()=>{const id=(await h.auth())?.user?.id;const u=typeof id==="string"?await real.carregarUsuarioFresco(id):null;if(!u)throw new real.ErroAutenticacao();if(real.apenasPortal(u))throw new real.ErroPermissao("Acesso restrito ao portal do aluno.");return u;}};});
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {ErroRegra} from "../_shared/sessao";
import {criarUsuario,truncarBanco} from "@/test/integracao";
import {cenarioEdicao355,sugestaoEdicao355,intencaoIA355,type CenarioEdicao355} from "@/test/aria-edicao355";
import {comAvisosInbox} from "@/test/avisos-inbox";
import {diaUtilAs} from "@/test/janela-envio";
import {aprovarSugestaoEditadaNoInbox,aprovarSugestaoEditadaInboxTx} from "./decisao-inbox";
let c:CenarioEdicao355;
type AvisoNota355={aviso:AvisoInbox;compacto:boolean;wireSha256:string;bytes:number};
async function ouvirNota355<T>(fn:()=>Promise<T>){
 const url=new URL(process.env.DATABASE_URL!);if(!["postgres:","postgresql:"].includes(url.protocol)||!["localhost","127.0.0.1"].includes(url.hostname)||url.port!=="54329"||!["erp_genius_test","erp_genius_test_dev_email","erp_genius_test_dev_gravacoes","erp_genius_test_tester","erp_genius_test_ciint"].includes(url.pathname.slice(1))||url.search||url.hash)throw Error("ListenerNota355 fora do perfil autorizado");
 const pg=new Client({connectionString:url.toString()}),marca=randomUUID(),avisos:AvisoNota355[]=[];let confirmar=()=>{},falha:unknown,primario:unknown;
 try{await pg.connect();pg.on("notification",m=>{if(m.channel===CANAL_INBOX&&m.payload){try{const aviso=JSON.parse(m.payload) as AvisoInbox;avisos.push({aviso,compacto:m.payload===JSON.stringify(aviso),wireSha256:createHash("sha256").update(m.payload).digest("hex"),bytes:Buffer.byteLength(m.payload)});}catch{falha=Error("WireNota355 não é JSON válido");}}if(m.channel==="inbox_barreira_nota355"&&m.payload===marca)confirmar();});await pg.query(`LISTEN ${CANAL_INBOX}`);await pg.query("LISTEN inbox_barreira_nota355");const resultado=await fn();await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(Error("BarreiraNota355 não chegou")),3000);confirmar=()=>{clearTimeout(t);resolve();};void pg.query("SELECT pg_notify('inbox_barreira_nota355',$1)",[marca]).catch(e=>{clearTimeout(t);reject(e);});});if(falha)throw falha;return {resultado,avisos};
 }catch(e){primario=e;throw e;}finally{try{await pg.end();}catch(e){throw new AggregateError(primario?[primario,e]:[e],"CleanupNota355 falhou");}}
}
function contarNota355(xs:AvisoNota355[]){const at=xs.filter(x=>x.aviso.tipo==="atendimento.atualizado"&&x.aviso.atendimentoId===c.at.id);return {total:xs.length,atendimento:at.length,compactoManual:at.filter(x=>x.compacto).length,formatadoCompativelTriggerAcao:at.filter(x=>!x.compacto).length,wires:at.map(x=>({sha256:x.wireSha256,bytes:x.bytes,compacto:x.compacto}))};}
beforeEach(async()=>{await truncarBanco();c=await cenarioEdicao355();h.auth.mockResolvedValue({user:{id:c.dono.id}});vi.stubGlobal("fetch",vi.fn(async()=>{throw Error("Transporte externo bloqueado355");}));});
afterAll(async()=>{vi.unstubAllGlobals();await prisma.$disconnect();});
const entrada=(id:string,edicao:Record<string,unknown>,chaveIdempotencia="tentativa355-0001")=>({atendimentoId:c.at.id,id,edicao,chaveIdempotencia});
const aprovada=async(id:string)=>prisma.acaoAgenteIA.findUniqueOrThrow({where:{id}});
const eventos=async(id:string)=>prisma.evento.findMany({where:{agregadoId:id,tipo:"AcaoAriaAprovada"}});

it("355 editar_texto_guarda_original, autor humano, pausa e replay sem duplicar",async()=>{
 const s=await sugestaoEdicao355(c);const ia=await intencaoIA355(c);const i=entrada(s.id,{texto:"Texto humano R$123 sem gate de preço IA"});
 expect(await aprovarSugestaoEditadaNoInbox(i)).toMatchObject({ok:true});
 const a=await aprovada(s.id);expect(a).toMatchObject({status:"APROVADA",decididaPorId:c.dono.id,payload:{texto:i.edicao.texto,original:{texto:"Texto original IA355"},editadaPorId:c.dono.id}});
 expect(await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:a.intencaoId!}})).toMatchObject({origem:"HUMANO",autorId:c.dono.id,corpoRenderizado:i.edicao.texto,status:"PENDENTE"});
 expect(await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:ia.id}})).toMatchObject({status:"CANCELADA",motivoFalha:"aria_pausada"});
 expect(await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.at.id}})).toMatchObject({responsavelId:c.dono.id,iaPausaMotivo:"HUMANO_RESPONDEU",iaPausadaEm:expect.any(Date)});
 expect(await prisma.evento.findUniqueOrThrow({where:{id:a.eventoId!}})).toMatchObject({tipo:"RespostaHumanaEditadaPreparada",autorId:c.dono.id,payload:{origem:"HUMANO"}});
 const e=await eventos(s.id);expect(e).toHaveLength(1);expect(e[0].payload).toMatchObject({payloadOriginal:{texto:"Texto original IA355"},original:{texto:"Texto original IA355"}});
 const antes=await prisma.evento.count();expect(await aprovarSugestaoEditadaNoInbox(i)).toMatchObject({ok:true});expect(await prisma.evento.count()).toBe(antes);expect(await prisma.intencaoMensagem.count({where:{acaoAgenteIAId:s.id}})).toBe(1);expect(fetch).not.toHaveBeenCalled();
});
it("355 horário-only humano pausa e edição fora da janela recusa sem novo efeito",async()=>{
 const fabrica=politicaDeFabrica(),dadosJanela={janelaInicio:fabrica.janelaInicio,janelaFim:fabrica.janelaFim,diasSemana:[...fabrica.diasSemana]};
 const registro=await prisma.politicaRegua.findFirstOrThrow({where:{escopo:"COBRANCA"},orderBy:{criadoEm:"asc"},select:{id:true}});
 await prisma.politicaRegua.update({where:{id:registro.id},data:dadosJanela});
 const observada=await prisma.politicaRegua.findUniqueOrThrow({where:{id:registro.id},select:{janelaInicio:true,janelaFim:true,diasSemana:true}});
 const fuso=await fusoDaEscola(prisma),quando=diaUtilAs(10,fuso),fora=diaUtilAs(23,fuso),agora=Date.now();
 const dentro=await recusaForaDaJanela(quando,prisma),erro=await recusaForaDaJanela(fora,prisma);
 const dirJanela=await mkdtemp(join(tmpdir(),"inbox355-janela-"));const artifactJanela=join(dirJanela,"canarios.json");
 await writeFile(artifactJanela,JSON.stringify({fabrica:dadosJanela,observada,fuso,agora,quandoISO:quando.toISOString(),foraISO:fora.toISOString(),dentro,fora:erro},null,2));console.info("ARTEFATO_JANELA355",artifactJanela);
 expect(observada).toEqual(dadosJanela);expect(quando.getTime()).toBeGreaterThan(agora);expect(fora.getTime()).toBeGreaterThan(agora);expect(dentro).toBeNull();expect(erro,"23h fora da mesma janela9–20 real").not.toBeNull();
 const s=await sugestaoEdicao355(c,"AGENDAR_MENSAGEM",{texto:"Agendada original",agendadaPara:diaUtilAs(11,fuso).toISOString()});
 expect(await aprovarSugestaoEditadaNoInbox(entrada(s.id,{agendadaPara:quando.toISOString()}))).toMatchObject({ok:true});const a=await aprovada(s.id);
 expect(await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:a.intencaoId!}})).toMatchObject({origem:"HUMANO",autorId:c.dono.id,corpoRenderizado:"Agendada original",agendadaPara:quando});expect(await prisma.evento.findUniqueOrThrow({where:{id:a.eventoId!}})).toMatchObject({tipo:"MensagemAgendada",autorId:c.dono.id});
 const pausaAntes=(await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.at.id}})).iaPausadaEm;expect(pausaAntes).toBeInstanceOf(Date);
 const eventosPausaAntes=await prisma.evento.count({where:{agregadoId:c.at.id,tipo:"AriaPausadaNoAtendimento"}});
 const outra=await sugestaoEdicao355(c,"AGENDAR_MENSAGEM",{texto:"Agendada original fora",agendadaPara:quando.toISOString()});
 const negativo=entrada(outra.id,{agendadaPara:fora.toISOString()},"tentativa355-fora-janela");
 expect(await aprovarSugestaoEditadaNoInbox(negativo)).toEqual({ok:false,erro});
 const direto=prisma.$transaction(tx=>aprovarSugestaoEditadaInboxTx(tx,c.dono.id,{...negativo,chaveIdempotencia:"tentativa355-fora-dominio"}));
 await expect(direto).rejects.toBeInstanceOf(ErroRegra);await expect(direto).rejects.toThrow(erro!);
 expect((await aprovada(outra.id)).status).toBe("SUGERIDA");expect(await prisma.intencaoMensagem.count({where:{acaoAgenteIAId:outra.id}})).toBe(0);expect(await eventos(outra.id)).toHaveLength(0);
 expect(await prisma.evento.count({where:{agregadoId:c.at.id,tipo:"AriaPausadaNoAtendimento"}})).toBe(eventosPausaAntes);expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.at.id}})).iaPausadaEm).toEqual(pausaAntes);
});it("355 nota editada mantém aviso canônico, observa wire legado e replay/rollback zero",async()=>{
 const s=await sugestaoEdicao355(c,"NOTA_INTERNA",{texto:"Nota original"});const i=entrada(s.id,{texto:"Nota humana"});
 const commit=await ouvirNota355(()=>aprovarSugestaoEditadaNoInbox(i));
 const a=await aprovada(s.id),nota=await prisma.evento.findUniqueOrThrow({where:{id:a.eventoId!}});
 const replay=await ouvirNota355(()=>aprovarSugestaoEditadaNoInbox(i));
 const outra=await sugestaoEdicao355(c,"NOTA_INTERNA",{texto:"Nota original rollback"});
 const rollback=await ouvirNota355(async()=>{try{await prisma.$transaction(async tx=>{await aprovarSugestaoEditadaInboxTx(tx,c.dono.id,entrada(outra.id,{texto:"Nota desfeita"},"nota355-rollback-key"));throw new ErroRegra("RollbackNota355 confirmado");});return "inesperado";}catch(e){if(!(e instanceof ErroRegra)||e.message!=="RollbackNota355 confirmado")throw e;return "rollback confirmado";}});
 const medido={commit:contarNota355(commit.avisos),replay:contarNota355(replay.avisos),rollback:contarNota355(rollback.avisos)};
 const dir=await mkdtemp(join(tmpdir(),"inbox355-nota-"));const artifact=join(dir,"avisos.json");await writeFile(artifact,JSON.stringify(medido,null,2));console.info("ARTEFATO_NOTA355",artifact);
 expect(commit.resultado).toMatchObject({ok:true});expect(nota).toMatchObject({tipo:"NotaInterna",autorId:c.dono.id,payload:{nota:"Nota humana"}});
 expect(medido.commit.atendimento).toBeGreaterThanOrEqual(1);expect(medido.commit.compactoManual).toBeGreaterThanOrEqual(1);expect(medido.commit.formatadoCompativelTriggerAcao).toBeGreaterThanOrEqual(1);
 expect(replay.resultado).toMatchObject({ok:true});expect(medido.replay.total).toBe(0);expect(rollback.resultado).toBe("rollback confirmado");expect(medido.rollback.total).toBe(0);
 expect((await aprovada(outra.id)).status).toBe("SUGERIDA");expect(await prisma.evento.count({where:{tipo:"NotaInterna",payload:{path:["acaoAgenteIAId"],equals:outra.id}}})).toBe(0);expect(await prisma.intencaoMensagem.count()).toBe(0);expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.at.id}})).iaPausadaEm).toBeNull();
});it("355 tarefa editada conserva origemIA e original auditado antes do tarefaId",async()=>{const original={titulo:"Tarefa IA",venceEmISO:diaUtilAs(10).toISOString()};const s=await sugestaoEdicao355(c,"CRIAR_TAREFA",original);const nova=diaUtilAs(11);expect(await aprovarSugestaoEditadaNoInbox(entrada(s.id,{titulo:"Tarefa editada",venceEmISO:nova.toISOString()}))).toMatchObject({ok:true});const a=await aprovada(s.id),p=a.payload as Prisma.JsonObject;expect(p).toMatchObject({original,editadaPorId:c.dono.id,tarefaId:expect.any(String)});expect(await prisma.tarefa.findUniqueOrThrow({where:{id:String(p.tarefaId)}})).toMatchObject({titulo:"Tarefa editada",inicioEm:nova,origem:"IA",criadorId:null});expect((await eventos(s.id))[0].payload).toMatchObject({payloadOriginal:original});expect(await prisma.intencaoMensagem.count()).toBe(0);});
it("355 mesma chave outro texto conflita e nova chave após decidida recusa",async()=>{const s=await sugestaoEdicao355(c);const i=entrada(s.id,{texto:"Primeiro"});expect(await aprovarSugestaoEditadaNoInbox(i)).toMatchObject({ok:true});expect(await aprovarSugestaoEditadaNoInbox({...i,edicao:{texto:"Outro"}})).toEqual({ok:false,erro:"Esta tentativa já foi usada com outra edição."});expect(await aprovarSugestaoEditadaNoInbox({...i,chaveIdempotencia:"tentativa355-nova"})).toEqual({ok:false,erro:"Esta sugestão já foi decidida."});expect(await eventos(s.id)).toHaveLength(1);});
it("355 D1 nega outro vendedor mesmo com sugestão editável visível no passado",async()=>{const s=await sugestaoEdicao355(c);const outro=await criarUsuario([Papel.VENDEDOR]);h.auth.mockResolvedValue({user:{id:outro.id}});expect(await aprovarSugestaoEditadaNoInbox(entrada(s.id,{texto:"Não autorizado"}))).toEqual({ok:false,erro:"Esta ação está fora do seu escopo no atendimento."});expect((await aprovada(s.id)).status).toBe("SUGERIDA");expect(await eventos(s.id)).toHaveLength(0);expect(await prisma.intencaoMensagem.count()).toBe(0);});
it("355 limite humano inválido recusa sem writes e sem texto no erro",async()=>{const s=await sugestaoEdicao355(c);const r=await aprovarSugestaoEditadaNoInbox(entrada(s.id,{texto:"x".repeat(4097)}));expect(r).toEqual({ok:false,erro:"Mensagem longa demais (máx. 4096)."});expect((await aprovada(s.id)).status).toBe("SUGERIDA");expect(await prisma.intencaoMensagem.count()).toBe(0);expect(await eventos(s.id)).toHaveLength(0);});
it("355 documento atual aprovado e documento arquivado recusado antes de I",async()=>{const up=await prisma.registroUpload.create({data:{url:"/api/files/ficticio355.pdf",nome:"Fictício355",mime:"application/pdf",tamanho:10,autorId:c.gerente.id}});const f=await prisma.fonteConhecimento.create({data:{tipo:"ARQUIVO",nome:"Fictício355",registroUploadId:up.id,status:"PRONTA",hashConteudo:"ficticio355",enviavelAoLead:true,criadoPorId:c.gerente.id}});const s=await sugestaoEdicao355(c,"ENVIAR_DOCUMENTO",{texto:"Legenda IA",documentoId:f.id});expect(await aprovarSugestaoEditadaNoInbox(entrada(s.id,{texto:"Legenda humana"}))).toMatchObject({ok:true});expect(await prisma.intencaoMensagem.findFirstOrThrow({where:{acaoAgenteIAId:s.id}})).toMatchObject({origem:"HUMANO",tipo:"DOCUMENTO",midiaPath:up.url,autorId:c.dono.id});await prisma.fonteConhecimento.update({where:{id:f.id},data:{arquivadaEm:new Date()}});const outra=await sugestaoEdicao355(c,"ENVIAR_DOCUMENTO",{texto:"Legenda IA",documentoId:f.id});expect(await aprovarSugestaoEditadaNoInbox(entrada(outra.id,{texto:"Legenda humana"},"tentativa355-doc2"))).toEqual({ok:false,erro:"O documento não pode mais ser enviado ao lead."});expect(await prisma.intencaoMensagem.count({where:{acaoAgenteIAId:outra.id}})).toBe(0);});
it("355 rollback real desfaz intenção/pausa/cancelamento/auditoria e não notifica",async()=>{const s=await sugestaoEdicao355(c),ia=await intencaoIA355(c);const visto=await comAvisosInbox(async()=>{try{await prisma.$transaction(async tx=>{await aprovarSugestaoEditadaInboxTx(tx,c.dono.id,entrada(s.id,{texto:"Efeito que reverte"}));throw new ErroRegra("Abortar controle rollback355");});return "inesperado";}catch(e){if(!(e instanceof ErroRegra)||e.message!=="Abortar controle rollback355")throw e;return "rollback confirmado";}});expect(visto.resultado).toBe("rollback confirmado");expect(visto.avisos.filter(v=>v.atendimentoId===c.at.id)).toEqual([]);expect((await aprovada(s.id)).status).toBe("SUGERIDA");expect(await prisma.intencaoMensagem.count({where:{acaoAgenteIAId:s.id}})).toBe(0);expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:ia.id}})).status).toBe("PENDENTE");expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.at.id}})).iaPausadaEm).toBeNull();expect(await eventos(s.id)).toHaveLength(0);});