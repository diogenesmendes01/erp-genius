import { describe, expect, it } from "vitest";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { estadoVisualItem, estadoVisualCabecalho, tempoDeEspera, PONTO_TOM, TEXTO_TOM } from "./estado-visual";
const agora = new Date("2026-10-22T13:00:00.000Z");
const menos = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();
const item = (o: Partial<ItemListaInbox> = {}): ItemListaInbox => ({
  id: "a1", numeroId: "n1", numeroRotulo: "Central", finalidade: "COMERCIAL", driver: "SIMULADO",
  contatoId: "c1", contatoNome: "Maria Souza", contatoTelefone: "+5511999990000", optOut: false, vinculo: null,
  naoLidas: 0, ultimaMensagemEm: null, preview: "Oi", linhaComercial: false,
  status: "EM_ATENDIMENTO", responsavelNome: "Ana Lima", prazoRespostaEm: null, fixada: false, silenciada: false, grupo: false,
  responsavelId: "u1", numeroDonoId: null, setoresDoNumero: ["COMERCIAL"], atendimentoOrigemId: null, capacidades: [], ...o,
});
describe("estadoVisualItem", () => {
  it("com você, outra pessoa pelo primeiro nome, fila e encerrado", () => {
    expect(estadoVisualItem(item(), agora, "u1").badges[0]).toEqual({ tom: "humano", texto: "Com você" });
    expect(estadoVisualItem(item({ responsavelId: "u2" }), agora, "u1").badges[0]).toEqual({ tom: "humano", texto: "Com Ana" });
    const fila = estadoVisualItem(item({ status: "ABERTO_SEM_RESPONSAVEL", responsavelId: null }), agora, "u1").badges;
    expect(fila.at(-1)).toEqual({ tom: "neutro", texto: "Na fila", tracejado: true, ponto: false }); expect(fila.some(b => b.tom === "humano")).toBe(false);
    expect(estadoVisualItem(item({ status: "ENCERRADO" }), agora).badges[0]).toEqual({ tom: "neutro", texto: "Encerrado" });
  });
  it("setor vem depois do estado sem ponto", () => {
    expect(estadoVisualItem(item({ finalidade: "FINANCEIRO" }), agora).badges[1]).toEqual({ tom: "neutro", texto: "Financeiro", ponto: false });
  });
  it.each([[0.01, "sem-resposta", "1 min"], [22, "sem-resposta", "22 min"], [29, "sem-resposta", "29 min"], [30, "atraso", "30 min"], [48, "atraso", "48 min"], [125, "atraso", "2 h 5 min"]])("prazo vencido%smin", (min, tom, tempo) => {
    expect(estadoVisualItem(item({ prazoRespostaEm: menos(min as number) }), agora).badges).toContainEqual({ tom, texto: "Prazo estourado · " + tempo, icone: "relogio", ponto: false });
  });
  it.each([{}, { prazoRespostaEm: menos(-5) }, { prazoRespostaEm: menos(0) }, { prazoRespostaEm: "inválido" }, { status: "ENCERRADO", prazoRespostaEm: menos(50) }])("não acusa prazo ausente/futuro/igual/inválido/encerrado", o => {
    expect(estadoVisualItem(item(o), agora).badges.some(b => b.icone === "relogio")).toBe(false);
  });
  it.each([["+55 11 98765-4321", true], ["😀", true], ["Ana", false], ["😀 Ana", false], ["Ana 😀 Costa", false]])("sem nome só sem letra:%s", (nome, semNome) => {
    const badge = { tom: "neutro", texto: "Sem nome", tracejado: true, icone: "sem-nome", ponto: false };
    const badges = estadoVisualItem(item({ contatoNome: nome as string }), agora).badges;
    if (semNome) expect(badges).toContainEqual(badge); else expect(badges).not.toContainEqual(badge);
  });
  it("ordem é estado/setor/prazo/semnome/fila, grupo sem badges", () => {
    const b = estadoVisualItem(item({ contatoNome: "😀", responsavelId: null, status: "ABERTO_SEM_RESPONSAVEL", prazoRespostaEm: menos(50) }), agora).badges;
    expect(b.map(x => x.texto)).toEqual(["Comercial", "Prazo estourado · 50 min", "Sem nome", "Na fila"]);
    expect(estadoVisualItem(item({ grupo: true, prazoRespostaEm: menos(50) }), agora).badges).toEqual([]);
  });
  it("prévia e hash pelo contato, selo desativado naE1; não muta entrada", () => {
    const i = Object.freeze(item({ contatoId: "c3", preview: "Oi" }));
    expect(estadoVisualItem(i, agora)).toMatchObject({ previa: "Oi", avatarTom: 4, seloIa: false });
    expect(estadoVisualItem(item({ preview: null }), agora).previa).toBe("");
  });
});
describe("estadoVisualCabecalho", () => {
  it("quem atende, status automático e subtítulo", () => {
    expect(estadoVisualCabecalho(item({ numeroRotulo: "Central da escola" }), "u1")).toEqual({ status: "Em atendimento", estado: { tom: "humano", texto: "Você está atendendo" }, subtitulo: "Comercial · Central da escola" });
    expect(estadoVisualCabecalho(item({ responsavelId: "u2", responsavelNome: "Rodrigo Alves" }), "u1").estado).toEqual({ tom: "humano", texto: "Rodrigo está atendendo" });
    expect(estadoVisualCabecalho(item({ status: "ABERTO_SEM_RESPONSAVEL", responsavelId: null }), "u1").estado).toEqual({ tom: "neutro", texto: "Sem responsável" });
    expect(estadoVisualCabecalho(item({ status: "ENCERRADO" }), "u1").estado.texto).toBe("Atendimento encerrado");
    expect(estadoVisualCabecalho(item({ grupo: true }), "u1")).toMatchObject({ status: "Grupo", estado: { tom: "neutro", texto: "Conversa em grupo" } });
  });
  it("rótulo aguardando cliente e tons auxiliares", () => {
    expect(estadoVisualCabecalho(item({ status: "AGUARDANDO_CLIENTE" }), "u1").status).toBe("Aguardando cliente");
    expect(PONTO_TOM.atraso).toBe("bg-red-600"); expect(TEXTO_TOM.humano).toBe("text-brand-700");
  });
});
it("tempoDeEspera", () => {
  expect([1, 59, 60, 125].map(tempoDeEspera)).toEqual(["1 min", "59 min", "1 h", "2 h 5 min"]); expect(tempoDeEspera(0)).toBe("1 min");
});
