import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/avaliacoes/segunda-chamada-docente-local", () => ({ realizarSegundaChamadaLocal: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-realizacao", () => ({ salvarNotaOriginalSegundaChamada: vi.fn() }));

import { FormularioNota } from "./Formulario";

const props = { realizacaoId: "realizacao", alocacaoId: "alocacao", codigoAvaliacao: "A", realizadaEm: "2026-01-01T02:30:00.000Z", escala: { minimo: "0", maximo: "10" }, habilidades: ["FALA"], versaoEsperada: 1, regularizacao: false };

describe("formulário da nota original", () => {
  it("apresenta a data administrativa no fuso pessoal sem alterar o instante recebido", () => {
    const html = renderToStaticMarkup(createElement(FormularioNota, { ...props, preferenciaFusoExibicao: "America/Costa_Rica" }));
    expect(html).toMatch(/31\/12\/2025.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(props.realizadaEm).toBe("2026-01-01T02:30:00.000Z");
  });

  it("usa UTC na ausência de preferência", () => {
    const html = renderToStaticMarkup(createElement(FormularioNota, props));
    expect(html).toMatch(/01\/01\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });
});
