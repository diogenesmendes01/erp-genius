import { describe, expect, it } from "vitest";
import { acaoTecladoMenu, posicaoPopover, proximoIndiceMenu } from "./popover";

const viewport = { largura: 400, altura: 800 };
const painel = { largura: 220, altura: 200 };

describe("posicaoPopover", () => {
  it("abre acima sem espaço abaixo", () => {
    expect(posicaoPopover({ ancora: { top: 760, bottom: 790, left: 10, right: 50 }, painel, viewport })).toMatchObject({ lado: "acima", topo: 554 });
  });
  it("abre abaixo quando cabe, alinhado à esquerda da âncora a 6 px", () => {
    expect(posicaoPopover({ ancora: { top: 10, bottom: 40, left: 30, right: 60 }, painel, viewport })).toEqual({ lado: "abaixo", topo: 46, esquerda: 30 });
  });
  it("respeita 8 px da borda direita", () => {
    expect(posicaoPopover({ ancora: { top: 10, bottom: 40, left: 380, right: 400 }, painel: { largura: 220, altura: 100 }, viewport }).esquerda).toBe(172);
  });
  it("respeita 8 px da borda esquerda", () => {
    expect(posicaoPopover({ ancora: { top: 10, bottom: 40, left: -30, right: 0 }, painel, viewport }).esquerda).toBe(8);
  });
  it("sem espaço em nenhum lado escolhe o maior e nunca sai da margem", () => {
    const r = posicaoPopover({ ancora: { top: 100, bottom: 130, left: 10, right: 50 }, painel: { largura: 220, altura: 900 }, viewport });
    expect(r.topo).toBeGreaterThanOrEqual(8);
    expect(r.lado).toBe("abaixo");
  });
  it("aceita margem e distância próprias", () => {
    expect(posicaoPopover({ ancora: { top: 10, bottom: 40, left: 0, right: 20 }, painel, viewport, margem: 16, distancia: 0 })).toEqual({ lado: "abaixo", topo: 40, esquerda: 16 });
  });
});

describe("proximoIndiceMenu", () => {
  it("setas circulam", () => {
    expect(proximoIndiceMenu(2, "ArrowDown", 3)).toBe(0);
    expect(proximoIndiceMenu(0, "ArrowUp", 3)).toBe(2);
    expect(proximoIndiceMenu(1, "ArrowDown", 3)).toBe(2);
    expect(proximoIndiceMenu(1, "ArrowUp", 3)).toBe(0);
  });
  it("Home e End", () => {
    expect(proximoIndiceMenu(1, "End", 3)).toBe(2);
    expect(proximoIndiceMenu(2, "Home", 3)).toBe(0);
  });
  it("foco fora dos itens (-1): ArrowDown vai ao primeiro, ArrowUp ao último", () => {
    expect(proximoIndiceMenu(-1, "ArrowDown", 3)).toBe(0);
    expect(proximoIndiceMenu(-1, "ArrowUp", 3)).toBe(2);
    expect(proximoIndiceMenu(-1, "ArrowUp", 1)).toBe(0);
  });
  it("lista vazia devolve -1", () => {
    expect(proximoIndiceMenu(0, "ArrowDown", 0)).toBe(-1);
  });
});

describe("acaoTecladoMenu", () => {
  it("Escape fecha devolvendo o foco; Tab fecha sem devolver", () => {
    expect(acaoTecladoMenu("Escape", -1, 3)).toEqual({ tipo: "fechar", devolverFoco: true });
    expect(acaoTecladoMenu("Tab", 0, 3)).toEqual({ tipo: "fechar", devolverFoco: false });
  });
  it("setas, Home e End focam o item certo, mesmo com o foco fora dos itens (gatilho)", () => {
    expect(acaoTecladoMenu("ArrowDown", -1, 3)).toEqual({ tipo: "focar", indice: 0 });
    expect(acaoTecladoMenu("ArrowUp", -1, 3)).toEqual({ tipo: "focar", indice: 2 });
    expect(acaoTecladoMenu("ArrowDown", 2, 3)).toEqual({ tipo: "focar", indice: 0 });
    expect(acaoTecladoMenu("ArrowUp", 0, 3)).toEqual({ tipo: "focar", indice: 2 });
    expect(acaoTecladoMenu("Home", 2, 3)).toEqual({ tipo: "focar", indice: 0 });
    expect(acaoTecladoMenu("End", 0, 3)).toEqual({ tipo: "focar", indice: 2 });
  });
  it("sem itens habilitados ou outra tecla: nenhuma ação", () => {
    expect(acaoTecladoMenu("ArrowDown", -1, 0)).toEqual({ tipo: "nenhuma" });
    expect(acaoTecladoMenu("a", 0, 3)).toEqual({ tipo: "nenhuma" });
  });
});
