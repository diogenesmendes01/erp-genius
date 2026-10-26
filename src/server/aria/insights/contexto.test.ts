import { describe, expect, it } from "vitest";

import { prepararContextoInsight, type MensagemParaInsight } from "./contexto";
const preparar = (mensagens: MensagemParaInsight[], ocultar = (s: string) => s) => prepararContextoInsight(mensagens, ocultar);
const msg = (id: string, extra: Partial<MensagemParaInsight> = {}): MensagemParaInsight => ({ id, criadoEm: new Date("2026-10-25T12:00:00Z"),
  editadaEm: null, apagadaEm: null, direcao: "ENTRADA", status: "ENVIADA", corpo: `Texto ${id}`, ...extra });
describe("contexto puro e limitado dos Insights", () => {
  it("ordena por data e ID sem modificar a entrada", async () => {
    const entrada = [msg("b"), msg("a")];
    const r = await preparar(entrada);
    expect(r.mensagens.map(m => m.texto)).toEqual(["Texto a", "Texto b"]);
    expect(r.ultimaMensagemId).toBe("b");
    expect(entrada[0].id).toBe("b");
  });
  it("seleciona somente as30 últimas falas elegíveis", async () => {
    const r = await preparar(Array.from({length:35}, (_, i) => msg(String(i).padStart(2,"0"))));
    expect(r.quantidade).toBe(30);
    expect(r.mensagens[0].texto).toBe("Texto 05");
  });
  it("não transforma saída pendente ou falha em fala entregue", async () => {
    const r = await preparar([msg("a"), msg("b",{direcao:"SAIDA",status:"NA_FILA"}),
      msg("c",{direcao:"SAIDA",status:"FALHOU"}), msg("d",{apagadaEm:new Date()}),
      msg("e",{corpo:"  "}), msg("f",{direcao:"SAIDA",status:"LIDA"})]);
    expect(r.mensagens).toEqual([{papel:"usuario",texto:"Texto a"},{papel:"assistente",texto:"Texto f"}]);
    expect(r.quantidade).toBe(2);
  });
  it("limita após mascaramento a2000 por fala e24000 no total preservando as mais recentes", async () => {
    const r = await preparar(Array.from({length:30},(_,i)=>msg(String(i),{corpo:"a".repeat(2500)})), s=>"X"+s);
    expect(r.mensagens.every(m=>m.texto.length<=2000)).toBe(true);
    expect(r.mensagens.reduce((n,m)=>n+m.texto.length,0)).toBe(24000);
    expect(r.mensagens.at(-1)?.texto.startsWith("X")).toBe(true);
    expect(r.quantidade).toBe(r.mensagens.length);
  });
  it("hash detecta alteração e exclusão, mas não mero receipt de entrega", async () => {
    const a = await preparar([msg("a",{direcao:"SAIDA",status:"ENVIADA"})]);
    const lida = await preparar([msg("a",{direcao:"SAIDA",status:"LIDA"})]);
    const editada = await preparar([msg("a",{direcao:"SAIDA",corpo:"Texto editado"})]);
    const apagada = await preparar([msg("a",{apagadaEm:new Date()})]);
    expect(a.baseHash).toBe(lida.baseHash);
    expect(a.baseHash).not.toBe(editada.baseHash);
    expect(a.baseHash).not.toBe(apagada.baseHash);
  });
  it("não envia identificadores e passa todo texto pela porta de mascaramento", async () => {
    const r = await preparar([msg("id-interno",{corpo:"email pessoal"})],()=>"[oculto]");
    expect(r.mensagens).toEqual([{papel:"usuario",texto:"[oculto]"}]);
    expect(JSON.stringify(r.mensagens)).not.toContain("id-interno");
  });
  it("vazio tem base estável sem inventar fala", async () => {
    expect(await preparar([])).toEqual(await preparar([]));
    expect((await preparar([])).ultimaMensagemId).toBeNull();
  });
});
