import type { AvisoInbox } from "@/server/inbox/barramento";
const TIPOS: AvisoInbox["tipo"][] = ["atendimento.atualizado", "mensagem.nova", "mensagem.status", "resync"];
const resync = (): AvisoInbox => ({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" });
export type FonteEventos = {
  readonly readyState: number;
  onopen: ((e: Event) => void) | null; onerror: ((e: Event) => void) | null;
  addEventListener(tipo: string, f: (e: Event) => void): void; close(): void;
};
/** CONNECTING reconecta nativamente; CLOSED encerra o ciclo físico definitivamente. */
export function assinarEventosInbox(criar: () => FonteEventos, aoAviso: (a: AvisoInbox) => void, aoConectado: (c: boolean) => void, aoEncerrada?: () => void): () => void {
  const fonte = criar(); let ativo = true; let jaAbriu = false;
  const encerrar = (definitiva = false) => {
    if (!ativo) return;
    ativo = false; fonte.onopen = null; fonte.onerror = null; fonte.close();
    // Libera o ciclo compartilhado antes de notificar assinantes que possam remontar.
    if (definitiva) aoEncerrada?.();
    aoConectado(false);
  };
  fonte.onopen = () => { if (!ativo) return; aoConectado(true); if (jaAbriu) aoAviso(resync()); jaAbriu = true; };
  fonte.onerror = () => {
    if (!ativo) return;
    if (fonte.readyState === 2 /* CLOSED */) encerrar(true);
    else aoConectado(false);
  };
  const receber = (e: Event) => {
    if (!ativo) return;
    let aviso: AvisoInbox; try { aviso = JSON.parse((e as MessageEvent<string>).data) as AvisoInbox; } catch { return; }
    if (aviso && TIPOS.includes(aviso.tipo)) aoAviso(aviso);
  };
  for (const tipo of TIPOS) fonte.addEventListener(tipo, receber);
  return () => encerrar();
}
type Assinante = { aviso: (a: AvisoInbox) => void; conexao: (c: boolean) => void };
type CicloFonte = { encerrar: (() => void) | null; ressincronizar: boolean };
const assinantes = new Set<Assinante>();
let fonteAtual: CicloFonte | null = null; let conectado = false; let recuperar = false;
function avisar(a: AvisoInbox) {
  for (const s of [...assinantes]) { try { s.aviso(a); } catch { /* um assinante não derruba os outros */ } }
}
function notificarConexao(c: boolean) {
  for (const s of [...assinantes]) { try { s.conexao(c); } catch { /* idem */ } }
}
/** Uma fonte por aba; após CLOSED, a próxima assinatura recupera também os ouvintes antigos. */
export function assinarEventosCompartilhados(aoAviso: (a: AvisoInbox) => void, aoConectado: (c: boolean) => void, criar?: () => FonteEventos): () => void {
  if (!criar && typeof EventSource === "undefined") { aoConectado(false); return () => {}; }
  const assinante = { aviso: aoAviso, conexao: aoConectado }; assinantes.add(assinante); aoConectado(conectado);
  // Quem monta após o stream já aberto pode ter um snapshot SSR anterior aos avisos.
  if (conectado) aoAviso(resync());
  if (!fonteAtual) {
    const ciclo: CicloFonte = { encerrar: null, ressincronizar: recuperar };
    // Reserva a identidade antes de criar/instalar: callbacks síncronos não sobrescrevem outra fonte.
    fonteAtual = ciclo; recuperar = false;
    ciclo.encerrar = assinarEventosInbox(criar ?? (() => new EventSource("/api/inbox/eventos")),
      (a) => { if (fonteAtual === ciclo) avisar(a); },
      (c) => {
        if (fonteAtual !== ciclo) return;
        conectado = c; notificarConexao(c);
        if (c && fonteAtual === ciclo && ciclo.ressincronizar) { ciclo.ressincronizar = false; avisar(resync()); }
      },
      () => {
        if (fonteAtual !== ciclo) return;
        fonteAtual = null; conectado = false; recuperar = true; notificarConexao(false);
      });
  }
  return () => {
    if (!assinantes.delete(assinante)) return;
    if (!assinantes.size) {
      const ciclo = fonteAtual; fonteAtual = null; conectado = false; recuperar = false;
      ciclo?.encerrar?.();
    }
  };
}
