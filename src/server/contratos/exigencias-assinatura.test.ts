import { expect, it } from "vitest";
import { planejarExigenciasAssinatura } from "./exigencias-assinatura";
const regras = [
  { papel: "REPRESENTANTE_ESCOLA", condicao: "SEMPRE" },
  { papel: "ALUNO", condicao: "ALUNO_MAIOR" },
  { papel: "REPRESENTANTE_LEGAL", condicao: "ALUNO_MENOR" },
  { papel: "RESPONSAVEL_FINANCEIRO", condicao: "PAGADOR_DISTINTO" },
  { papel: "REPRESENTANTE_EMPRESA", condicao: "PAGADOR_EMPRESA" },
];
it("separa cliente e escola e não acrescenta responsável quando o aluno é pagador", () => {
  const p = planejarExigenciasAssinatura(regras, { maioridade: "MAIOR", pagador: "ALUNO" });
  expect(p.participantesExigidos).toEqual([{ papel: "ALUNO", etapa: "CLIENTE" }, { papel: "REPRESENTANTE_ESCOLA", etapa: "ESCOLA" }]);
  expect(p.pendencias).toEqual([]);
});
it("menor com empresa pagadora conserva representação legal e financeira separadas", () => {
  const p = planejarExigenciasAssinatura(regras, { maioridade: "MENOR", pagador: "EMPRESA" });
  expect(p.participantesExigidos.map((p) => p.papel)).toEqual(["REPRESENTANTE_EMPRESA", "REPRESENTANTE_LEGAL", "RESPONSAVEL_FINANCEIRO", "REPRESENTANTE_ESCOLA"]);
  expect(p.regras.find((r) => r.papel === "ALUNO")?.resultado).toBe("NAO_APLICAVEL");
});
it("maioridade não conferida produz pendência sem escolher aluno ou representante legal", () => {
  const p = planejarExigenciasAssinatura(regras, { maioridade: null, pagador: "RESPONSAVEL" });
  expect(p.regras.filter((r) => r.resultado === "PENDENTE_CONFERENCIA").map((r) => r.papel)).toEqual(["ALUNO", "REPRESENTANTE_LEGAL"]);
  expect(p.participantesExigidos.map((p) => p.papel)).toEqual(["RESPONSAVEL_FINANCEIRO", "REPRESENTANTE_ESCOLA"]);
  expect(p.pendencias).toHaveLength(1);
});
it("não exige conferência desnecessária nem acrescenta escola ausente do modelo", () => {
  const p = planejarExigenciasAssinatura([{ papel: "ALUNO", condicao: "SEMPRE" }], { maioridade: null, pagador: "EMPRESA" });
  expect(p.participantesExigidos).toEqual([{ papel: "ALUNO", etapa: "CLIENTE" }]);
  expect(p.pendencias).toEqual([]);
});
it("várias regras do mesmo papel não duplicam exigência; ausência de cliente exige revisão", () => {
  const p = planejarExigenciasAssinatura([{ papel: "ALUNO", condicao: "SEMPRE" }, { papel: "ALUNO", condicao: "ALUNO_MAIOR" }], { maioridade: "MAIOR", pagador: "ALUNO" });
  expect(p.participantesExigidos).toHaveLength(1); expect(p.regras).toHaveLength(2);
  const semCliente = planejarExigenciasAssinatura([{ papel: "REPRESENTANTE_LEGAL", condicao: "ALUNO_MENOR" }, { papel: "REPRESENTANTE_ESCOLA", condicao: "SEMPRE" }], { maioridade: "MAIOR", pagador: "ALUNO" });
  expect(semCliente.pendencias[0]).toContain("não exige participante do cliente");
});
