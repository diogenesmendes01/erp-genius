import { describe, expect, it, vi } from "vitest";
import { assinarEventosCompartilhados, type FonteEventos } from "./eventos-inbox";
class FonteFalsa implements FonteEventos {
  onopen: ((e: Event) => void) | null = null; onerror: ((e: Event) => void) | null = null;
  listeners = new Map<string, (e: Event) => void>(); fechada = false; readyState = 0;
  addEventListener(t: string, f: (e: Event) => void) { this.listeners.set(t, f); }
  close() { this.readyState = 2; this.fechada = true; }
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

describe("C6 — recuperação sem nova assinatura", () => {
  const fechar = (f: FonteFalsa) => { f.readyState = 2; f.onerror!(new Event("error")); };
  const abrir = (f: FonteFalsa) => { f.readyState = 1; f.onopen!(new Event("open")); };

  it("recupera Sidebar já inscrita após CLOSED e ressincroniza na abertura", () => {
    vi.useFakeTimers();
    const fontes: FonteFalsa[] = [], aviso = vi.fn(), conexao = vi.fn();
    const sair = assinarEventosCompartilhados(aviso, conexao, () => {
      const f = new FonteFalsa(); fontes.push(f); return f;
    });
    try {
      abrir(fontes[0]); fechar(fontes[0]);
      expect(conexao).toHaveBeenLastCalledWith(false);
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(999); expect(fontes).toHaveLength(1);
      vi.advanceTimersByTime(1); expect(fontes).toHaveLength(2);
      expect(fontes.filter(f => !f.fechada)).toHaveLength(1);
      abrir(fontes[1]);
      expect(conexao).toHaveBeenLastCalledWith(true);
      expect(aviso.mock.calls.map(([a]) => a.tipo)).toEqual(["resync"]);
      fontes[1].emitir("mensagem.nova");
      expect(aviso.mock.calls.at(-1)?.[0].tipo).toBe("mensagem.nova");
      expect(vi.getTimerCount()).toBe(0);
    } finally { sair(); vi.useRealTimers(); }
  });

  it("usa backoff 1/2/4/8/16/30s, limita em30s e reinicia após abrir", () => {
    vi.useFakeTimers();
    const fontes: FonteFalsa[] = [];
    const sair = assinarEventosCompartilhados(vi.fn(), vi.fn(), () => {
      const f = new FonteFalsa(); fontes.push(f); return f;
    });
    try {
      for (const atraso of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
        const quantidade = fontes.length;
        fechar(fontes.at(-1)!); expect(vi.getTimerCount()).toBe(1);
        vi.advanceTimersByTime(atraso - 1); expect(fontes).toHaveLength(quantidade);
        vi.advanceTimersByTime(1); expect(fontes).toHaveLength(quantidade + 1);
        expect(fontes.filter(f => !f.fechada)).toHaveLength(1);
      }
      abrir(fontes.at(-1)!); fechar(fontes.at(-1)!);
      const quantidade = fontes.length;
      vi.advanceTimersByTime(1000); expect(fontes).toHaveLength(quantidade + 1);
    } finally { sair(); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); }
  });

  it("nova assinatura antecipa recuperação e cancela timer sem duplicar a fonte", () => {
    vi.useFakeTimers();
    const fontes: FonteFalsa[] = [], saidas: (() => void)[] = [];
    const criar = () => { const f = new FonteFalsa(); fontes.push(f); return f; };
    try {
      saidas.push(assinarEventosCompartilhados(vi.fn(), vi.fn(), criar));
      const erroAntigo = fontes[0].onerror!;
      fechar(fontes[0]); expect(vi.getTimerCount()).toBe(1);
      saidas.push(assinarEventosCompartilhados(vi.fn(), vi.fn(), criar));
      expect(fontes).toHaveLength(2); expect(vi.getTimerCount()).toBe(0);
      erroAntigo(new Event("error"));
      vi.advanceTimersByTime(60000); expect(fontes).toHaveLength(2);
      expect(fontes[1].fechada).toBe(false);
    } finally { for (const sair of saidas) sair(); vi.useRealTimers(); }
  });

  it("último unsubscribe cancela recuperação; próximo ciclo começa em1s", () => {
    vi.useFakeTimers();
    const fontes: FonteFalsa[] = [], saidas: (() => void)[] = [];
    const criar = () => { const f = new FonteFalsa(); fontes.push(f); return f; };
    try {
      const sair = assinarEventosCompartilhados(vi.fn(), vi.fn(), criar); saidas.push(sair);
      fechar(fontes[0]); vi.advanceTimersByTime(1000);
      expect(fontes).toHaveLength(2);
      fechar(fontes[1]); sair(); sair();
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(60000); expect(fontes).toHaveLength(2);
      saidas.push(assinarEventosCompartilhados(vi.fn(), vi.fn(), criar));
      fechar(fontes[2]); vi.advanceTimersByTime(1000);
      expect(fontes).toHaveLength(4);
    } finally { for (const sair of saidas) sair(); vi.useRealTimers(); }
  });

  it("CONNECTING conserva a tentativa nativa sem agendar retry", () => {
    vi.useFakeTimers();
    const f = new FonteFalsa(), criar = vi.fn(() => f);
    const sair = assinarEventosCompartilhados(vi.fn(), vi.fn(), criar);
    try {
      abrir(f); f.readyState = 0; f.onerror!(new Event("error"));
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(60000); expect(criar).toHaveBeenCalledTimes(1);
      expect(f.fechada).toBe(false);
    } finally { sair(); vi.useRealTimers(); }
  });

  it("falha ao construir a substituta mantém o backoff e depois recupera", () => {
    vi.useFakeTimers();
    const fontes: FonteFalsa[] = [], aviso = vi.fn(); let tentativas = 0;
    const sair = assinarEventosCompartilhados(aviso, vi.fn(), () => {
      tentativas += 1; if (tentativas === 2) throw Error("indisponível");
      const f = new FonteFalsa(); fontes.push(f); return f;
    });
    try {
      abrir(fontes[0]); fechar(fontes[0]);
      vi.advanceTimersByTime(1000);
      expect(tentativas).toBe(2); expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(1999); expect(tentativas).toBe(2);
      vi.advanceTimersByTime(1); expect(tentativas).toBe(3);
      abrir(fontes[1]); expect(aviso.mock.calls.map(([a]) => a.tipo)).toEqual(["resync"]);
    } finally { sair(); vi.useRealTimers(); }
  });

  it("callback de timer cancelado não interfere no ciclo posterior", () => {
    vi.useFakeTimers(); const timer = vi.spyOn(globalThis, "setTimeout");
    const fontes: FonteFalsa[] = [], saidas: (() => void)[] = [];
    const criar = () => { const f = new FonteFalsa(); fontes.push(f); return f; };
    try {
      const sair = assinarEventosCompartilhados(vi.fn(), vi.fn(), criar); saidas.push(sair);
      fechar(fontes[0]); const antigo = timer.mock.calls.at(-1)![0]; sair();
      saidas.push(assinarEventosCompartilhados(vi.fn(), vi.fn(), criar));
      fechar(fontes[1]); expect(vi.getTimerCount()).toBe(1);
      if (typeof antigo !== "function") throw Error("callback ausente");
      antigo(); expect(fontes).toHaveLength(2); expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(1000); expect(fontes).toHaveLength(3);
    } finally { for (const sair of saidas) sair(); timer.mockRestore(); vi.useRealTimers(); }
  });

  it("desmontagem síncrona ao desconectar não deixa timer órfão", () => {
    vi.useFakeTimers(); const f = new FonteFalsa(); const controle: { sair?: () => void } = {};
    const sair = assinarEventosCompartilhados(vi.fn(), c => { if (!c) controle.sair?.(); }, () => f);
    controle.sair = sair;
    try {
      abrir(f); fechar(f); expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(60000); expect(f.fechada).toBe(true);
    } finally { sair(); vi.useRealTimers(); }
  });
});


describe("B1 — fonte física definitivamente encerrada", () => {
  it("CLOSED libera a fonte e recupera Sidebar antiga com nova assinatura e resync coletivo", () => {
    const fontes: FonteFalsa[] = [], saidas: (() => void)[] = [];
    const criar = () => { const f = new FonteFalsa(); fontes.push(f); return f; };
    const antigo = vi.fn(), novo = vi.fn(), conexaoAntiga = vi.fn();
    try {
      saidas.push(assinarEventosCompartilhados(antigo, conexaoAntiga, criar));
      fontes[0].readyState = 1; fontes[0].onopen!(new Event("open"));
      fontes[0].readyState = 2; fontes[0].onerror!(new Event("error"));
      expect(conexaoAntiga).toHaveBeenLastCalledWith(false);
      expect(fontes[0].fechada).toBe(true);
      saidas.push(assinarEventosCompartilhados(novo, vi.fn(), criar));
      expect(fontes).toHaveLength(2);
      fontes[1].readyState = 1; fontes[1].onopen!(new Event("open"));
      expect(conexaoAntiga).toHaveBeenLastCalledWith(true);
      for (const aviso of [antigo, novo]) expect(aviso.mock.calls.map(([a]) => a.tipo)).toEqual(["resync"]);
      fontes[1].emitir("mensagem.nova");
      expect(antigo.mock.calls.map(([a]) => a.tipo)).toEqual(["resync", "mensagem.nova"]);
      expect(novo.mock.calls.map(([a]) => a.tipo)).toEqual(["resync", "mensagem.nova"]);
      saidas[0](); saidas[0](); expect(fontes[1].fechada).toBe(false);
      saidas[1](); expect(fontes[1].fechada).toBe(true);
    } finally { for (const sair of saidas) sair(); }
  });

  it("CONNECTING mantém a reconexão nativa e não duplica fonte com novo assinante", () => {
    const fontes: FonteFalsa[] = [], saidas: (() => void)[] = [];
    const criar = () => { const f = new FonteFalsa(); fontes.push(f); return f; };
    const a = vi.fn(), b = vi.fn();
    try {
      saidas.push(assinarEventosCompartilhados(a, vi.fn(), criar));
      fontes[0].readyState = 1; fontes[0].onopen!(new Event("open"));
      fontes[0].readyState = 0; fontes[0].onerror!(new Event("error"));
      saidas.push(assinarEventosCompartilhados(b, vi.fn(), criar));
      expect(fontes).toHaveLength(1); expect(fontes[0].fechada).toBe(false);
      fontes[0].readyState = 1; fontes[0].onopen!(new Event("open"));
      expect(a.mock.calls.map(([v]) => v.tipo)).toEqual(["resync"]);
      expect(b.mock.calls.map(([v]) => v.tipo)).toEqual(["resync"]);
    } finally { for (const sair of saidas) sair(); }
  });

  it("callbacks open/error/event da fonte CLOSED não afetam a substituta", () => {
    const fontes: FonteFalsa[] = [], saidas: (() => void)[] = [];
    const criar = () => { const f = new FonteFalsa(); fontes.push(f); return f; };
    const a = vi.fn(), b = vi.fn(), conexao = vi.fn();
    try {
      saidas.push(assinarEventosCompartilhados(a, conexao, criar));
      const velha = fontes[0], abrirVelha = velha.onopen!, erroVelho = velha.onerror!;
      velha.readyState = 2; erroVelho(new Event("error"));
      saidas.push(assinarEventosCompartilhados(b, conexao, criar));
      expect(fontes).toHaveLength(2);
      fontes[1].readyState = 1; fontes[1].onopen!(new Event("open"));
      const avisosAntes = a.mock.calls.length, conexoesAntes = conexao.mock.calls.length;
      abrirVelha(new Event("open")); erroVelho(new Event("error")); velha.emitir("mensagem.nova");
      expect(a).toHaveBeenCalledTimes(avisosAntes); expect(conexao).toHaveBeenCalledTimes(conexoesAntes);
      expect(fontes[1].fechada).toBe(false);
      saidas.push(assinarEventosCompartilhados(vi.fn(), vi.fn(), criar));
      expect(fontes).toHaveLength(2);
      fontes[1].emitir("mensagem.nova"); expect(b.mock.calls.at(-1)?.[0].tipo).toBe("mensagem.nova");
    } finally { for (const sair of saidas) sair(); }
  });

  it("CLOSED durante instalação não sobrescreve fonte recuperada por callback síncrono", () => {
    const fontes: FonteFalsa[] = [], saidas: (() => void)[] = [];
    const criar = () => {
      const f = new FonteFalsa(); fontes.push(f);
      if (fontes.length === 1) {
        const adicionar = f.addEventListener.bind(f); let primeiro = true;
        f.addEventListener = (tipo, ouvinte) => {
          adicionar(tipo, ouvinte);
          if (primeiro) { primeiro = false; f.readyState = 2; f.onerror!(new Event("error")); }
        };
      }
      return f;
    };
    let recuperou = false;
    try {
      saidas.push(assinarEventosCompartilhados(vi.fn(), (conectado) => {
        if (!conectado && fontes[0]?.fechada && !recuperou) {
          recuperou = true; saidas.push(assinarEventosCompartilhados(vi.fn(), vi.fn(), criar));
        }
      }, criar));
      expect(fontes).toHaveLength(2); expect(fontes[0].fechada).toBe(true);
      saidas.push(assinarEventosCompartilhados(vi.fn(), vi.fn(), criar));
      expect(fontes).toHaveLength(2);
    } finally { for (const sair of saidas) sair(); }
    expect(fontes.every(f => f.fechada)).toBe(true);
  });
});
