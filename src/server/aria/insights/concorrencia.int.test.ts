import { beforeEach,afterAll,expect,it } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { cenarioInsight377,respostaInsight377 } from "@/test/inbox-insights";
import { conexao377,holder377,esperarBloqueio377,pausa377 } from "@/test/inbox-insights-observacao";
import type { Client } from "pg";
import { prepararNovoInsight } from "./claim";
import { iniciarInsight } from "./inicio";
import { finalizarInsight } from "./finalizacao";
import { lerInsightAutorizado } from "./leitura";
import { reconciliarInsightInconclusivo } from "./operacoes";

beforeEach(()=>truncarBanco());afterAll(()=>prisma.$disconnect());
async function preparar(){const c=await cenarioInsight377(),g=await prepararNovoInsight(c.dono.id,{atendimentoId:c.a.id,chaveTentativa:"377-concorrencia-0001"},{disponivel:true});return {c,g,i:{atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:g.versao,contextoAtualEsperadoHash:g.contextoAtualEsperadoHash}};}
async function comBarreira<T>(tabela:"AtendimentoWhatsApp"|"GeracaoInsightInbox",id:string,acao:()=>Promise<T>,alterar:(holder:Client)=>Promise<unknown>) {
  const h=await holder377(tabela,id),observador=await conexao377();
  // Captura rejeição imediatamente, sem deixar unhandled enquanto observa a espera.
  const tentativa=acao().then(valor=>({valor}),erro=>({erro}));
  try {
    const bloqueados=await esperarBloqueio377(observador,h.pid,tabela);expect(bloqueados.length).toBeGreaterThan(0);
    await alterar(h.c);await h.c.query('COMMIT');
    const r=await tentativa;if('erro'in r)throw r.erro;return r.valor;
  }finally{await h.c.query('ROLLBACK').catch(()=>{});await tentativa;await Promise.all([h.c.end(),observador.end()]);}
}
it("START bloqueado na geração revalida papéis após espera SQL real",async()=>{
  const {c,g,i}=await preparar();
  const r=await comBarreira("GeracaoInsightInbox",g.geracaoId,()=>iniciarInsight(c.dono.id,i),h=>h.query('UPDATE "Usuario" SET papeis=ARRAY[\'PROFESSOR\']::"Papel"[] WHERE id=$1',[c.dono.id]));
  expect(r).toMatchObject({iniciada:false,negado:true});expect(await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:g.geracaoId}})).toMatchObject({estado:"RECUSADA",iniciadaEm:null});expect(await prisma.chamadaIA.count()).toBe(0);
});
it("START bloqueado no Atendimento recusa ponteiroPessoa trocado antes da marca",async()=>{
  const {c,g,i}=await preparar(),p=await prisma.pessoa.create({data:{nome:"Pessoa fictícia nova377"}});
  const r=await comBarreira("AtendimentoWhatsApp",c.a.id,()=>iniciarInsight(c.dono.id,i),h=>h.query('UPDATE "ContatoWhatsApp" SET "pessoaId"=$1 WHERE id=$2',[p.id,c.contato.id]));
  expect(r).toMatchObject({iniciada:false,negado:true});expect(await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:g.geracaoId}})).toMatchObject({estado:"RECUSADA",iniciadaEm:null});expect(await prisma.chamadaIA.count()).toBe(0);
});
it("finalização após espera SQL conserva custo mas recusa publicação após revogação",async()=>{
  const {c,g,i}=await preparar();await iniciarInsight(c.dono.id,i);
  const r=await comBarreira("GeracaoInsightInbox",g.geracaoId,()=>finalizarInsight({atendimentoId:c.a.id,geracaoId:g.geracaoId,envelope:respostaInsight377(),recebidoEm:new Date()}),h=>h.query('UPDATE "Usuario" SET ativo=false WHERE id=$1',[c.dono.id]));
  expect(r).toMatchObject({estado:"RECUSADA",autorizado:false});expect(await prisma.chamadaIA.count()).toBe(1);expect((await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:g.geracaoId}})).resultadoJson).toBeNull();
});
it("reconciliação bloqueada revalida hash atual, sem confirmar intenção de contexto anterior",async()=>{
  const {c,g,i}=await preparar(),s=await iniciarInsight(c.dono.id,i),p=await prisma.pessoa.create({data:{nome:"Pessoa rebind377"}}),r=await lerInsightAutorizado(c.dono.id,c.a.id);if(!r)throw Error("fixture ACL");
  await expect(comBarreira("GeracaoInsightInbox",g.geracaoId,()=>reconciliarInsightInconclusivo(c.dono.id,{atendimentoId:c.a.id,geracaoId:g.geracaoId,versaoEsperada:s.versao,estadoEsperado:"PROCESSANDO",contextoAtualEsperadoHash:r.contextoAtualEsperadoHash,chaveReconciliacao:"377-reconciliar-wait"}),h=>h.query('UPDATE "ContatoWhatsApp" SET "pessoaId"=$1 WHERE id=$2',[p.id,c.contato.id]))).rejects.toThrow();
  expect((await prisma.geracaoInsightInbox.findUniqueOrThrow({where:{id:g.geracaoId}})).estado).toBe("PROCESSANDO");expect(await prisma.evento.count({where:{tipo:"InsightInboxIncertezaReconhecida"}})).toBe(0);
});
it("doisSTART aguardam holder real e somente um obtém pacote",async()=>{
  const {c,g,i}=await preparar(),h=await holder377("AtendimentoWhatsApp",c.a.id),o=await conexao377();
  const chamadas=[iniciarInsight(c.dono.id,i),iniciarInsight(c.dono.id,i)];const final=Promise.allSettled(chamadas);
  try{await esperarBloqueio377(o,h.pid,"AtendimentoWhatsApp",2);await h.c.query('COMMIT');const rr=await Promise.all(chamadas);expect(rr.filter(r=>r.iniciada)).toHaveLength(1);expect(await prisma.evento.count({where:{tipo:"InsightInboxIniciado"}})).toBe(1);expect(await prisma.geracaoInsightInbox.count({where:{id:g.geracaoId,iniciadaEm:{not:null}}})).toBe(1);}
  finally{await h.c.query('ROLLBACK').catch(()=>{});await final;await Promise.all([h.c.end(),o.end()]);}
});
it("holderKEYSHARE permanece retido até finalização concluir sem upgrade do Atendimento",async()=>{
  const {c,g,i}=await preparar();await iniciarInsight(c.dono.id,i);
  const h=await holder377("AtendimentoWhatsApp",c.a.id,"KEY SHARE"),o=await conexao377();let concluidaEnquantoRetido=false,erro:unknown;
  const tentativa=finalizarInsight({atendimentoId:c.a.id,geracaoId:g.geracaoId,envelope:respostaInsight377(),recebidoEm:new Date()}).then(()=>{concluidaEnquantoRetido=true;},e=>{erro=e;});
  try {
    const fim=Date.now()+3500;while(!concluidaEnquantoRetido&&!erro&&Date.now()<fim)await pausa377(10);
    expect(erro).toBeUndefined();expect(concluidaEnquantoRetido).toBe(true);
    const bloqueios=await o.query<{n:string}>(`SELECT count(*)::text AS n FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))`,[h.pid]);expect(Number(bloqueios.rows[0].n)).toBe(0);
    expect(await prisma.chamadaIA.count()).toBe(1);
  }finally{await h.c.query('ROLLBACK');await tentativa;await Promise.all([h.c.end(),o.end()]);}
});
