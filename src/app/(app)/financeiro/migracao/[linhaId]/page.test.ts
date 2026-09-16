import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/migracao/consultas-financeiras", () => ({ consultarConciliacaoFinanceiraMigracao: vi.fn().mockResolvedValue({ ok: true, dado: { linha: { id: "l", linhaOrigem: "financeiro!2", entradaHash: "h", dadosOrigem: { financeiro: { valor: "10" } }, lote: { origem: "LEGADO", chaveLote: "lote" }, mapa: { matriculaId: "m", codigo: "M-1", status: "ATIVA", aluno: "Ana" } }, cobrancas: [], recebimentos: [], pagadores: [], propostas: [], proximoCursor: null, podeDecidir: true } }) }));
vi.mock("./ConferenciaFinanceiraMigracao", () => ({ ConferenciaFinanceiraMigracao: () => createElement("p", null, "formulário financeiro") }));
import Pagina from "./page";
describe("rota de conciliação financeira", () => { it("não exige abrir o lote administrativo", async () => { const html = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ linhaId: "l" }), searchParams: Promise.resolve({}) })); expect(html).toContain("Voltar ao financeiro"); expect(html).toContain("formulário financeiro"); }); });