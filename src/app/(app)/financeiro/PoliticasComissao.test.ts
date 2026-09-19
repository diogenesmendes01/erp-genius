import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/financeiro/acoes", () => ({ publicarPoliticaComissao: vi.fn() }));
import { PoliticasComissao } from "./PoliticasComissao";

const dados = {
  paises: [{ id: "cr", nome: "Costa Rica", moedaLocal: "CRC" }],
  produtos: [{ id: "produto", nome: "Mensal" }],
  politicas: [{ id: "p1", paisId: "cr", produtoId: "produto", versao: 2, tipo: "VALOR_FIXO", valorFixo: 50, percentual: null, moeda: "CRC", vigenteEm: "2026-01-01T02:30:00.000Z", encerraEm: "2026-01-02T02:30:00.000Z" }],
} as never;

describe("PoliticasComissao", () => {
  it("exibe vigências ISO como instantes no fuso pessoal e mantém a entrada datetime-local", () => {
    const html = renderToStaticMarkup(createElement(PoliticasComissao, { dados, preferenciaFusoExibicao: "America/Costa_Rica" }));
    expect(html).toContain("vigência contratual desde 31/12/2025, 20:30 (horário exibido em America/Costa_Rica; instante ISO)");
    expect(html).toContain("até 01/01/2026, 20:30 (horário exibido em America/Costa_Rica; instante ISO)");
    expect(html).toContain('name="vigencia"');
    expect(html).toContain('type="datetime-local"');
  });
  it("usa UTC se não há preferência", () => {
    const html = renderToStaticMarkup(createElement(PoliticasComissao, { dados }));
    expect(html).toContain("01/01/2026, 02:30 (horário exibido em UTC; instante ISO)");
  });
});
