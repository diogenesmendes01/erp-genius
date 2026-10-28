import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { COLUNAS_FUNIL } from "@/server/crm/etapas";
import type { OportunidadeAtualPainel } from "@/server/inbox/painel-oportunidades";

vi.mock("@/server/inbox/acoes-painel", () => ({
  agendarExperimentalNoInbox: vi.fn(),
  atribuirProfessorExperimentalNoInbox: vi.fn(),
  confirmarExperimentalNoInbox: vi.fn(),
}));

import { CartaoExperimental, statusExperimental } from "./CartaoExperimental";
const oportunidade: OportunidadeAtualPainel = { id: "op/328?A", titulo: "Curso fictício", produto: null, valor: null, moeda: null, etapa: "EXPERIMENTAL_AGENDADA", temperatura: "MORNO", responsavel: null, dataExperimental: "2026-11-01T01:30:00.000Z", experimentalConfirmada: false, professorExperimental: "Helena fictícia", probabilidadePct: null, previsaoFechamento: null, podeEditarPrevisao: false, motivoPerda: null };
type Props = Parameters<typeof CartaoExperimental>[0];
const h = (extra: Partial<Props> = {}) => renderToStaticMarkup(createElement(CartaoExperimental, { oportunidade, fuso: null, fusoEscola: "America/Sao_Paulo", podeAbrirFunil: true, ...extra }));
describe("status da ocorrência experimental", () => {
  for (const etapa of COLUNAS_FUNIL) for (const experimentalConfirmada of [false, true]) {
    it(etapa + "/confirmada=" + experimentalConfirmada, () => {
      const esperado = etapa === "NO_SHOW" ? "Não compareceu" : etapa === "EXPERIMENTAL_REALIZADA" ? "Realizada" : experimentalConfirmada ? "Confirmada" : "Agendada";
      expect(statusExperimental({ etapa, experimentalConfirmada })).toBe(esperado);
      expect(h({ oportunidade: { ...oportunidade, etapa, experimentalConfirmada } })).toContain(">" + esperado + "</span>");
    });
  }
});
it("sem data não apresenta cartão nem link, mesmo com confirmação", () => expect(h({ oportunidade: { ...oportunidade, dataExperimental: null, experimentalConfirmada: true } })).toBe(""));
it("apresenta data no fuso da escola, professor e href codificado sem exibir ID", () => {
  const html = h(); for (const t of ["Aula experimental", "Helena fictícia", "31/10/2026, 22:30", "Agendada"]) expect(html).toContain(t);
  expect(html).toContain('href="/funil?o=op%2F328%3FA"'); expect(html).not.toContain(">op/328?A<");
  expect(html).toContain('title="Horário em America/Sao_Paulo"'); expect(html).not.toContain('role="status"');
});
it("sem professor mantém a ausência legítima e sem acesso global não cria Editar", () => {
  const html = h({ oportunidade: { ...oportunidade, professorExperimental: null }, podeAbrirFunil: false });
  expect(html).toContain("Sem professor"); expect(html).not.toContain("Editar"); expect(html).not.toContain("/funil");
});
it("default não concede acesso global ao Funil", () => expect(h({ podeAbrirFunil: undefined })).not.toContain("/funil"));
it("preferência pessoal prevalece; inválida usa escola e não timezone do processo", () => {
  expect(h({ fuso: "America/Costa_Rica" })).toContain("31/10/2026, 19:30");
  expect(h({ fuso: "inválido", fusoEscola: "America/Costa_Rica" })).toContain("31/10/2026, 19:30");
  const antes = process.env.TZ; try { process.env.TZ = "Asia/Tokyo"; const a = h(); process.env.TZ = "Pacific/Honolulu"; expect(h()).toBe(a); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
});
it("com atendimento mostra professor, remarcação e confirmar presença", () => {
  const html = h({ oportunidade: { ...oportunidade, atendimentoId: "at1", professores: [{ id: "p1", nome: "Helena fictícia" }], professorExperimentalId: "p1" } });
  expect(html).toContain('aria-label="Professor da experimental"');
  expect(html).toContain("Remarcar experimental");
  expect(html).toContain("Confirmar presença");
  expect(h()).not.toContain("Confirmar presença");
});
it("instante atravessando DST usa o horário real do fuso sem inferir realização pelo passado", () => {
  const html = h({ fuso: "America/New_York", oportunidade: { ...oportunidade, dataExperimental: "2026-03-08T07:30:00.000Z" } });
  expect(html).toContain("08/03/2026, 03:30"); expect(html).toContain("Agendada");
});
