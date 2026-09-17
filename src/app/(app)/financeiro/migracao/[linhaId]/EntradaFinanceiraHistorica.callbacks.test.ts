import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ propor: vi.fn(), decidir: vi.fn(), useState: vi.fn(), useRef: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async importOriginal => ({ ...(await importOriginal<typeof import("react")>()), useState: mocks.useState, useRef: mocks.useRef }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/server/migracao/entrada-financeira-historica", () => ({ proporEntradaFinanceiraHistoricaMigracao: mocks.propor, decidirEntradaFinanceiraHistoricaMigracao: mocks.decidir }));
import { EntradaFinanceiraHistorica } from "./EntradaFinanceiraHistorica";

type No = { props?: Record<string, unknown>; type?: unknown };
function encontrar(no: unknown, tipo: string): No | undefined { if (Array.isArray(no)) return no.map((filho) => encontrar(filho, tipo)).find(Boolean); if (!no || typeof no !== "object") return undefined; const atual=no as No; if (atual.type===tipo) return atual; const filhos=atual.props?.children; return Array.isArray(filhos) ? filhos.map((filho) => encontrar(filho,tipo)).find(Boolean) : encontrar(filhos,tipo); }
const valores: Record<string,string> = { tipoCobranca:"MENSALIDADE",valor:"125.00",moeda:"CRC",vencimento:"2025-02-10",competencia:"2025-02",pagadorTipo:"RESPONSAVEL",nome:"Responsável",paisId:"cr",documento:"DOC",email:"r@example.test",evidencia:"planilha!2" };
function montar(ocupado=false) { const setErro=vi.fn(),setOk=vi.fn(),setOcupado=vi.fn(),chave={current:null as string|null}; mocks.useState.mockReset().mockReturnValueOnce([null,setErro]).mockReturnValueOnce([null,setOk]).mockReturnValueOnce([ocupado,setOcupado]); mocks.useRef.mockReset().mockReturnValue(chave); const arvore=EntradaFinanceiraHistorica({ linhaId:"linha",temMapa:true,moeda:"CRC",paises:[{id:"cr",nome:"Costa Rica",codigo:"CR"}],propostas:[] }); return { form:encontrar(arvore,"form")!.props!, fieldset:encontrar(arvore,"fieldset")!.props!, setErro,setOk,setOcupado,chave }; }

afterEach(() => vi.unstubAllGlobals());
it("envia payload completo, bloqueia durante envio e repete a mesma chave", async () => {
  vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000009" }); vi.stubGlobal("FormData", class { get(nome:string) { return valores[nome] ?? null; } }); mocks.propor.mockResolvedValue({ ok:true,dado:{id:"p",repetida:false} }); const c=montar(); const evento={preventDefault:vi.fn(),currentTarget:{}};
  (c.form.onSubmit as (e:typeof evento)=>void)(evento); await Promise.resolve();
  expect(mocks.propor).toHaveBeenCalledWith({ linhaId:"linha",tipoCobranca:"MENSALIDADE",valor:"125.00",moeda:"CRC",vencimento:"2025-02-10",competencia:"2025-02",pagador:{tipo:"RESPONSAVEL",dados:{nome:"Responsável",paisId:"cr",documento:"DOC",email:"r@example.test"}},evidencia:{referencia:"planilha!2"},chaveIdempotencia:"00000000-0000-4000-8000-000000000009" }); expect(c.setOcupado).toHaveBeenCalledWith(true); expect(c.setOcupado).toHaveBeenLastCalledWith(false);
  (c.form.onSubmit as (e:typeof evento)=>void)(evento); await Promise.resolve(); expect(mocks.propor.mock.calls[1]?.[0].chaveIdempotencia).toBe(mocks.propor.mock.calls[0]?.[0].chaveIdempotencia);
  expect(montar(true).fieldset.disabled).toBe(true);
});
it("mostra falha do callback sem refresh", async () => { mocks.refresh.mockReset(); mocks.propor.mockReset(); vi.stubGlobal("FormData", class { get(nome:string) { return valores[nome] ?? null; } }); vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000010" }); mocks.propor.mockResolvedValue({ok:false,erro:"Fonte divergente"}); const c=montar(); (c.form.onSubmit as (e:{preventDefault():void;currentTarget:object})=>void)({preventDefault:vi.fn(),currentTarget:{}}); await Promise.resolve(); expect(c.setErro).toHaveBeenCalledWith("Fonte divergente"); expect(mocks.refresh).not.toHaveBeenCalled(); });
