import { describe, expect, it } from "vitest";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { esperaAteProximo, prazoEstourado, proximoEstouroEm, TETO_TIMER_MS } from "./prazo-vivo";

const T = Date.UTC(2026, 9, 22, 12);
const iso = (ms: number) => new Date(T + ms).toISOString();
const item = (o: Partial<ItemListaInbox> = {}) => ({
  grupo: false, status: "EM_ATENDIMENTO", prazoRespostaEm: null, ...o,
}) as ItemListaInbox;

describe("regras puras de prazo vivo", () => {
  it("próximo prazo é o menor futuro elegível, ignorando passados, grupos e encerrados", () => {
    expect(proximoEstouroEm([
      item({ prazoRespostaEm: iso(-1000) }), item({ grupo: true, prazoRespostaEm: iso(5000) }),
      item({ status: "ENCERRADO", prazoRespostaEm: iso(4000) }), item(),
      item({ prazoRespostaEm: iso(9000) }), item({ prazoRespostaEm: iso(7000) }),
    ], T)).toBe(T + 7000);
  });
  it("empate de prazos não altera o próximo vencimento", () => {
    expect(proximoEstouroEm([item({ prazoRespostaEm: iso(1000) }), item({ prazoRespostaEm: iso(1000) })], T)).toBe(T + 1000);
  });
  it.each([
    [], [item()], [item({ prazoRespostaEm: "invalido" })], [item({ prazoRespostaEm: iso(0) })],
    [item({ prazoRespostaEm: iso(-1) })], [item({ grupo: true, prazoRespostaEm: iso(1) })],
    [item({ status: "ENCERRADO", prazoRespostaEm: iso(1) })],
  ])("sem futuro válido devolve null: %j", (...itens) => {
    expect(proximoEstouroEm(itens as ItemListaInbox[], T)).toBeNull();
  });
  it("espera mantém a fronteira estrita e limita ao teto nativo", () => {
    expect(TETO_TIMER_MS).toBe(2_147_483_647);
    expect(esperaAteProximo(null, T)).toBeNull();
    expect(esperaAteProximo(T + 60_000, T)).toBe(60_001);
    expect(esperaAteProximo(T, T)).toBe(1);
    expect(esperaAteProximo(T - 5, T)).toBe(0);
    expect(esperaAteProximo(T + 40 * 86_400_000, T)).toBe(2_147_483_647);
  });
  it("prazo estoura somente depois do instante exato e só em atendimentos ativos individuais", () => {
    expect(prazoEstourado(item({ prazoRespostaEm: iso(-1) }), T)).toBe(true);
    expect(prazoEstourado(item({ prazoRespostaEm: iso(0) }), T)).toBe(false);
    expect(prazoEstourado(item({ prazoRespostaEm: iso(1) }), T)).toBe(false);
    expect(prazoEstourado(item({ status: "ENCERRADO", prazoRespostaEm: iso(-1) }), T)).toBe(false);
    expect(prazoEstourado(item({ grupo: true, prazoRespostaEm: iso(-1) }), T)).toBe(false);
    expect(prazoEstourado(item({ prazoRespostaEm: "invalido" }), T)).toBe(false);
    expect(prazoEstourado(item(), T)).toBe(false);
  });
});
