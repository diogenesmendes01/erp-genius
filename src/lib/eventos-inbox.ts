import type { AvisoInbox } from "@/server/inbox/barramento";
const TIPOS: AvisoInbox["tipo"][] = ["atendimento.atualizado", "mensagem.nova", "mensagem.status", "resync"];
export type FonteEventos = {
  onopen: ((e: Event) => void) | null; onerror: ((e: Event) => void) | null;
  addEventListener(tipo: string, f: (e: Event) => void): void; close(): void;
};
/** Reconexão nativa; avisos atrasados de uma fonte encerrada não alcançam assinantes. */
export function assinarEventosInbox(criar: () => FonteEventos, aoAviso: (a: AvisoInbox) => void, aoConectado: (c: boolean) => void): () => void {
  const fonte = criar(); let ativo = true; let jaAbriu = false;
  fonte.onopen = () => { if (!ativo) return; aoConectado(true); if (jaAbriu) aoAviso({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" }); jaAbriu = true; };
  fonte.onerror = () => { if (ativo) aoConectado(false); };
  const receber = (e: Event) => {
    if (!ativo) return;
    let aviso: AvisoInbox; try { aviso = JSON.parse((e as MessageEvent<string>).data) as AvisoInbox; } catch { return; }
    if (aviso && TIPOS.includes(aviso.tipo)) aoAviso(aviso);
  };
  for (const tipo of TIPOS) fonte.addEventListener(tipo, receber);
  return () => { if (!ativo) return; ativo = false; fonte.onopen = null; fonte.onerror = null; fonte.close(); aoConectado(false); };
}
type Assinante = { aviso: (a: AvisoInbox) => void; conexao: (c: boolean) => void };
const assinantes = new Set<Assinante>();
let encerrar: (() => void) | null = null; let conectado = false;
/** Uma fonte por aba, inclusive quando Sidebar, gaveta e Inbox estão montados juntos. */
export function assinarEventosCompartilhados(aoAviso: (a: AvisoInbox) => void, aoConectado: (c: boolean) => void, criar?: () => FonteEventos): () => void {
  if (!criar && typeof EventSource === "undefined") { aoConectado(false); return () => {}; }
  const assinante = { aviso: aoAviso, conexao: aoConectado }; assinantes.add(assinante); aoConectado(conectado);
  // Quem monta após o stream já aberto pode ter um snapshot SSR anterior aos avisos.
  if (conectado) aoAviso({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" });
  if (!encerrar) encerrar = assinarEventosInbox(criar ?? (() => new EventSource("/api/inbox/eventos")),
    (a) => { for (const s of [...assinantes]) { try { s.aviso(a); } catch { /* um assinante não derruba os outros */ } } },
    (c) => { conectado = c; for (const s of [...assinantes]) { try { s.conexao(c); } catch { /* idem */ } } });
  return () => {
    if (!assinantes.delete(assinante)) return;
    if (!assinantes.size) { const sair = encerrar; encerrar = null; sair?.(); conectado = false; }
  };
}
