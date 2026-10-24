import { describe, expect, it, vi } from "vitest";
import type { FinalidadeAtendimentoWhatsApp } from "@prisma/client";
import { motivoParaNaoAtuar } from "@/server/aria/turno/guardas";
vi.mock("@/server/aria/estado", () => ({ situacaoAria: vi.fn() }));
vi.mock("@/server/aria/uso", () => ({ estadoOrcamento: vi.fn() }));
import { ariaAtivaGlobal, derivarEstadoAria, linhaEstadoDe, sugestaoVigente, idsHandoffPendente, sugestoesPendentesPorAtendimento, carregarContextoAria, type LinhaEstadoAria, type ContextoEstadoAria } from "./estado-aria";
import { situacaoAria } from "@/server/aria/estado";
import { estadoOrcamento } from "@/server/aria/uso";
import type { Db } from "@/server/whatsapp/escopo";
const agora = new Date("2026-10-24T12:00:00Z");
const base: LinhaEstadoAria = { id: "a", finalidade: "COMERCIAL", encerradoEm: null, iaPausadaEm: null, responsavelId: null, grupo: false, numeroComDono: false, contatoOptOut: false };
const contexto = (o: Partial<ContextoEstadoAria> = {}): ContextoEstadoAria => ({ ariaAtiva: true, handoffPendentes: new Set(), agora, ...o });
describe("prioridades de EstadoAria", () => {
  it.each([
    [{}, true, "aprovacao"], [{}, false, "ia"], [{ responsavelId: "u" }, false, "ia"],
    [{ iaPausadaEm: agora }, true, "humano"], [{ iaPausadaEm: agora }, false, "humano"],
    [{ encerradoEm: agora }, true, null], [{ grupo: true }, true, null],
    [{ finalidade: "FINANCEIRO" }, false, null], [{ numeroComDono: true }, false, null], [{ contatoOptOut: true }, false, null],
  ] as const)("classifica %j com sugestao %s", (extra, sugestao, resultado) => {
    expect(derivarEstadoAria({ ...base, ...extra }, contexto(), sugestao)).toBe(resultado);
  });
  it("grupo/encerrado vencem handoff, que vence pausa/sugestao/responsavel", () => {
    const ctx = contexto({ handoffPendentes: new Set(["a"]) }), a = { ...base, iaPausadaEm: agora, responsavelId: "u" };
    expect(derivarEstadoAria(a, ctx, true)).toBe("handoff");
    expect(derivarEstadoAria({ ...a, grupo: true }, ctx, true)).toBeNull();
    expect(derivarEstadoAria({ ...a, encerradoEm: agora }, ctx, true)).toBeNull();
  });
  it("desligar global preserva aprovacao e humano; fila vira null", () => {
    const ctx = contexto({ ariaAtiva: false });
    expect(derivarEstadoAria(base, ctx, true)).toBe("aprovacao");
    expect(derivarEstadoAria({ ...base, responsavelId: "u" }, ctx, false)).toBe("humano");
    expect(derivarEstadoAria(base, ctx, false)).toBeNull();
  });
  it("elegibilidade coincide com a guarda existente sem mutar entrada/contexto", () => {
    for (const finalidade of ["COMERCIAL", "FINANCEIRO", "PEDAGOGICO"] as FinalidadeAtendimentoWhatsApp[]) for (const numeroComDono of [false, true]) for (const contatoOptOut of [false, true]) {
      const a = Object.freeze({ ...base, finalidade, numeroComDono, contatoOptOut }), ctx = Object.freeze(contexto());
      const bloqueio = motivoParaNaoAtuar({ estado: "ATIVA", pausadaGlobal: false, orcamento: "OK", acaoOrcamento: "PAUSAR", conversaDeGrupo: a.grupo, finalidade, iaPausadaEm: null, atendimentoEncerrado: false, contatoOptOut, numeroComDono, mensagemTipo: "TEXTO" });
      expect(derivarEstadoAria(a, ctx, false)).toBe(bloqueio === null ? "ia" : null);
      expect(ctx.agora).toBe(agora);
    }
  });
});
describe("contexto global e adaptador", () => {
  it.each(["ATIVA", "SHADOW", "DESLIGADA"] as const)("estado global %s", estado => {
    expect(ariaAtivaGlobal({ estado, pausada: false, temVersao: true }, { situacao: "OK", acao: "PAUSAR" })).toBe(estado === "ATIVA");
  });
  it("versao/pausa global/orcamento sao guardas independentes", () => {
    const s = { estado: "ATIVA" as const, pausada: false, temVersao: true };
    expect(ariaAtivaGlobal({ ...s, temVersao: false }, { situacao: "OK", acao: "PAUSAR" })).toBe(false);
    expect(ariaAtivaGlobal({ ...s, pausada: true }, { situacao: "ALERTA", acao: "SO_SUGERIR" })).toBe(false);
    expect(ariaAtivaGlobal(s, { situacao: "ESTOURADO", acao: "PAUSAR" })).toBe(false);
    expect(ariaAtivaGlobal(s, { situacao: "ESTOURADO", acao: "SO_SUGERIR" })).toBe(true);
  });
  it("traduz relacoes e ausencia de contato sem alterar o objeto", () => {
    const a = { id: "a", finalidade: "COMERCIAL" as const, encerradoEm: null, iaPausadaEm: null, responsavelId: null, conversa: { grupoId: null, numero: { donoId: null }, contato: { optOutEm: null } } };
    expect(linhaEstadoDe(a)).toEqual(base);
    expect(linhaEstadoDe({ ...a, conversa: { grupoId: "g", numero: { donoId: "u" }, contato: null } })).toMatchObject({ grupo: true, numeroComDono: true, contatoOptOut: false });
  });
  it("expiracao usa instante estritamente futuro e status SUGERIDA", () => {
    expect(sugestaoVigente(agora)).toEqual({ status: "SUGERIDA", OR: [{ expiraEm: null }, { expiraEm: { gt: agora } }] });
  });
});
describe("loaders em lote sem DB neste recorte", () => {
  it("ids vazios nao consultam; ids undefined nao viram lista vazia", async () => {
    const query = vi.fn().mockResolvedValue([]), db = { $queryRaw: query } as unknown as Db;
    expect(await idsHandoffPendente(db, [])).toEqual([]);
    expect(await sugestoesPendentesPorAtendimento(db, [], agora)).toEqual(new Map());
    expect(query).not.toHaveBeenCalled();
    await idsHandoffPendente(db);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("ids sao parametros de lote completo, nao interpolacao SQL ou cap200", async () => {
    const ids = Array.from({ length: 205 }, (_, i) => "id" + i).concat("a'); DROP TABLE x;--"), query = vi.fn().mockResolvedValue(ids.map(id => ({ id }))), db = { $queryRaw: query } as unknown as Db;
    expect(await idsHandoffPendente(db, ids.concat(ids[0]!))).toEqual(ids);
    const sql = query.mock.calls[0]![0];
    expect(sql.values).toContainEqual(ids);
    expect(sql.text).not.toContain("DROP TABLE");
    expect(sql.text).toContain('"iaPausadaEm" IS NOT NULL');
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("sugestoes retornam acao/data de cada atendimento em lote", async () => {
    const rows = [{ atendimentoId: "a", acao: "RESPONDER", criadoEm: agora }], query = vi.fn().mockResolvedValue(rows), db = { $queryRaw: query } as unknown as Db;
    expect(await sugestoesPendentesPorAtendimento(db, ["a"], agora)).toEqual(new Map([["a", { acao: "RESPONDER", criadoEm: agora }]]));
    expect(query.mock.calls[0]![0].text).toContain('DISTINCT ON');
  });
  it("contexto passa mesmo db/agora aos helpers; nao consulta handoff para []", async () => {
    const db = { $queryRaw: vi.fn() } as unknown as Db;
    vi.mocked(situacaoAria).mockResolvedValue({ estado: "ATIVA", pausada: false, supervisao: false, versao: null });
    vi.mocked(estadoOrcamento).mockResolvedValue({ situacao: "OK", acao: "PAUSAR", gastoUsd: 0, limiteUsd: 100 });
    expect(await carregarContextoAria(db, { atendimentoIds: [], agora })).toEqual({ ariaAtiva: false, handoffPendentes: new Set(), agora });
    expect(situacaoAria).toHaveBeenLastCalledWith(agora, db);
    expect(estadoOrcamento).toHaveBeenLastCalledWith(agora, db);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});
