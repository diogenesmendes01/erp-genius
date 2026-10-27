import {afterAll,beforeEach,expect,it,vi} from "vitest";
import type {Client} from "pg";
import {prisma} from "@/lib/prisma";
import {ErroRegra} from "../_shared/sessao";
import {truncarBanco} from "@/test/integracao";
import {cenarioEdicao355,sugestaoEdicao355,intencaoIA355,type CenarioEdicao355} from "@/test/aria-edicao355";
import {conectar355,holder355,iniciar355,pid355,esperarLock355,limpar355,exigirDominio355,resumoErro355,type Holder355,type Operacao355} from "@/test/aria-edicao355-concorrencia";
import {aprovarSugestaoEditadaInboxTx} from "./decisao-inbox";
import {executarResposta,type EntradaResposta} from "./turno/executor";
import {montarContextoTurno} from "./turno/contexto";
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
let c:CenarioEdicao355;
beforeEach(async()=>{await truncarBanco();c=await cenarioEdicao355();vi.stubGlobal("fetch",vi.fn(async()=>{throw Error("Transporte externo bloqueado355");}));});
afterAll(async()=>{vi.unstubAllGlobals();await prisma.$disconnect();});
const input=(id:string)=>({atendimentoId:c.at.id,id,edicao:{texto:"Resposta humana fictícia355"},chaveIdempotencia:"concorrencia355-key"});
async function semEfeito(id:string){expect((await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id}})).status).toBe("SUGERIDA");expect(await prisma.intencaoMensagem.count({where:{acaoAgenteIAId:id}})).toBe(0);expect(await prisma.evento.count({where:{agregadoId:id,tipo:"AcaoAriaAprovada"}})).toBe(0);expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.at.id}})).iaPausadaEm).toBeNull();}

it("355 claim do despachante (FOR UPDATE + UPDATE ENVIANDO) confirma enquanto aprovação espera a intenção depois do pai",async()=>{
 const s=await sugestaoEdicao355(c),ia=await intencaoIA355(c);expect(ia.status).toBe("PENDENTE");let holder:Holder355|undefined,observer:Client|undefined,op:Operacao355|undefined,primario:unknown;
 try{holder=await holder355('SELECT id FROM "IntencaoMensagem" WHERE id=$1 FOR UPDATE',ia.id);observer=await conectar355();op=iniciar355(tx=>aprovarSugestaoEditadaInboxTx(tx,c.dono.id,input(s.id)));await esperarLock355(observer,op,holder.pid,"intencao");
  let claimErro:unknown;try{await holder.pg.query('UPDATE "IntencaoMensagem" SET status=\'ENVIANDO\' WHERE id=$1',[ia.id]);await holder.pg.query("COMMIT");}catch(e){claimErro=e;throw e;}finally{op.diag.samples.push({holderClaim:claimErro?resumoErro355(claimErro):{ok:true}});}
  const r=await op.resultado;if(!r.ok)throw r.erro;expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:ia.id}})).status).toBe("ENVIANDO");expect(await prisma.intencaoMensagem.count({where:{acaoAgenteIAId:s.id,origem:"HUMANO"}})).toBe(1);expect(op.diag.ending).toEqual({ok:true});
 }catch(e){primario=e;throw e;}finally{await limpar355(primario,holder,observer,op?[op]:[]);}
});
it("355 novo candidato IA confirmado enquanto aprovação espera o pai entra no conjunto travado e é cancelado",async()=>{
 const s=await sugestaoEdicao355(c);let holder:Holder355|undefined,observer:Client|undefined,op:Operacao355|undefined,primario:unknown;const id="intencao-nova-ficticia355";
 try{holder=await holder355('SELECT id FROM "AtendimentoWhatsApp" WHERE id=$1 FOR NO KEY UPDATE',c.at.id);observer=await conectar355();op=iniciar355(tx=>aprovarSugestaoEditadaInboxTx(tx,c.dono.id,input(s.id)));await esperarLock355(observer,op,holder.pid,"pai");
  await holder.pg.query('INSERT INTO "IntencaoMensagem" (id,"numeroId","contatoId","atendimentoId",origem,status,tipo,"corpoRenderizado","atualizadoEm") VALUES ($1,$2,$3,$4,\'IA\',\'PENDENTE\',\'TEXTO\',\'Candidato fictício355\',CURRENT_TIMESTAMP)',[id,c.numero.id,c.contato.id,c.at.id]);await holder.pg.query("COMMIT");
  const r=await op.resultado;if(!r.ok)throw r.erro;expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id}})).status).toBe("CANCELADA");expect(await prisma.intencaoMensagem.count({where:{acaoAgenteIAId:s.id,origem:"HUMANO"}})).toBe(1);expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.at.id}})).iaPausadaEm).not.toBeNull();
 }catch(e){primario=e;throw e;}finally{await limpar355(primario,holder,observer,op?[op]:[]);}
});
it.each(["responsavel","ativo"] as const)("355 revogação real de %s durante espera no pai recusa domínio",async modo=>{
 const s=await sugestaoEdicao355(c);let holder:Holder355|undefined,observer:Client|undefined,op:Operacao355|undefined,primario:unknown;
 try{holder=await holder355('SELECT id FROM "AtendimentoWhatsApp" WHERE id=$1 FOR NO KEY UPDATE',c.at.id);observer=await conectar355();op=iniciar355(tx=>aprovarSugestaoEditadaInboxTx(tx,c.dono.id,input(s.id)));await esperarLock355(observer,op,holder.pid,"pai");
  if(modo==="responsavel")await holder.pg.query('UPDATE "AtendimentoWhatsApp" SET "responsavelId"=NULL WHERE id=$1',[c.at.id]);else await holder.pg.query('UPDATE "Usuario" SET ativo=false WHERE id=$1',[c.dono.id]);await holder.pg.query("COMMIT");
  exigirDominio355(await op.resultado,"ErroPermissao",modo==="ativo"?"Sua sessão não está mais ativa.":"Esta ação está fora do seu escopo no atendimento.");await semEfeito(s.id);
 }catch(e){primario=e;throw e;}finally{await limpar355(primario,holder,observer,op?[op]:[]);}
});
it("355 produtor IA canônico iniciado após reread aguarda pai e observa pausa nova",async()=>{
 const s=await sugestaoEdicao355(c);const ctx=await montarContextoTurno(c.at.id);const entrada:EntradaResposta={turnoId:c.turno.id,ctx,texto:"Resposta IA fictícia sem preço",documentoId:null,destino:"EXECUTAR",simulado:false,confianca:90,fontes:[],nomeAria:"Aria"};
 try{await prisma.$transaction(async tx=>{const r=await executarResposta(tx,entrada);expect("acao" in r).toBe(true);if("acao" in r)expect(await tx.intencaoMensagem.count({where:{acaoAgenteIAId:r.acao.id}})).toBe(1);throw new ErroRegra("Canário IA355 rollback");});}catch(e){if(!(e instanceof ErroRegra)||e.message!=="Canário IA355 rollback")throw e;}
 let release!:()=>void,signal!:()=>void;const gate=new Promise<void>(r=>release=r),pronto=new Promise<void>(r=>signal=r);let observer:Client|undefined,aprovar:Operacao355|undefined,produzir:Operacao355|undefined,primario:unknown;
 try{observer=await conectar355();aprovar=iniciar355(tx=>aprovarSugestaoEditadaInboxTx(tx,c.dono.id,input(s.id)),async()=>{signal();await gate;});
  let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([pronto,aprovar.resultado.then(()=>{throw Error("Aprovação terminou antes do reread355");}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("Reread355 não chegou em 2s")),2000);})]);}finally{if(timer)clearTimeout(timer);}
  produzir=iniciar355(tx=>executarResposta(tx,entrada));await esperarLock355(observer,produzir,await pid355(aprovar),"pai");release();const a=await aprovar.resultado;if(!a.ok)throw a.erro;const r=await produzir.resultado;if(!r.ok)throw r.erro;expect(r.valor).toEqual({bloqueada:"PAUSADA_DURANTE_TURNO"});expect(await prisma.intencaoMensagem.count({where:{atendimentoId:c.at.id,origem:"IA"}})).toBe(0);expect(await prisma.intencaoMensagem.count({where:{acaoAgenteIAId:s.id,origem:"HUMANO"}})).toBe(1);
 }catch(e){primario=e;throw e;}finally{await limpar355(primario,undefined,observer,[aprovar,produzir].filter((o):o is Operacao355=>!!o),()=>release?.());}
});
it.each([
 ["encerramento","UPDATE \"AtendimentoWhatsApp\" SET \"encerradoEm\"=CURRENT_TIMESTAMP,status='ENCERRADO' WHERE id=$1","UPDATE \"IntencaoMensagem\" SET status='CANCELADA',\"motivoFalha\"='atendimento_encerrado' WHERE \"atendimentoId\"=$1 AND status IN ('PENDENTE','ADIADA')"],
 ["handoff da Aria","SELECT id FROM \"AtendimentoWhatsApp\" WHERE id=$1 FOR UPDATE","WITH c AS (UPDATE \"IntencaoMensagem\" SET status='CANCELADA',\"motivoFalha\"='aria_pausada',\"despacharAposEm\"=NULL WHERE \"atendimentoId\"=$1 AND origem='IA' AND status IN ('PENDENTE','ADIADA') RETURNING id) UPDATE \"AtendimentoWhatsApp\" SET \"iaPausadaEm\"=CURRENT_TIMESTAMP,\"iaPausaMotivo\"='HANDOFF' WHERE id=$1 AND \"iaPausadaEm\" IS NULL"],
] as const)("355 %s que trava o pai e depois cancela intenções IA não entra em deadlock com a aprovação editada",async(modo,travaPai,cancelaIntencoes)=>{
 const s=await sugestaoEdicao355(c),ia=await intencaoIA355(c);let holder:Holder355|undefined,observer:Client|undefined,op:Operacao355|undefined,primario:unknown;
 try{holder=await holder355(travaPai,c.at.id);observer=await conectar355();op=iniciar355(tx=>aprovarSugestaoEditadaInboxTx(tx,c.dono.id,input(s.id)));await esperarLock355(observer,op,holder.pid,"pai");
  let holderErro:unknown;try{await holder.pg.query(cancelaIntencoes,[c.at.id]);await holder.pg.query("COMMIT");}catch(e){holderErro=e;throw e;}finally{op.diag.samples.push({modo,holder:holderErro?resumoErro355(holderErro):{ok:true}});}
  const r=await op.resultado;if(!r.ok&&!resumoErro355(r.erro).dominio)throw new AggregateError([r.erro],"Aprovação editada falhou por infraestrutura355");
  expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:ia.id}})).status).toBe("CANCELADA");
  if(modo==="encerramento"){expect(r.ok).toBe(false);await semEfeito(s.id);}
 }catch(e){primario=e;throw e;}finally{await limpar355(primario,holder,observer,op?[op]:[]);}
});
