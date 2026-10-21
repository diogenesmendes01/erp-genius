import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/matricula/condicoes-horas", () => ({ consultarCondicoesHoras: vi.fn(), prepararCondicoesHoras: vi.fn(), decidirCondicoesHoras: vi.fn() }));
import { CondicoesHoras } from "./CondicoesHoras";

const dados = {
  matriculaId: "m", codigo: "M-1", moeda: "BRL", fuso: "America/Sao_Paulo", impedimento: null, podePreparar: true, documentoId: "d",
  versoes: [{ id: "v", versao: 1, status: "APROVADA", preparador: { nome: "Secretaria" }, criadaEm: "2026-01-01T02:30:00Z", documentoId: "d", motivo: "Transcrição", motivoDecisao: "Conferido", decisor: { nome: "Financeiro" }, decididaEm: "2026-01-01T03:30:00Z", podeDecidir: false,
    regras: { moeda: "BRL", valorHora: "100.00", antecedenciaCancelamentoMinutos: 60, vigenteDesde: "2026-01-01T02:30:00-03:00", clausulaPreco: "Preço", clausulaCancelamento: "Cancelamento" } }],
} as Parameters<typeof CondicoesHoras>[0]["dados"];

it("aplica preferência só à saída, preserva o fuso contratual e os inputs da grade", () => {
  const preferido = renderToStaticMarkup(createElement(CondicoesHoras, { dados, preferenciaFusoExibicao: "America/Costa_Rica" }));
  const fallback = renderToStaticMarkup(createElement(CondicoesHoras, { dados, preferenciaFusoExibicao: null }));
  const fusoInvalido = renderToStaticMarkup(createElement(CondicoesHoras, { dados: { ...dados, fuso: "Factory" }, preferenciaFusoExibicao: null }));
  expect(preferido).toContain("31/12/2025, 23:30");
  expect(fallback).toContain("01/01/2026, 02:30");
  expect(fallback).toContain("horário exibido em America/Sao_Paulo; referência contratual preservada");
  expect(preferido).toContain('name="data"');
  expect(preferido).toContain('name="hora"');
  expect(preferido).toContain("horário de America/Sao_Paulo");
  expect(fusoInvalido).toContain("horário exibido em UTC; referência contratual preservada");
});
