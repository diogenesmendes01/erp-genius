import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth",()=>({auth:vi.fn()}));vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { depoisDoCursorEmSql, preferenciasDaPaginaSql, contarLegadosComContexto } from "./consulta-sql";
import { whereAtendimentoEmSql } from "./where-sql";
const agora=new Date("2026-10-24T12:00:00.123Z");
describe("SQL fechado da página344",()=>{
  it("cursor de texto é parametrizado sem ensinar id.lt ao registry",()=>{
    const id="' OR 1=1 --",q=depoisDoCursorEmSql({em:agora.toISOString(),id});expect(q.values).toContain(id);expect(q.values).toContain(agora.toISOString());expect(q.sql).not.toContain(id);expect(q.sql).toContain('a."ultimaMensagemEm" IS NULL');
    expect(()=>whereAtendimentoEmSql({id:{lt:id}})).toThrow();
  });
  it("cursor nulo só continua entre datas nulas",()=>{
    const q=depoisDoCursorEmSql({em:null,id:"x"});expect(q.values).toEqual(["x"]);expect(q.sql).toContain('a."ultimaMensagemEm" IS NULL');expect(q.sql).not.toContain("timestamp");
  });
  it("snapshot vazio não consulta",async()=>{
    const db={$queryRaw:vi.fn()};expect(await preferenciasDaPaginaSql(db as never,"u",[],agora)).toEqual(new Map());expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it("legado conserva cinco campos e retira suas três dimensões",async()=>{
    const db={$queryRaw:vi.fn().mockResolvedValue([{todas:3n,minhas:1n,naoLidas:2n,prazo:1n,fila:1n}])};
    const f=Object.freeze({responsavel:"remover-id",naoLidas:true,prazoEstourado:true,busca:"Ana"});
    expect(await contarLegadosComContexto({db:db as never,usuarioId:"u",agora,escopo:{}},f)).toEqual({todas:3,minhas:1,naoLidas:2,prazo:1,fila:1});expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const q=db.$queryRaw.mock.calls[0][0];expect(q.values).not.toContain("remover-id");expect(q.values).toContain("%Ana%");expect(f.responsavel).toBe("remover-id");
  });
});
