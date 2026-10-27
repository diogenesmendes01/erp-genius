import { describe, expect, it } from "vitest";
import { assinarEventosInbox, type FonteEventos } from "./useEventosInbox";

class FonteFalsa implements FonteEventos {
  readyState = 0;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  readonly ouvintes = new Map<string, (e: Event) => void>();
  fechada = false;
  addEventListener(tipo: string, f: (e: Event) => void) { this.ouvintes.set(tipo, f); }
  close() { this.readyState = 2; this.fechada = true; }
  emitir(tipo: string, data: string) { this.ouvintes.get(tipo)?.({ data } as unknown as Event); }
}

function montar() {
  const fontes: FonteFalsa[] = [];
  const avisos: unknown[] = [];
  const estados: boolean[] = [];
  const sair = assinarEventosInbox(
    () => { const f = new FonteFalsa(); fontes.push(f); return f; },
    (a) => avisos.push(a),
    (c) => estados.push(c),
  );
  return { fonte: fontes[0], fontes, avisos, estados, sair };
}

describe("assinarEventosInbox", () => {
  it("repassa os avisos nomeados e ignora data inválida", () => {
    const { fonte, avisos } = montar();
    fonte.onopen!(new Event("open"));
    fonte.emitir("mensagem.nova", JSON.stringify({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m1", conversaId: "c1" }));
    fonte.emitir("mensagem.status", "{quebrado");
    expect(avisos).toEqual([{ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m1", conversaId: "c1" }]);
  });

  it("a primeira abertura não pede resync; cada reabertura (o navegador reconectou) entrega um resync", () => {
    const { fonte, fontes, avisos, estados } = montar();
    fonte.onopen!(new Event("open"));
    expect(avisos).toEqual([]);
    fonte.onerror!(new Event("error"));
    fonte.onopen!(new Event("open"));
    expect(avisos).toEqual([{ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" }]);
    expect(estados).toEqual([true, false, true]);
    expect(fontes).toHaveLength(1);
  });

  it("sair fecha a fonte e marca desconectado", () => {
    const { fonte, estados, sair } = montar();
    fonte.onopen!(new Event("open"));
    sair();
    expect(fonte.fechada).toBe(true);
    expect(estados.at(-1)).toBe(false);
  });
});


it("wrapper registra e entrega aria.global",()=>{const {fonte,avisos,sair}=montar();try{const g={tipo:"aria.global",atendimentoId:null,mensagemId:null,conversaId:""};expect(fonte.ouvintes.has("aria.global")).toBe(true);fonte.emitir("aria.global",JSON.stringify(g));expect(avisos).toEqual([g]);}finally{sair();}});
