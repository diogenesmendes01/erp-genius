import type { MensagemThread, NotaInternaThread } from "@/server/whatsapp/consultas-inbox";
import type { AvisoInbox } from "@/server/inbox/barramento";

/** Página da thread: `antes`/`depois` são os cursores da primeira/última mensagem; `temMais` vale no sentido pedido. */
export interface PaginaHistorico { mensagens: MensagemThread[]; notas?: NotaInternaThread[] | null; antes: string | null; depois: string | null; temMais: boolean }
export interface FonteHistorico {
  pagina(atendimentoId: string, o: { antes?: string; depois?: string }, signal?: AbortSignal): Promise<PaginaHistorico>;
}
export interface EstadoHistorico {
  atendimentoId: string; mensagens: MensagemThread[]; notas: NotaInternaThread[];
  antes: string | null; depois: string | null; temMaisAntes: boolean; temMaisDepois: boolean;
  carregando: boolean; carregandoAntigas: boolean; carregandoNovas: boolean; erro: string;
}

export const LIMITE_HISTORICO = 600;
const PAGINAS_POR_RODADA = 10;
export const historicoVazio: EstadoHistorico = {
  atendimentoId: "", mensagens: [], notas: [], antes: null, depois: null, temMaisAntes: false, temMaisDepois: false,
  carregando: false, carregandoAntigas: false, carregandoNovas: false, erro: "",
};

const comparar = (a: MensagemThread, b: MensagemThread) =>
  a.criadoEm < b.criadoEm ? -1 : a.criadoEm > b.criadoEm ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Janela montada limitada a LIMITE_HISTORICO; o que sai da janela volta do banco pelos cursores, nunca de cache. */
export class HistoricoConversa {
  state: EstadoHistorico = historicoVazio;
  private ouvintes = new Set<() => void>();
  private controller = new AbortController();
  private geracao = 0;
  private id = "";
  private pendenteNovas = false;
  // Só as bordas de página cujas linhas continuam na janela: id da primeira → cursor "antes"; id da última → "depois".
  private antesDe = new Map<string, string>();
  private depoisDe = new Map<string, string>();
  constructor(private fonte: FonteHistorico) {}

  subscribe = (fn: () => void) => { this.ouvintes.add(fn); return () => { this.ouvintes.delete(fn); }; };
  getState = () => this.state;
  private publicar(p: Partial<EstadoHistorico>) { this.state = { ...this.state, ...p }; this.ouvintes.forEach((fn) => fn()); }
  private ocupado() { const s = this.state; return s.carregando || s.carregandoAntigas || s.carregandoNovas; }

  limpar = () => {
    this.controller.abort(); this.controller = new AbortController(); this.geracao++;
    this.antesDe.clear(); this.depoisDe.clear(); this.pendenteNovas = false; this.id = "";
    this.state = historicoVazio; this.ouvintes.forEach((fn) => fn());
  };

  private falhou(e: unknown, geracao: number) {
    if (geracao !== this.geracao || (e as Error).name === "AbortError") return;
    if ([401, 403, 404].includes((e as { status?: number }).status ?? 0)) { this.limpar(); return; }
    this.publicar({ carregando: false, carregandoAntigas: false, carregandoNovas: false, erro: (e as Error).message || "Falha ao carregar a conversa." });
  }
  private bordas(p: PaginaHistorico) {
    const primeira = p.mensagens[0], ultima = p.mensagens.at(-1);
    if (primeira && p.antes) this.antesDe.set(primeira.id, p.antes);
    if (ultima && p.depois) this.depoisDe.set(ultima.id, p.depois);
  }
  private podarBordas() {
    const ids = new Set(this.state.mensagens.map((m) => m.id));
    for (const k of [...this.antesDe.keys()]) if (!ids.has(k)) this.antesDe.delete(k);
    for (const k of [...this.depoisDe.keys()]) if (!ids.has(k)) this.depoisDe.delete(k);
  }
  private mesclar(novas: MensagemThread[]): MensagemThread[] {
    const m = new Map(this.state.mensagens.map((x) => [x.id, x]));
    for (const x of novas) m.set(x.id, x);
    return [...m.values()].sort(comparar);
  }

  async abrir(atendimentoId: string) {
    this.limpar(); this.id = atendimentoId;
    const g = this.geracao;
    this.publicar({ atendimentoId, carregando: true });
    try {
      const p = await this.fonte.pagina(atendimentoId, {}, this.controller.signal);
      if (g !== this.geracao) return;
      this.bordas(p);
      this.publicar({ mensagens: [...p.mensagens].sort(comparar).slice(-LIMITE_HISTORICO), notas: p.notas ?? [], antes: p.antes, depois: p.depois,
        temMaisAntes: p.temMais, temMaisDepois: false, carregando: false, erro: "" });
      this.podarBordas();
      this.drenar(g);
    } catch (e) { this.falhou(e, g); }
  }

  /**
   * Recarrega as mais recentes (por exemplo após `resync`, quando avisos podem ter sido perdidos). Diferente de
   * `abrir`: aborta o que estava em voo e troca a geração, mas não publica `historicoVazio` — a janela atual fica
   * na tela até a página nova chegar (sem piscar vazia na reconexão do LISTEN); falha comum mantém a janela com erro.
   */
  recarregar = async () => {
    if (!this.id) return;
    this.controller.abort(); this.controller = new AbortController(); this.geracao++; this.pendenteNovas = false;
    const g = this.geracao, id = this.id;
    this.publicar({ carregando: true, carregandoAntigas: false, carregandoNovas: false, erro: "" });
    try {
      const p = await this.fonte.pagina(id, {}, this.controller.signal);
      if (g !== this.geracao) return;
      this.antesDe.clear(); this.depoisDe.clear();
      this.bordas(p);
      this.publicar({ mensagens: [...p.mensagens].sort(comparar).slice(-LIMITE_HISTORICO), ...(p.notas != null ? { notas: p.notas } : {}), antes: p.antes, depois: p.depois,
        temMaisAntes: p.temMais, temMaisDepois: false, carregando: false, erro: "" });
      this.podarBordas();
      this.drenar(g);
    } catch (e) { this.falhou(e, g); }
  };

  private drenar(g: number) {
    if (g === this.geracao && this.pendenteNovas) { this.pendenteNovas = false; void this.maisNovas(); }
  }

  maisAntigas = async () => {
    const s = this.state;
    if (!this.id || this.ocupado() || !s.temMaisAntes || !s.antes) return;
    const g = this.geracao;
    this.publicar({ carregandoAntigas: true, erro: "" });
    try {
      const p = await this.fonte.pagina(this.id, { antes: s.antes }, this.controller.signal);
      if (g !== this.geracao) return;
      this.bordas(p);
      let todas = this.mesclar(p.mensagens), cortou = false;
      if (todas.length > LIMITE_HISTORICO) {
        // Corta o fim (mais novas), terminando numa mensagem cujo cursor "depois" ainda conhecemos.
        let fim = LIMITE_HISTORICO - 1;
        while (fim >= 0 && !this.depoisDe.has(todas[fim].id)) fim--;
        if (fim < 0) { await this.abrir(this.id); return; }
        todas = todas.slice(0, fim + 1); cortou = true;
      }
      this.publicar({ mensagens: todas, antes: p.mensagens.length ? p.antes : s.antes, temMaisAntes: p.temMais,
        ...(cortou ? { temMaisDepois: true, depois: this.depoisDe.get(todas.at(-1)!.id) ?? s.depois } : {}),
        carregandoAntigas: false });
      this.podarBordas();
      this.drenar(g);
    } catch (e) { this.falhou(e, g); }
  };

  /** Só o que veio depois do último cursor (aviso `mensagem.nova`); sem cursor (conversa vazia) abre as mais recentes. */
  maisNovas = async () => {
    if (!this.id) return;
    if (this.ocupado()) { this.pendenteNovas = true; return; }
    if (!this.state.depois) { await this.abrir(this.id); return; }
    const g = this.geracao;
    this.publicar({ carregandoNovas: true, erro: "" });
    try {
      for (let i = 0; i < PAGINAS_POR_RODADA; i++) {
        const s = this.state;
        const p = await this.fonte.pagina(this.id, { depois: s.depois! }, this.controller.signal);
        if (g !== this.geracao) return;
        this.bordas(p);
        let todas = this.mesclar(p.mensagens), cortou = false;
        if (todas.length > LIMITE_HISTORICO) {
          let ini = todas.length - LIMITE_HISTORICO;
          while (ini < todas.length && !this.antesDe.has(todas[ini].id)) ini++;
          if (ini >= todas.length) { await this.abrir(this.id); return; }
          todas = todas.slice(ini); cortou = true;
        }
        this.publicar({ mensagens: todas, ...(p.notas != null ? { notas: p.notas } : {}), depois: p.mensagens.length ? p.depois : s.depois, temMaisDepois: p.temMais,
          ...(cortou ? { temMaisAntes: true, antes: this.antesDe.get(todas[0].id) ?? s.antes } : {}) });
        this.podarBordas();
        if (!p.temMais || !p.mensagens.length) break;
      }
      this.publicar({ carregandoNovas: false });
      this.drenar(g);
    } catch (e) { this.falhou(e, g); }
  };
}

/**
 * Todo aviso do SSE (de qualquer tipo ou atendimento) reconcilia a janela aberta com `maisNovas`. O SSE e global ao
 * usuario e o React agrupa avisos no mesmo render, entao o hook so enxerga o ultimo; filtrar por tipo/atendimento
 * perderia a `mensagem.nova` do atendimento aberto agrupada com outro aviso. `maisNovas` e idempotente e barato
 * (consulta `depois` do cursor da ultima; sem novidade volta vazio); `resync` recarrega.
 */
export function reagirAoAviso(h: HistoricoConversa, _atendimentoId: string, aviso: AvisoInbox): Promise<void> {
  if (aviso.tipo === "resync") return h.recarregar();
  return h.maisNovas();
}
