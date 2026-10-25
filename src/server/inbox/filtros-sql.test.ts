import { describe, expect, it } from "vitest";
import { filtrosEmSql, naoLidaPessoalEmSql, condicoesWhereDosFiltros } from "./filtros-sql";
const agora=new Date("2026-10-24T12:00:00.123Z");
const ctx={usuarioId:"u",agora,escopo:{},ariaAtiva:true};
describe("composição SQL dos filtros344",()=>{
  it("mantém as dimensões completas e não muta filtros/escopo",()=>{
    const f=Object.freeze({setor:"COMERCIAL" as const,numeroId:"n",responsavel:"fila",status:"EM_ATENDIMENTO" as const,prazoEstourado:true,naoLidas:true,aria:"handoff" as const,busca:"Ana"});
    const antes=JSON.stringify(f),escopo=Object.freeze({id:"permitido"});const q=filtrosEmSql({...ctx,escopo},f);
    expect(JSON.stringify(f)).toBe(antes);expect(escopo).toEqual({id:"permitido"});expect(q.values).toEqual(expect.arrayContaining(["permitido","COMERCIAL","n","EM_ATENDIMENTO",agora.toISOString(),"handoff","%Ana%","u"]));expect(q.sql).toContain("CASE");
  });
  it("aria exige contexto efetivo e whitelist exata",()=>{
    expect(()=>filtrosEmSql({...ctx,ariaAtiva:undefined},{aria:"ia"})).toThrow();expect(()=>filtrosEmSql(ctx,{aria:"IA"} as never)).toThrow();
  });
  it("sem aria não exige global; não lidas é correlacionado sem array de IDs",()=>{
    expect(()=>filtrosEmSql({...ctx,ariaAtiva:undefined},{naoLidas:true})).not.toThrow();const q=naoLidaPessoalEmSql("u");expect(q.values.some(Array.isArray)).toBe(false);expect(q.sql).toContain('m."atendimentoId" = a."id"');
  });
  it("where escalar não recebe SQL nem ariastate",()=>{
    const w=condicoesWhereDosFiltros("u",{responsavel:"eu",aria:"ia",naoLidas:true,prazoEstourado:true},agora);expect(w).toEqual([{responsavelId:"u"},{prazoRespostaEm:{lt:agora},primeiraRespostaEm:null,encerradoEm:null}]);
  });
});
