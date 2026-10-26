import{expect,it,vi}from"vitest";
import type{Prisma}from"@prisma/client";
import{calcularEstadoOrcamento}from"../aria/uso";
import{lerContextoAtualInbox}from"./enfileirar-inbox";
it.each([[0,"OK"],[79_999_999,"OK"],[80_000_000,"ALERTA"],[100_000_000,"ESTOURADO"]]as const)("358 cálculo canônico de orçamento preserva limite/ação em %s",(custo,situacao)=>{expect(calcularEstadoOrcamento({orcamentoMensalUsd:"100.00",acaoAoEstourar:"PAUSAR"},custo)).toEqual({situacao,gastoUsd:custo/1_000_000,limiteUsd:100,acao:"PAUSAR"});});
it("358 leitura configausente depoispai falha fechado sem upsert, aggregate ou consulta local",async()=>{
 const db={agenteIA:{findUnique:vi.fn(async()=>null)},versaoAgenteIA:{findFirst:vi.fn(async()=>null)},configIA:{findUnique:vi.fn(async()=>null),upsert:vi.fn()},chamadaIA:{aggregate:vi.fn()},$queryRaw:vi.fn()};
 await expect(lerContextoAtualInbox(db as unknown as Prisma.TransactionClient,"a")).rejects.toThrow("A configuração da Aria mudou");expect(db.configIA.upsert).not.toHaveBeenCalled();expect(db.chamadaIA.aggregate).not.toHaveBeenCalled();expect(db.$queryRaw).not.toHaveBeenCalled();
});
