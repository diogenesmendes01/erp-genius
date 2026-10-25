import { describe, expect, it } from "vitest";
import { estadoAriaEmSql, handoffPendenteEmSql, sugestaoPendenteEmSql } from "./estado-aria-sql";
const agora=new Date("2026-10-24T12:00:00.123Z");
describe("composição SQL fechada EstadoAria344",()=>{
  it("parametriza estados, ativação e instante sem IDs globais",()=>{
    const q=estadoAriaEmSql(true,agora);
    for(const estado of ["handoff","humano","aprovacao","ia"])expect(q.values).toContain(estado);
    expect(q.values).toContain(true);expect(q.values).toContain(agora.toISOString());expect(q.sql).toContain("timestamp(3)");
    expect(q.values.some(Array.isArray)).toBe(false);
  });
  it("correlaciona H com atendimento e mantém fronteiras estritas",()=>{
    const q=handoffPendenteEmSql();expect(q.sql).toContain('m."atendimentoId" = a."id"');expect(q.sql).toContain('e."agregadoId" = a."id"');expect(q.sql).toContain('> a."iaPausadaEm"');
    expect(q.sql).not.toContain("JOIN");expect(q.sql).not.toContain("LIMIT");
  });
  it("sugestão vigente é EXISTS, sem payload ou limite",()=>{
    const q=sugestaoPendenteEmSql(agora);expect(q.sql).toContain("EXISTS");expect(q.values).toContain(agora.toISOString());expect(q.sql).not.toMatch(/payload|LIMIT/);
  });
  it("recusa Date inválido antes de executar",()=>expect(()=>estadoAriaEmSql(true,new Date(NaN))).toThrow());
});
