import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/migracao/planilha-acoes", () => ({ preverArquivoPreparacaoMigracao: vi.fn(), prepararArquivoMigracao: vi.fn() }));
import { PreparacaoMigracaoPainel } from "./PreparacaoMigracaoPainel";
describe("entrada de arquivo da preparação", () => { it("oferece arquivo e mapeamento explícito, sem editor JSON", () => { const html = renderToStaticMarkup(createElement(PreparacaoMigracaoPainel)); expect(html).toContain("CSV ou XLSX"); expect(html).toContain("Separador CSV"); expect(html).toContain("Ler arquivo"); expect(html).not.toContain("Linhas de origem"); }); });
