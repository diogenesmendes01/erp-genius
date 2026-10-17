import { describe, expect, it, vi } from "vitest";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
import type { AvisoInbox } from "@/server/inbox/barramento";
import { fonteErp } from "./fonte-erp";
import { HistoricoConversa, LIMITE_HISTORICO, reagirAoAviso, type FonteHistorico, type PaginaHistorico } from "./historico-conversa";

const msg = (i: number): MensagemThread => ({
  id: `m${String(i).padStart(5, "0")}`, direcao: "ENTRADA", tipo: "TEXTO", corpo: `c${i}`, midiaPath: null, status: "RECEBIDA", origem: null,
  autorNome: null, templateNome: null, criadoEm: new Date(Date.UTC(2026, 9, 1) + i * 1000).toISOString(),
  participanteNome: null, favorita: false, clientMessageId: null,
});

/** Fonte falsa em memória por atendimento: cursor = "c<indice>" (exclusivo), mesmo contrato da rota. */
function fonteFalsa(total: Record<string, number>) {
  const dados: Record<string, MensagemThread[]> = {};
  for (const [id, n] of Object.entries(total)) dados[id] = Array.from({ length: n }, (_, i) => msg(i));
  const chamadas: { id: string; antes?: string; depois?: string }[] = [];
  const idx = (c: string, id: string) => dados[id].findIndex((m) => `c${m.id}` === c);
  const fonte: FonteHistorico & { dados: typeof dados; chamadas: typeof chamadas; atraso?: (id: string) => Promise<void> } = {
    dados, chamadas,
    async pagina(id, o): Promise<PaginaHistorico> {
      chamadas.push({ id, ...o });
      await fonte.atraso?.(id);
      const todas = dados[id], N = 60;
      let fatia: MensagemThread[], temMais: boolean;
      if (o.antes) { const f = idx(o.antes, id); const ini = Math.max(0, f - N); fatia = todas.slice(ini, f); temMais = ini > 0; }
      else if (o.depois) { const f = idx(o.depois, id); fatia = todas.slice(f + 1, f + 1 + N); temMais = f + 1 + N < todas.length; }
      else { fatia = todas.slice(-N); temMais = todas.length > N; }
      return { mensagens: fatia, antes: fatia.length ? `c${fatia[0].id}` : null, depois: fatia.length ? `c${fatia.at(-1)!.id}` : null, temMais };
    },
  };
  return fonte;
}
const ids = (h: HistoricoConversa) => h.getState().mensagens.map((m) => m.id);

describe("HistoricoConversa", () => {
  it("carrega a última página e, ao subir, as antigas sem duplicar", async () => {
    const f = fonteFalsa({ a: 150 }), h = new HistoricoConversa(f);
    await h.abrir("a");
    expect(h.getState().mensagens).toHaveLength(60);
    expect(h.getState().temMaisAntes).toBe(true);
    await h.maisAntigas();
    expect(h.getState().mensagens).toHaveLength(120);
    await h.maisAntigas();
    expect(h.getState().mensagens).toHaveLength(150);
    expect(h.getState().temMaisAntes).toBe(false);
    expect(new Set(ids(h)).size).toBe(150);
    expect(ids(h)).toEqual(f.dados.a.map((m) => m.id));
    await h.maisAntigas(); // sem mais: não chama a fonte de novo
    expect(f.chamadas).toHaveLength(3);
  });

  it("aviso mensagem.nova busca só depois do último cursor", async () => {
    const f = fonteFalsa({ a: 70 }), h = new HistoricoConversa(f);
    await h.abrir("a");
    f.dados.a.push(msg(70), msg(71));
    const ultimo = h.getState().depois!;
    f.chamadas.length = 0;
    const aviso: AvisoInbox = { tipo: "mensagem.nova", atendimentoId: "a", mensagemId: "m00070", conversaId: "cv" };
    await reagirAoAviso(h, "a", aviso);
    expect(f.chamadas).toEqual([{ id: "a", depois: ultimo }]);
    expect(ids(h).slice(-2)).toEqual(["m00070", "m00071"]);
    // aviso de outro atendimento ou de outro tipo não consulta nada
    f.chamadas.length = 0;
    await reagirAoAviso(h, "a", { ...aviso, atendimentoId: "b" });
    await reagirAoAviso(h, "a", { ...aviso, tipo: "atendimento.atualizado" });
    expect(f.chamadas).toHaveLength(0);
  });

  it("mensagem.status sozinho (nova agrupada pelo React) ainda busca a mensagem nova", async () => {
    const f = fonteFalsa({ a: 70 }), h = new HistoricoConversa(f);
    await h.abrir("a");
    f.dados.a.push(msg(70));
    await reagirAoAviso(h, "a", { tipo: "mensagem.status", atendimentoId: "a", mensagemId: "m00070", conversaId: "cv" });
    expect(ids(h).slice(-1)).toEqual(["m00070"]);
    f.chamadas.length = 0;
    await reagirAoAviso(h, "a", { tipo: "mensagem.status", atendimentoId: "b", mensagemId: "x", conversaId: "cv" });
    expect(f.chamadas).toHaveLength(0);
  });

  it("mensagem.nova durante o carregamento não se perde", async () => {
    const f = fonteFalsa({ a: 10 }), h = new HistoricoConversa(f);
    let soltar!: () => void;
    f.atraso = () => new Promise<void>((ok) => { soltar = ok; });
    const abrindo = h.abrir("a");
    void h.maisNovas(); // ocupado: fica pendente
    f.dados.a.push(msg(10));
    f.atraso = undefined; soltar();
    await abrindo;
    await vi.waitFor(() => expect(ids(h).at(-1)).toBe("m00010"));
  });

  it("resync recarrega as mais recentes", async () => {
    const f = fonteFalsa({ a: 10 }), h = new HistoricoConversa(f);
    await h.abrir("a");
    f.dados.a.push(msg(10), msg(11));
    await reagirAoAviso(h, "a", { tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" });
    expect(ids(h).slice(-2)).toEqual(["m00010", "m00011"]);
  });

  it("descarta resposta atrasada de outro atendimento", async () => {
    const f = fonteFalsa({ a: 20, b: 5 }), h = new HistoricoConversa(f);
    const soltar: Record<string, () => void> = {};
    f.atraso = (id) => new Promise<void>((ok) => { soltar[id] = ok; });
    const pa = h.abrir("a");
    const pb = h.abrir("b");
    soltar.b(); await pb;
    soltar.a(); await pa;
    expect(h.getState().atendimentoId).toBe("b");
    expect(h.getState().mensagens).toHaveLength(5);
  });

  it("nunca passa de 600 mensagens montadas, subindo ou descendo", async () => {
    const f = fonteFalsa({ a: 1000 }), h = new HistoricoConversa(f);
    await h.abrir("a");
    for (let i = 0; i < 17; i++) { await h.maisAntigas(); expect(h.getState().mensagens.length).toBeLessThanOrEqual(LIMITE_HISTORICO); }
    expect(h.getState().temMaisDepois).toBe(true);
    expect(h.getState().mensagens[0].id).toBe("m00000");
    // volta para a frente com o cursor do que sobrou na janela
    for (let i = 0; i < 17; i++) { await h.maisNovas(); expect(h.getState().mensagens.length).toBeLessThanOrEqual(LIMITE_HISTORICO); }
    expect(h.getState().mensagens.at(-1)!.id).toBe("m00999");
    expect(h.getState().temMaisDepois).toBe(false);
    expect(h.getState().temMaisAntes).toBe(true);
    const a = ids(h); expect(new Set(a).size).toBe(a.length);
    // continuidade: sem buracos na janela final
    const n0 = Number(a[0].slice(1)); expect(a).toEqual(a.map((_, i) => `m${String(n0 + i).padStart(5, "0")}`));
  });

  it("erro 404 da fonte limpa o estado", async () => {
    const h = new HistoricoConversa({ pagina: async () => { throw Object.assign(new Error("x"), { status: 404 }); } });
    await h.abrir("a");
    expect(h.getState().atendimentoId).toBe("");
  });
});

describe("fonteErp", () => {
  it("monta a URL com cursor e propaga o status de erro", async () => {
    const corpo = { mensagens: [], notas: [], antes: null, depois: "d", temMais: false };
    const fetchFalso = vi.fn<(url: string) => Promise<Response>>(async () => new Response(JSON.stringify(corpo)));
    vi.stubGlobal("fetch", fetchFalso);
    try {
      expect(await fonteErp.pagina("a/1", { depois: "x y" })).toEqual({ mensagens: [], antes: null, depois: "d", temMais: false });
      expect(fetchFalso.mock.calls[0][0]).toBe("/api/inbox/atendimentos/a%2F1/mensagens?depois=x+y");
      await fonteErp.pagina("a", {});
      expect(fetchFalso.mock.calls[1][0]).toBe("/api/inbox/atendimentos/a/mensagens");
      fetchFalso.mockResolvedValueOnce(new Response("{}", { status: 404 }));
      await expect(fonteErp.pagina("a", {})).rejects.toMatchObject({ status: 404 });
    } finally { vi.unstubAllGlobals(); }
  });
});
