import { beforeEach,afterAll,expect,it,vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { cenarioInsight377,respostaInsight377 } from "@/test/inbox-insights";
import { prepararNovoInsight } from "./claim";
import { iniciarInsight } from "./inicio";
import { finalizarInsight } from "./finalizacao";
import { lerInsightAutorizado } from "./leitura";
import { reconciliarInsightInconclusivo,descartarInsightIncerto } from "./operacoes";
import { executarAtualizacaoInsight } from "./controlador";
import * as barramento from "@/server/inbox/barramento";

beforeEach(async()=>{vi.restoreAllMocks();await truncarBanco();});
afterAll(()=>prisma.$disconnect());
async function claim(c:Awaited<ReturnType<typeof cenarioInsight377>>,chave="377-tentativa-00001") {
  return prepararNovoInsight(c.dono.id,{atendimentoId:c.a.id,chaveTentativa:chave},{disponivel:true});
}
async function start(c:Awaited<ReturnType<typeof cenarioInsight377>>) {
  const g=await claim(c);
  const s=await iniciarInsight(c.dono.id,{atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:g.versao,contextoAtualEsperadoHash:g.contextoAtualEsperadoHash});
  expect(s.iniciada).toBe(true);return s;
}
it("claim/start/final reais: PRONTA e custoINSIGHT1 sem alterar CRM",async()=>{
  const c=await cenarioInsight377(),antes=await prisma.oportunidade.findUniqueOrThrow({where:{id:c.op.id}}),s=await start(c);
  expect(await finalizarInsight({atendimentoId:c.a.id,geracaoId:s.geracaoId,envelope:respostaInsight377(),recebidoEm:new Date()})).toMatchObject({estado:"PRONTA"});
  expect(await prisma.chamadaIA.findMany()).toMatchObject([{origem:"INSIGHT",tokensEntrada:100,tokensSaida:30}]);
  expect(await prisma.oportunidade.findUniqueOrThrow({where:{id:c.op.id}})).toEqual(antes);
  const r=await lerInsightAutorizado(c.dono.id,c.a.id,{geracaoId:s.geracaoId});expect(r?.observada?.estado).toBe("PRONTA");expect(r?.painel?.ultima?.analise.textoSugerido).toBe("Texto fictício persistido377");
});
it("dois claims mesma chave retornam1geração e dois STARTs elegem1packet",async()=>{
  const c=await cenarioInsight377(),rr=await Promise.all([claim(c),claim(c)]);expect(rr[0].geracaoId).toBe(rr[1].geracaoId);expect(await prisma.geracaoInsightInbox.count()).toBe(1);
  const i={atendimentoId:c.a.id,geracaoId:rr[0].geracaoId,versaoEsperada:rr[0].versao,contextoAtualEsperadoHash:rr[0].contextoAtualEsperadoHash};
  const ss=await Promise.all([iniciarInsight(c.dono.id,i),iniciarInsight(c.dono.id,i)]);expect(ss.filter(s=>s.iniciada)).toHaveLength(1);expect(await prisma.evento.count({where:{tipo:"InsightInboxIniciado"}})).toBe(1);
});
it("limite baixado entre claim/START terminaFALHOU e chave antiga não envia",async()=>{
  const c=await cenarioInsight377(),g=await claim(c);await prisma.configIA.update({where:{id:"ia"},data:{orcamentoMensalUsd:0}});
  const s=await iniciarInsight(c.dono.id,{atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:0,contextoAtualEsperadoHash:g.contextoAtualEsperadoHash});expect(s).toMatchObject({iniciada:false,estado:"FALHOU"});expect((await claim(c)).deveIniciar).toBe(false);expect(await prisma.chamadaIA.count()).toBe(0);
  await prisma.configIA.update({where:{id:"ia"},data:{orcamentoMensalUsd:100}});expect((await claim(c,"377-tentativa-00002")).deveIniciar).toBe(true);
});
it("Config deletada antesSTART termina falha pré-envio sem custo fictício",async()=>{
  const c=await cenarioInsight377(),g=await claim(c);await prisma.configIA.delete({where:{id:"ia"}});
  expect(await iniciarInsight(c.dono.id,{atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:0,contextoAtualEsperadoHash:g.contextoAtualEsperadoHash})).toMatchObject({iniciada:false,estado:"FALHOU"});expect(await prisma.chamadaIA.count()).toBe(0);
});
it("ACL revogada apósSTART impede publicação mas conserva custo conhecido",async()=>{
  const c=await cenarioInsight377(),s=await start(c);await prisma.usuario.update({where:{id:c.dono.id},data:{papeis:["PROFESSOR"]}});
  expect(await finalizarInsight({atendimentoId:c.a.id,geracaoId:s.geracaoId,envelope:respostaInsight377(),recebidoEm:new Date()})).toMatchObject({estado:"RECUSADA",autorizado:false});expect(await prisma.chamadaIA.count()).toBe(1);expect((await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:s.geracaoId}})).resultadoJson).toBeNull();expect(await lerInsightAutorizado(c.dono.id,c.a.id)).toBeNull();
});
it("JSON de domínio inválido conserva uso e não inventa análise",async()=>{
  const c=await cenarioInsight377(),s=await start(c),e=respostaInsight377();if(e.tipo!=="resposta")throw new Error("fixture");
  expect(await finalizarInsight({atendimentoId:c.a.id,geracaoId:s.geracaoId,envelope:{...e,texto:'{"campoInventado":true}'},recebidoEm:new Date()})).toMatchObject({estado:"FALHOU"});expect(await prisma.chamadaIA.count()).toBe(1);
});
it("orçamento alterado apósSTART não apaga uso conhecido nem consulta config na finalização",async()=>{
  const c=await cenarioInsight377(),s=await start(c);await prisma.configIA.delete({where:{id:"ia"}});
  expect(await finalizarInsight({atendimentoId:c.a.id,geracaoId:s.geracaoId,envelope:respostaInsight377(),recebidoEm:new Date()})).toMatchObject({estado:"PRONTA"});expect(await prisma.chamadaIA.count()).toBe(1);
});
it("reconciliação explícita/descarte/latecost não revivem resultado e replay é semEvento",async()=>{
  const c=await cenarioInsight377(),s=await start(c),r=await lerInsightAutorizado(c.dono.id,c.a.id);if(!r)throw new Error("fixture ACL");
  const i={atendimentoId:c.a.id,geracaoId:s.geracaoId,versaoEsperada:s.versao,estadoEsperado:"PROCESSANDO" as const,contextoAtualEsperadoHash:r.contextoAtualEsperadoHash,chaveReconciliacao:"377-reconciliar-0001"};
  const incerto=await reconciliarInsightInconclusivo(c.dono.id,i),eventos=await prisma.evento.count();expect(await reconciliarInsightInconclusivo(c.dono.id,i)).toEqual(incerto);expect(await prisma.evento.count()).toBe(eventos);
  await descartarInsightIncerto(c.dono.id,{atendimentoId:c.a.id,geracaoId:s.geracaoId,versaoEsperada:incerto.versao,estadoEsperado:"INCERTO",contextoAtualEsperadoHash:r.contextoAtualEsperadoHash,chaveDescarte:"377-descartar-0001"});
  expect(await finalizarInsight({atendimentoId:c.a.id,geracaoId:s.geracaoId,envelope:respostaInsight377(),recebidoEm:new Date()})).toMatchObject({estado:"DESCARTADA"});expect(await prisma.chamadaIA.count()).toBe(1);expect((await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:s.geracaoId}})).resultadoJson).toBeNull();
});
it("replay finalização não duplica ChamadaIA/Evento mesmo após ACK perdido",async()=>{
  const c=await cenarioInsight377(),s=await start(c),i={atendimentoId:c.a.id,geracaoId:s.geracaoId,envelope:respostaInsight377(),recebidoEm:new Date()};
  const a=await finalizarInsight(i),eventos=await prisma.evento.count();expect(await finalizarInsight(i)).toEqual(a);expect(await prisma.evento.count()).toBe(eventos);expect(await prisma.chamadaIA.count()).toBe(1);
});
it("falha de barramento injetada reverte custo/FK/Evento/terminal juntos",async()=>{
  const c=await cenarioInsight377(),s=await start(c),eventos=await prisma.evento.count();vi.spyOn(barramento,"avisarAtendimentoAtualizado").mockRejectedValueOnce(new Error("falha injetada377"));
  await expect(finalizarInsight({atendimentoId:c.a.id,geracaoId:s.geracaoId,envelope:respostaInsight377(),recebidoEm:new Date()})).rejects.toThrow("falha injetada377");expect(await prisma.chamadaIA.count()).toBe(0);expect(await prisma.evento.count()).toBe(eventos);expect(await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:s.geracaoId}})).toMatchObject({estado:"PROCESSANDO",chamadaIAId:null});
});
it("mensagem nova duranteprovider e watermark empate sobrevivem à exclusão da últimaID",async()=>{
  const c=await cenarioInsight377(),s=await start(c);await prisma.mensagemWhatsApp.delete({where:{id:"m377-0002"}});await prisma.mensagemWhatsApp.create({data:{id:"m377-0003",conversaId:c.conversa.id,numeroId:c.numero.id,atendimentoId:c.a.id,direcao:"ENTRADA",driver:"MOTOR",status:"ENTREGUE",corpo:"Nova mensagem fictícia",criadoEm:new Date("2026-10-25T12:00:00Z")}});
  await finalizarInsight({atendimentoId:c.a.id,geracaoId:s.geracaoId,envelope:respostaInsight377(),recebidoEm:new Date()});expect((await lerInsightAutorizado(c.dono.id,c.a.id))?.painel?.novasMensagens).toBe(1);
  await prisma.mensagemWhatsApp.delete({where:{id:"m377-0003"}});expect((await lerInsightAutorizado(c.dono.id,c.a.id))?.painel?.novasMensagens).toBe(0);
});
it("orquestrador real não chama provider mais de1vez e conserva snapshotrecebido",async()=>{
  const c=await cenarioInsight377(),executar=vi.fn(async()=>respostaInsight377());
  expect(await executarAtualizacaoInsight(c.dono.id,{tipo:"NOVO",atendimentoId:c.a.id,chaveTentativa:"377-orquestrador-0001"},{servicos:{disponivel:()=>true,executar}})).toMatchObject({estado:"PRONTA",statusPersistencia:"CONFIRMADA"});expect(executar).toHaveBeenCalledOnce();expect(await prisma.chamadaIA.count()).toBe(1);
});

it("Pessoa incompatível após retarget permite descarte operacional coerente sem gerar/análise",async()=>{
  const c=await cenarioInsight377(),s=await start(c),r=await lerInsightAutorizado(c.dono.id,c.a.id);if(!r)throw Error("fixture ACL");
  const incerta=await reconciliarInsightInconclusivo(c.dono.id,{atendimentoId:c.a.id,geracaoId:s.geracaoId,versaoEsperada:s.versao,estadoEsperado:"PROCESSANDO",contextoAtualEsperadoHash:r.contextoAtualEsperadoHash,chaveReconciliacao:"377-pessoa-incerta-01"});
  const pLead=await prisma.pessoa.create({data:{nome:"Pessoa oportunidade377"}}),pContato=await prisma.pessoa.create({data:{nome:"Pessoa contato377"}});
  await prisma.oportunidade.update({where:{id:c.op.id},data:{pessoaId:pLead.id}});await prisma.contatoWhatsApp.update({where:{id:c.contato.id},data:{pessoaId:pContato.id}});
  const atual=await lerInsightAutorizado(c.dono.id,c.a.id);expect(atual?.emCurso?.podeDescartar).toBe(true);expect(atual?.painel?.podeDescartarIncerta).toBe(true);expect(atual?.painel?.podeAtualizar).toBe(false);expect(atual?.painel?.ultima).toBeNull();if(!atual)throw Error("fixture audiência operacional");
  expect(await descartarInsightIncerto(c.dono.id,{atendimentoId:c.a.id,geracaoId:s.geracaoId,versaoEsperada:incerta.versao,estadoEsperado:"INCERTO",contextoAtualEsperadoHash:atual.contextoAtualEsperadoHash,chaveDescarte:"377-pessoa-descartar-01"})).toMatchObject({estado:"DESCARTADA"});expect(await prisma.chamadaIA.count()).toBe(0);
});
