import type { AvisoInbox } from "@/server/inbox/barramento";
const TIPOS: AvisoInbox["tipo"][] = ["atendimento.atualizado", "mensagem.nova", "mensagem.status", "resync", "aria.global"];
const resync = (): AvisoInbox => ({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" });
export type FonteEventos = {
  readonly readyState: number;
  onopen: ((e: Event) => void) | null; onerror: ((e: Event) => void) | null;
  addEventListener(tipo: string, f: (e: Event) => void): void; close(): void;
};
export function assinarEventosInbox(criar: () => FonteEventos, aoAviso: (a: AvisoInbox) => void, aoConectado: (c: boolean) => void, aoEncerrada?: () => void): () => void {
  const fonte = criar(); let ativo = true; let jaAbriu = false;
  const encerrar = (definitiva = false) => {
    if (!ativo) return;
    ativo = false; fonte.onopen = null; fonte.onerror = null; fonte.close();
    if (definitiva) aoEncerrada?.();
    aoConectado(false);
  };
  fonte.onopen = () => { if (!ativo) return; aoConectado(true); if (jaAbriu) aoAviso(resync()); jaAbriu = true; };
  fonte.onerror = () => {
    if (!ativo) return;
    if (fonte.readyState === 2 ) encerrar(true);
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
let atrasoRecuperacao = 1000;
let retentativa: { timer: ReturnType<typeof setTimeout> } | null = null;
function avisar(a: AvisoInbox) {
  for (const s of [...assinantes]) { try { s.aviso(a); } catch {  } }
}
function notificarConexao(c: boolean) {
  for (const s of [...assinantes]) { try { s.conexao(c); } catch {  } }
}
function cancelarRetentativa() {
  if (retentativa) clearTimeout(retentativa.timer);
  retentativa = null;
}
function programarRecuperacao(criar: () => FonteEventos) {
  if (retentativa || fonteAtual || !assinantes.size) return;
  const pedido = { timer: setTimeout(() => {
    if (retentativa !== pedido) return;
    retentativa = null;
    if (assinantes.size && !fonteAtual) abrirFonte(criar);
  }, atrasoRecuperacao) };
  retentativa = pedido;
  atrasoRecuperacao = Math.min(atrasoRecuperacao * 2, 30000);
}
function abrirFonte(criar: () => FonteEventos) {
  if (fonteAtual || !assinantes.size) return;
  cancelarRetentativa();
  const ciclo: CicloFonte = { encerrar: null, ressincronizar: recuperar };
  fonteAtual = ciclo; recuperar = false;
  const encerrada = () => {
    if (fonteAtual !== ciclo) return;
    fonteAtual = null; conectado = false; recuperar = true;
    notificarConexao(false);
    programarRecuperacao(criar);
  };
  try {
    ciclo.encerrar = assinarEventosInbox(criar,
      (a) => { if (fonteAtual === ciclo) avisar(a); },
      (c) => {
        if (fonteAtual !== ciclo) return;
        if (c) atrasoRecuperacao = 1000;
        conectado = c; notificarConexao(c);
        if (c && fonteAtual === ciclo && ciclo.ressincronizar) { ciclo.ressincronizar = false; avisar(resync()); }
      },
      encerrada);
  } catch { encerrada(); }
}
export function assinarEventosCompartilhados(aoAviso: (a: AvisoInbox) => void, aoConectado: (c: boolean) => void, criar?: () => FonteEventos): () => void {
  if (!criar && typeof EventSource === "undefined") { aoConectado(false); return () => {}; }
  const assinante = { aviso: aoAviso, conexao: aoConectado }; assinantes.add(assinante); aoConectado(conectado);
  if (conectado) aoAviso(resync());
  abrirFonte(criar ?? (() => new EventSource("/api/inbox/eventos")));
  return () => {
    if (!assinantes.delete(assinante)) return;
    if (!assinantes.size) {
      const ciclo = fonteAtual; fonteAtual = null; conectado = false; recuperar = false;
      cancelarRetentativa(); atrasoRecuperacao = 1000;
      ciclo?.encerrar?.();
    }
  };
}
