import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/migracao/entrada-financeira-historica", () => ({ decidirEntradaFinanceiraHistoricaMigracao: vi.fn(), proporEntradaFinanceiraHistoricaMigracao: vi.fn() }));
import { EntradaFinanceiraHistorica } from "./EntradaFinanceiraHistorica";

const paises = [{ id: "cr", nome: "Costa Rica", codigo: "CR" }];
const proposta = { id:"p", versao:1, status:"PENDENTE", preparadorNome:"Preparador", decisorNome:null, motivoDecisao:null, criadoEm:"2026-09-17T00:00:00Z", aplicadaEm:null, valor:"125.00", moeda:"CRC", vencimento:"2025-02-10T00:00:00Z", competencia:"2025-02", tipoCobranca:"MENSALIDADE", dadosPagador:{ tipo:"RESPONSAVEL", dados:{ nome:"Responsável", paisId:"cr" } }, evidencia:{ planilha:"f!2" }, complemento:{ origem:"conferida" }, cobrancaId:null, pagadorId:null, podeDecidir:true };
describe("entrada financeira histórica renderizada", () => {
  it("bloqueia preparação sem mapa M01", () => { const html=renderToStaticMarkup(createElement(EntradaFinanceiraHistorica,{linhaId:"l",temMapa:false,moeda:"CRC",paises,propostas:[]})); expect(html).toContain("ainda não tem mapa M01"); expect(html).not.toContain("Registrar proposta histórica"); });
  it("mostra a fotografia completa e decisão só para outro aprovador", () => { const html=renderToStaticMarkup(createElement(EntradaFinanceiraHistorica,{linhaId:"l",temMapa:true,moeda:"USD",paises,propostas:[proposta]})); expect(html).toContain('value="USD"'); expect(html).toContain("Vencimento"); expect(html).toContain("10/02/2025"); expect(html).toContain("competência 2025-02"); expect(html).toContain("Responsável"); expect(html).toContain("planilha"); expect(html).toContain("Aprovar e aplicar"); });
  it("não apresenta callback de decisão ao autor da proposta", () => { const html=renderToStaticMarkup(createElement(EntradaFinanceiraHistorica,{linhaId:"l",temMapa:true,moeda:"CRC",paises,propostas:[{...proposta,podeDecidir:false}]})); expect(html).not.toContain("Aprovar e aplicar"); });
});
