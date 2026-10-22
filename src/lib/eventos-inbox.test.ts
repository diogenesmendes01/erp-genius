import { describe, expect, it, vi } from "vitest";
import { assinarEventosCompartilhados, type FonteEventos } from "./eventos-inbox";
class FonteFalsa implements FonteEventos {
  onopen: ((e: Event) => void) | null = null; onerror: ((e: Event) => void) | null = null;
  listeners = new Map<string, (e: Event) => void>(); fechada = false;
  addEventListener(t: string, f: (e: Event) => void) { this.listeners.set(t, f); }
  close() { this.fechada = true; }
  emitir(t: string, data = JSON.stringify({ tipo: t, atendimentoId: "a", conversaId: "c", mensagemId: "m" })) { this.listeners.get(t)?.({ data } as unknown as Event); }
}
describe("SSE compartilhado do Inbox", () => {
  it("divide conexão, preserva assinaturas iguais e fecha só com último unsubscribe idempotente", () => {
    const fontes: FonteFalsa[] = []; const criar = () => { const f = new FonteFalsa(); fontes.push(f); return f; }; const aviso = vi.fn();
    const a = assinarEventosCompartilhados(aviso, vi.fn(), criar); const b = assinarEventosCompartilhados(aviso, vi.fn(), criar);
    expect(fontes).toHaveLength(1); fontes[0].emitir("mensagem.nova"); expect(aviso).toHaveBeenCalledTimes(2);
    a(); a(); expect(fontes[0].fechada).toBe(false); b(); expect(fontes[0].fechada).toBe(true);
    fontes[0].emitir("mensagem.nova"); expect(aviso).toHaveBeenCalledTimes(2);
  });
  it("novo assinante recebe conexão atual; reabrir emite um resync por assinante", () => {
    const f = new FonteFalsa(); const a = vi.fn(), b = vi.fn(), conectado = vi.fn();
    const sairA = assinarEventosCompartilhados(a, vi.fn(), () => f); f.onopen!(new Event("open"));
    const sairB = assinarEventosCompartilhados(b, conectado, () => { throw Error("duplicou"); });
    expect(conectado).toHaveBeenLastCalledWith(true);
    expect(b).toHaveBeenCalledWith({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" });
    f.onerror!(new Event("error")); f.onopen!(new Event("open"));
    expect(a.mock.calls.filter(([v]) => v.tipo === "resync")).toHaveLength(1); expect(b.mock.calls.filter(([v]) => v.tipo === "resync")).toHaveLength(2);
    f.emitir("mensagem.nova", "inválido"); expect(a).toHaveBeenCalledTimes(1); sairA(); sairB();
  });
  it("montar/limpar/remontar não mantém fonte velha nem callbacks após descarte", () => {
    const fs: FonteFalsa[] = []; const criar = () => { const f = new FonteFalsa(); fs.push(f); return f; }; const a = vi.fn(), b = vi.fn();
    const sair = assinarEventosCompartilhados(a, vi.fn(), criar); const abrirAntigo = fs[0].onopen!; sair();
    const sairB = assinarEventosCompartilhados(b, vi.fn(), criar); expect(fs.filter(f => !f.fechada)).toHaveLength(1);
    abrirAntigo(new Event("open")); fs[0].emitir("mensagem.nova"); expect(a).not.toHaveBeenCalled(); expect(b).not.toHaveBeenCalled(); sairB();
  });
});
