import { describe, it, expect } from "vitest";
import { proporReplanejamentoGrade } from "./replanejamento-grade";
const encontro = (id: string, dia: string, status: "MINISTRADO" | "PREVISTO" | "CANCELADO" | "NAO_REALIZADO" | "IMPEDIDO_ESCOLA" = "PREVISTO") => ({ id, inicio: `${dia}T19:00:00.000Z`, fim: `${dia}T20:00:00.000Z`, status });
const entrada = () => ({ agora: "2026-09-08T12:00:00.000Z", grade: { dataInicial: "2026-09-07", diasSemana: [1,3], horario: "19:00", duracaoMinutos: 60,
  fusoOrigem: "UTC", fusoEscola: "UTC", periodos: [] as { id: string; nome: string; tipo: "FERIADO"; inicio: string; fim: string }[] },
  encontros: [encontro("passada", "2026-09-07", "MINISTRADO"), encontro("a", "2026-09-09"), encontro("b", "2026-09-14")] });
describe("proposta de revisão de grade", () => {
 it("inclui feriado preservando passado, quantidade e identidade dos encontros", () => {
  const d = entrada(); d.grade.periodos.push({ id:"feriado",nome:"Feriado",tipo:"FERIADO",inicio:"2026-09-09",fim:"2026-09-09" });
  const r = proporReplanejamentoGrade(d);
  expect(r.preservados).toEqual([d.encontros[0]]);
  expect(r.propostas.map((p) => [p.encontroId,p.inicioProposto])).toEqual([["a","2026-09-14T19:00:00.000Z"],["b","2026-09-16T19:00:00.000Z"]]);
  expect(r.aplicada).toBe(false); expect(d.encontros[1].inicio).toBe("2026-09-09T19:00:00.000Z");
 });
 it("aproveita dia liberado sem manter artificialmente a antiga data futura", () => {
  const d = entrada(); d.encontros=[d.encontros[0],encontro("a","2026-09-14"),encontro("b","2026-09-16")];
  expect(proporReplanejamentoGrade(d).propostas.map((p) => p.inicioProposto)).toEqual(["2026-09-09T19:00:00.000Z","2026-09-14T19:00:00.000Z"]);
 });
 it("preserva aula passada pendente e cancelamento sem criar substituta automaticamente", () => {
  const d = entrada(); d.encontros[0].status="PREVISTO"; d.encontros.push(encontro("cancelada","2026-09-10","CANCELADO"));
  const r=proporReplanejamentoGrade(d); expect(r.preservados.map((p)=>p.id)).toEqual(["passada","cancelada"]); expect(r.propostas).toHaveLength(2);
 });
 it("não propõe início passado no mesmo dia nem antes do fim de aula em andamento", () => {
  const d=entrada();d.agora="2026-09-09T19:30:00.000Z";
  const r=proporReplanejamentoGrade(d);expect(r.preservados.map((p)=>p.id)).toEqual(["passada","a"]);expect(r.propostas[0].inicioProposto).toBe("2026-09-14T19:00:00.000Z");
 });
 it("recusa histórico inconsistente e identidade duplicada", () => {
  const d=entrada();d.encontros[1].status="MINISTRADO";expect(()=>proporReplanejamentoGrade(d)).toThrow("futura");
  const duplicada=entrada();duplicada.encontros.push(duplicada.encontros[0]);expect(()=>proporReplanejamentoGrade(duplicada)).toThrow("repetido");
 });
});

it.each(["NAO_REALIZADO", "IMPEDIDO_ESCOLA"] as const)("preserva encontro %s sem criar nova aula ou alterar os horários futuros", (status) => {
 const d = entrada();
 const ausente = { ...encontro("segunda-sem-realizacao", "2026-09-07"), status };
 const esperado = proporReplanejamentoGrade(d);
 const resultado = proporReplanejamentoGrade({ ...d, encontros: [...d.encontros, ausente] });
 expect(resultado.propostas).toEqual(esperado.propostas);
 expect(resultado.previsaoTermino).toBe(esperado.previsaoTermino);
 expect(resultado.preservados).toContainEqual(ausente);
});

it("mantém previsto passado na meta planejada, sem contar impedido ou não realizado", () => {
 const d = entrada();
 d.encontros = [
  { ...encontro("prevista-passada", "2026-09-07"), status: "PREVISTO" },
  { ...encontro("nao-realizada", "2026-09-07"), status: "NAO_REALIZADO" as const },
  { ...encontro("impedida", "2026-09-07"), status: "IMPEDIDO_ESCOLA" as const },
  encontro("futura", "2026-09-09"),
 ];
 const r = proporReplanejamentoGrade({ ...d, quantidadeAulasAlvo: 2 });
 expect(r.preservados.map((e) => e.id)).toEqual(["prevista-passada", "nao-realizada", "impedida"]);
 expect(r.propostas).toHaveLength(1);
 expect(r.adicionados).toHaveLength(0);
});

it("aumento 25 para 30 adiciona cinco quando há cinco ministradas e um previsto passado", () => {
 const d = entrada();
 d.encontros = [
  ...Array.from({ length: 5 }, (_, i) => encontro(`ministrada-${i}`, "2026-09-07", "MINISTRADO")),
  encontro("prevista-passada", "2026-09-07", "PREVISTO"),
  ...Array.from({ length: 19 }, (_, i) => encontro(`futura-${i}`, `2026-10-${String(i + 1).padStart(2, "0")}`, "PREVISTO")),
 ];
 const r = proporReplanejamentoGrade({ ...d, quantidadeAulasAlvo: 30 });
 expect(r.propostas).toHaveLength(19);
 expect(r.adicionados).toHaveLength(5);
});
