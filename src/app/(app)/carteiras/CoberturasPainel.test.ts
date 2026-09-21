import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/acesso/coberturas", () => ({ concederCobertura: vi.fn(), revogarCobertura: vi.fn() }));

import { CoberturasPainel } from "./CoberturasPainel";

const dados = [{ id: "c", titular: "Ana", substituto: "Bia", inicio: "2026-01-01T02:30:00.000Z", fim: "2026-01-01T04:30:00.000Z", revogada: false, motivo: "Cobertura temporária" }];

function entradas(html: string) {
  return html.match(/<input[^>]+(?:name="(?:inicio|fim)"|type="datetime-local")[^>]*>/g) ?? [];
}

it("exibe a cobertura no fuso pessoal sem mudar os campos datetime-local", () => {
  const preferido = renderToStaticMarkup(createElement(CoberturasPainel, { vendedores: [], coberturas: dados, preferenciaFusoExibicao: "America/Costa_Rica" }));
  const fallback = renderToStaticMarkup(createElement(CoberturasPainel, { vendedores: [], coberturas: dados, preferenciaFusoExibicao: null }));

  expect(preferido).toContain("31/12/2025, 20:30 até 31/12/2025, 22:30 (horário exibido em America/Costa_Rica; origem UTC)");
  expect(fallback).toContain("01/01/2026, 02:30 até 01/01/2026, 04:30 (horário exibido em UTC; origem UTC)");
  expect(entradas(preferido)).toEqual(entradas(fallback));
  expect(preferido).toContain('name="inicio"');
  expect(preferido).toContain('name="fim"');
});