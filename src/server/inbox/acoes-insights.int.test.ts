import { beforeEach,afterAll,expect,it,vi } from "vitest";
import { criarUsuario,truncarBanco } from "@/test/integracao";
import { cenarioInsight377,respostaInsight377 } from "@/test/inbox-insights";
import { conexao377,holder377,esperarBloqueio377 } from "@/test/inbox-insights-observacao";
const m=vi.hoisted(()=>({atorId:"",gerar:vi.fn()}));
vi.mock("@/server/_shared/sessao",async original=>{const real=await original<typeof import("@/server/_shared/sessao")>();return {...real,exigirSessao:async()=>{const u=await real.carregarUsuarioFresco(m.atorId);if(!u)throw new real.ErroAutenticacao();return u;}};});
vi.mock("@/server/aria/insights/gerador",()=>({servicosPadraoInsight:{disponivel:()=>true,executar:m.gerar}}));
import { prisma } from "@/lib/prisma";
import { atualizarInsightNoInbox,reconciliarInsightNoInbox,descartarInsightNoInbox } from "./acoes-insights";
import { prepararNovoInsight } from "@/server/aria/insights/claim";
import { GET } from "@/app/api/inbox/atendimentos/[id]/insights/route";
import type { AtualizarInsightInput } from "@/server/aria/insights/entradas";

beforeEach(async()=>{vi.resetAllMocks();m.gerar.mockResolvedValue(respostaInsight377());await truncarBanco();});afterAll(()=>prisma.$disconnect());
async function cenario(){const c=await cenarioInsight377();m.atorId=c.dono.id;return c;}
const ler=(id:string,g?:string)=>GET(new Request("http://local/api/inbox/atendimentos/"+id+"/insights"+(g?"?geracaoId="+encodeURIComponent(g):"")),{params:Promise.resolve({id})});
it("fronteiras públicas reais geram com providerfake1 e GETreadonly não gera novamente",async()=>{
  const c=await cenario(),r=await atualizarInsightNoInbox({tipo:"NOVO",atendimentoId:c.a.id,chaveTentativa:"377-wrapper-real-0001"});expect(r.ok).toBe(true);if(!r.ok||!r.dado)throw Error("fixture resultado");expect(r.dado).toMatchObject({estado:"PRONTA",statusPersistencia:"CONFIRMADA"});
  const g=await ler(c.a.id,r.dado.geracaoId);expect(g.status).toBe(200);expect(g.headers.get("cache-control")).toBe("no-store");const d=await g.json();expect(d.observada.estado).toBe("PRONTA");expect(d.painel.ultima.analise.textoSugerido).toBe("Texto fictício persistido377");expect(m.gerar).toHaveBeenCalledOnce();expect(await prisma.chamadaIA.count()).toBe(1);
  for(const campo of["chaveTentativa","autorId","configSnapshotJson","precosSnapshotJson","chamadaIAId"])expect(JSON.stringify(d)).not.toContain(campo);
});
it("público não aceita autor/demo/provider/envelope/custo do browser",async()=>{
  const c=await cenario();
  for(const extra of[{autorId:"arbitrario"},{demo:true},{provedor:"simulado"},{envelope:respostaInsight377()},{custoMicroUsd:0}]){
    const i={tipo:"NOVO",atendimentoId:c.a.id,chaveTentativa:"377-wrapper-input-01",...extra} as unknown as AtualizarInsightInput;
    expect((await atualizarInsightNoInbox(i)).ok).toBe(false);
  }
  expect(m.gerar).not.toHaveBeenCalled();expect(await prisma.geracaoInsightInbox.count()).toBe(0);expect(await prisma.chamadaIA.count()).toBe(0);
});
it("GET403 portal e404foraescopo sem expor análise; sessão negativa não inicia",async()=>{
  const c=await cenario(),aluno=await criarUsuario(["ALUNO"],"Portal fictício377");m.atorId=aluno.id;expect((await ler(c.a.id)).status).toBe(403);expect((await atualizarInsightNoInbox({tipo:"NOVO",atendimentoId:c.a.id,chaveTentativa:"377-wrapper-portal-01"})).ok).toBe(false);
  const outro=await criarUsuario(["VENDEDOR"],"Outro vendedor377");m.atorId=outro.id;expect((await ler(c.a.id)).status).toBe(404);expect((await atualizarInsightNoInbox({tipo:"NOVO",atendimentoId:c.a.id,chaveTentativa:"377-wrapper-escopo-01"})).ok).toBe(false);expect(m.gerar).not.toHaveBeenCalled();
});
it("retomar público usa claimoriginal porID/version/hash, sem devolver chave antiga",async()=>{
  const c=await cenario(),g=await prepararNovoInsight(c.dono.id,{atendimentoId:c.a.id,chaveTentativa:"377-wrapper-original-key"},{disponivel:true});const d=await(await ler(c.a.id,g.geracaoId)).json();
  const r=await atualizarInsightNoInbox({tipo:"RETOMAR",atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:g.versao,contextoAtualEsperadoHash:d.contextoAtualEsperadoHash});expect(r).toMatchObject({ok:true,dado:{estado:"PRONTA"}});expect(m.gerar).toHaveBeenCalledOnce();expect(JSON.stringify(r)).not.toContain("original-key");expect((await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:g.geracaoId}})).chaveTentativa).toBe("377-wrapper-original-key");
});
it("ações operacionais públicas usam metadatafresh e não chamam provider na resolução",async()=>{
  const c=await cenario(),g=await prepararNovoInsight(c.dono.id,{atendimentoId:c.a.id,chaveTentativa:"377-wrapper-operacional"},{disponivel:true});
  const {iniciarInsight}=await import("@/server/aria/insights/inicio");const s=await iniciarInsight(c.dono.id,{atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:g.versao,contextoAtualEsperadoHash:g.contextoAtualEsperadoHash});
  let d=await(await ler(c.a.id,g.geracaoId)).json();const r=await reconciliarInsightNoInbox({atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:s.versao,estadoEsperado:"PROCESSANDO",contextoAtualEsperadoHash:d.contextoAtualEsperadoHash,chaveReconciliacao:"377-wrapper-reconciliar"});expect(r).toMatchObject({ok:true,dado:{estado:"INCERTO"}});if(!r.ok||!r.dado)throw Error("fixture reconciliação");
  d=await(await ler(c.a.id,g.geracaoId)).json();expect(await descartarInsightNoInbox({atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:r.dado.versao,estadoEsperado:"INCERTO",contextoAtualEsperadoHash:d.contextoAtualEsperadoHash,chaveDescarte:"377-wrapper-descartar"})).toMatchObject({ok:true,dado:{estado:"DESCARTADA"}});expect(m.gerar).not.toHaveBeenCalled();expect(await prisma.chamadaIA.count()).toBe(0);
});
it("orçamento cai ENTREclaim/start porfilaSQLreal:0provider/FALHOUconfirmada e novo clique/chave após correção gera",async()=>{
  const c=await cenario(),h=await holder377("AtendimentoWhatsApp",c.a.id),o=await conexao377(),writer=await conexao377();
  let tentativa:Promise<Awaited<ReturnType<typeof atualizarInsightNoInbox>>>|undefined,update:Promise<unknown>|undefined;
  try{
    const pidWriter=(await writer.query<{pid:number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    tentativa=atualizarInsightNoInbox({tipo:"NOVO",atendimentoId:c.a.id,chaveTentativa:"377-wrapper-budget-001"});
    const bloqueados=await esperarBloqueio377(o,h.pid,"AtendimentoWhatsApp"),pidClaim=bloqueados[0].pid;
    await writer.query('BEGIN');update=writer.query('UPDATE "ConfigIA" SET "orcamentoMensalUsd"=0 WHERE id=\'ia\'');
    await esperarBloqueio377(o,pidClaim,"ConfigIA");await h.c.query('COMMIT');await update;
    await esperarBloqueio377(o,pidWriter,"ConfigIA");await writer.query('COMMIT');
    const falha=await tentativa;expect(falha).toMatchObject({ok:true,dado:{estado:"FALHOU",statusPersistencia:"CONFIRMADA",mensagem:"Orçamento de IA esgotado."}});expect(m.gerar).not.toHaveBeenCalled();expect(await prisma.chamadaIA.count()).toBe(0);
    expect((await prisma.geracaoInsightInbox.findFirstOrThrow()).iniciadaEm).toBeNull();
    await prisma.configIA.update({where:{id:"ia"},data:{orcamentoMensalUsd:100}});
    const replay=await atualizarInsightNoInbox({tipo:"NOVO",atendimentoId:c.a.id,chaveTentativa:"377-wrapper-budget-001"});expect(replay).toMatchObject({ok:true,dado:{estado:"FALHOU"}});expect(m.gerar).not.toHaveBeenCalled();
    const nova=await atualizarInsightNoInbox({tipo:"NOVO",atendimentoId:c.a.id,chaveTentativa:"377-wrapper-budget-002"});expect(nova).toMatchObject({ok:true,dado:{estado:"PRONTA"}});expect(m.gerar).toHaveBeenCalledOnce();expect(await prisma.chamadaIA.count()).toBe(1);
  }finally{await h.c.query('ROLLBACK').catch(()=>{});await writer.query('ROLLBACK').catch(()=>{});if(update)await Promise.allSettled([update]);if(tentativa)await Promise.allSettled([tentativa]);await Promise.all([h.c.end(),o.end(),writer.end()]);}
});

async function convite377(c:Awaited<ReturnType<typeof cenarioInsight377>>){
  const gc=await criarUsuario(["GERENTE_COMERCIAL"],"Concedente fictício377");
  await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.a.id,usuarioId:c.dono.id,concedenteId:gc.id,inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+3600000),motivo:"Convite comercial fictício377"}});
}
async function provarEscopoBrutoPortal(c:Awaited<ReturnType<typeof cenarioInsight377>>){
  const autor=await prisma.usuario.findUniqueOrThrow({where:{id:c.dono.id}}),{atendimentoVisivel}=await import("@/server/whatsapp/atendimentos"),{podeVerLeadNaThread}=await import("@/server/whatsapp/visibilidade-lead");
  expect(autor.papeis).toEqual(["ALUNO"]);expect(await atendimentoVisivel(autor,c.a.id,false,prisma)).not.toBeNull();expect(await podeVerLeadNaThread(autor,c.a.id,c.op.id,Date.now(),prisma)).toBe(true);
}
it("ALUNO exclusivo após espera na geração não atravessa convite/veLead no START",async()=>{
  const c=await cenario();await convite377(c);const g=await prepararNovoInsight(c.dono.id,{atendimentoId:c.a.id,chaveTentativa:"377-wrapper-portal-start"},{disponivel:true}),h=await holder377("GeracaoInsightInbox",g.geracaoId),o=await conexao377();
  const tentativa=atualizarInsightNoInbox({tipo:"RETOMAR",atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:g.versao,contextoAtualEsperadoHash:g.contextoAtualEsperadoHash!});
  try{
    await esperarBloqueio377(o,h.pid,"GeracaoInsightInbox");await h.c.query('UPDATE "Usuario" SET papeis=ARRAY[\'ALUNO\']::"Papel"[] WHERE id=$1',[c.dono.id]);await h.c.query('COMMIT');expect((await tentativa).ok).toBe(false);
    await provarEscopoBrutoPortal(c);expect(await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:g.geracaoId}})).toMatchObject({estado:"RECUSADA",iniciadaEm:null});expect(m.gerar).not.toHaveBeenCalled();expect(await prisma.chamadaIA.count()).toBe(0);
  }finally{await h.c.query('ROLLBACK').catch(()=>{});await Promise.allSettled([tentativa]);await Promise.all([h.c.end(),o.end()]);}
});
it("ALUNO exclusivo com convite não lê nem reconcilia request iniciado; knowncost continua persistindo",async()=>{
  const c=await cenario();await convite377(c);let responder!:(e:ReturnType<typeof respostaInsight377>)=>void,avisar!:()=>void;const entrou=new Promise<void>(r=>avisar=r);
  m.gerar.mockImplementationOnce(()=>{avisar();return new Promise(r=>responder=r);});
  const tentativa=atualizarInsightNoInbox({tipo:"NOVO",atendimentoId:c.a.id,chaveTentativa:"377-wrapper-portal-final"});
  try{
    await entrou;const g=await prisma.geracaoInsightInbox.findFirstOrThrow();expect(g.iniciadaEm).not.toBeNull();await prisma.usuario.update({where:{id:c.dono.id},data:{papeis:["ALUNO"]}});await provarEscopoBrutoPortal(c);
    const {contextoOperacionalInsight}=await import("@/server/aria/insights/contexto-autorizado"),{lerInsightAutorizado}=await import("@/server/aria/insights/leitura"),{reconciliarInsightInconclusivo}=await import("@/server/aria/insights/operacoes");
    expect(await contextoOperacionalInsight(prisma,c.dono.id,c.a.id)).toBeNull();expect(await lerInsightAutorizado(c.dono.id,c.a.id)).toBeNull();expect((await ler(c.a.id)).status).toBe(403);
    await expect(reconciliarInsightInconclusivo(c.dono.id,{atendimentoId:c.a.id,geracaoId:g.id,versaoEsperada:g.versao,estadoEsperado:"PROCESSANDO",contextoAtualEsperadoHash:g.contextoHash,chaveReconciliacao:"377-portal-reconcile-no"})).rejects.toThrow();
    responder(respostaInsight377());expect((await tentativa).ok).toBe(false);expect(await prisma.chamadaIA.count()).toBe(1);expect(await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:g.id}})).toMatchObject({estado:"RECUSADA",resultadoJson:null});expect(m.gerar).toHaveBeenCalledOnce();
  }finally{responder?.(respostaInsight377());await Promise.allSettled([tentativa]);}
});
it("ALUNO exclusivo com convite não descarta INCERTO já existente",async()=>{
  const c=await cenario();await convite377(c);m.gerar.mockResolvedValueOnce({tipo:"incerto",fase:"possivelmente-enviado",modelo:"claude-sonnet-5-5",provedor:"anthropic",latenciaMs:1,codigo:"USO_DESCONHECIDO",uso:null});
  const r=await atualizarInsightNoInbox({tipo:"NOVO",atendimentoId:c.a.id,chaveTentativa:"377-wrapper-portal-incerto"});expect(r).toMatchObject({ok:true,dado:{estado:"INCERTO"}});if(!r.ok||!r.dado)throw Error("fixture incerta");const g=await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:r.dado.geracaoId}});await prisma.usuario.update({where:{id:c.dono.id},data:{papeis:["ALUNO"]}});await provarEscopoBrutoPortal(c);
  const {descartarInsightIncerto}=await import("@/server/aria/insights/operacoes");await expect(descartarInsightIncerto(c.dono.id,{atendimentoId:c.a.id,geracaoId:g.id,versaoEsperada:g.versao,estadoEsperado:"INCERTO",contextoAtualEsperadoHash:g.contextoHash,chaveDescarte:"377-portal-descartar-no"})).rejects.toThrow();expect((await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:g.id}})).estado).toBe("INCERTO");expect(await prisma.chamadaIA.count()).toBe(0);
});
