import type { FonteHistorico, PaginaHistorico } from "./historico-conversa";

export class ErroFonte extends Error {
  constructor(public status: number, mensagem: string) { super(mensagem); this.name = "ErroFonte"; }
}

/** Páginas da thread pelas rotas do ERP (`GET /api/inbox/atendimentos/:id/mensagens`); o navegador nunca fala com o motor. */
export const fonteErp: FonteHistorico = {
  async pagina(atendimentoId, o, signal) {
    const q = new URLSearchParams();
    if (o.antes) q.set("antes", o.antes);
    else if (o.depois) q.set("depois", o.depois);
    const qs = q.toString();
    const r = await fetch(`/api/inbox/atendimentos/${encodeURIComponent(atendimentoId)}/mensagens${qs ? `?${qs}` : ""}`,
      { signal, cache: "no-store", credentials: "same-origin" });
    if (!r.ok) throw new ErroFonte(r.status, `Falha ao carregar mensagens (${r.status}).`);
    const j = await r.json() as PaginaHistorico;
    return { mensagens: j.mensagens, notas: j.notas ?? null, antes: j.antes, depois: j.depois, temMais: j.temMais };
  },
};
