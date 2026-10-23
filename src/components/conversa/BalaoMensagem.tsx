"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IconAlertCircle, IconCheck, IconChecks, IconChevronDown, IconClock, IconStar, IconUser, IconSparkles, IconLock } from "@tabler/icons-react";
import type { MensagemThread, NotaInternaThread } from "@/server/whatsapp/consultas-inbox";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { ORIGEM_ENVIO_LABEL } from "@/lib/labels";
import { CLASSE_ITEM_MENU, CLASSE_PAINEL_MENU, ligarMenuAberto } from "@/components/Menu";
import { posicaoPopover } from "@/lib/popover";
import type { AutorBalao } from "./itens-thread";
export type { AutorBalao } from "./itens-thread";
import { CartaoPix, type PixDados } from "./CartaoPix";
import { EnqueteLeitura, type EnqueteDados } from "./EnqueteLeitura";
import { AVISO_RECURSO_MOTOR, type RecursoMotor } from "./recursos-canal";
import { MidiaMensagem, temMidia, VisualizadorMidia } from "./VisualizadorMidia";

export type ComandoMensagem = "favoritar" | "encaminhar" | "copiar" | "editar" | "apagar" | "reagir" | "responder";

/** Quem escreveu: o celular, a Aria, a pessoa da equipe, o sistema ou o participante (entrada em grupo). */
export function autorDaMensagem(m: Pick<MensagemThread, "direcao" | "origem" | "autorNome" | "participanteNome">): string | null {
  if (m.direcao === "ENTRADA") return m.participanteNome;
  if (m.origem === "CELULAR" || m.origem === "IA") return ORIGEM_ENVIO_LABEL[m.origem];
  if (m.origem === "CRON" || m.origem === "LOTE" || m.origem === "GESTAO") return "Sistema";
  return m.autorNome;
}

const STATUS: Record<string, { rotulo: string; icone: ReactNode; erro?: boolean }> = {
  NA_FILA: { rotulo: "Enviando", icone: <IconClock size={13} aria-hidden /> },
  ENVIADA: { rotulo: "Enviada", icone: <IconCheck size={13} aria-hidden /> },
  ENTREGUE: { rotulo: "Entregue", icone: <IconChecks size={13} aria-hidden /> },
  LIDA: { rotulo: "Lida", icone: <IconChecks size={13} className="text-brand-700" aria-hidden /> },
  FALHOU: { rotulo: "Não enviada", icone: <IconAlertCircle size={13} aria-hidden />, erro: true },
};

function hora(iso: string, fuso: string | null): string {
  return formatarInstanteExibicao(iso, fuso, "UTC", "hora").texto;
}

interface ItemAcao { cmd: ComandoMensagem; rotulo: string; recurso?: RecursoMotor; perigo?: boolean }

export function BalaoMensagem({ m, fuso, aoComando, recursos, comandos, menuAberto = false, enquete, pix, autor: autorVisual, emSequencia = false, destacada = false, nota }: {
  m: MensagemThread; fuso: string | null; aoComando: (c: ComandoMensagem) => void; recursos: (r: RecursoMotor) => boolean;
  /** Comandos que quem usa o balão trata; os demais não aparecem no menu. Sem a lista, o menu vem completo. */
  comandos?: readonly ComandoMensagem[];
  /** Estado inicial do menu (testes de marcação). */
  menuAberto?: boolean;
  /** Dados estruturados quando a thread os traz; sem eles, a mensagem aparece só como texto. */
  enquete?: EnqueteDados; pix?: PixDados;
  autor?: AutorBalao; emSequencia?: boolean; destacada?: boolean; nota?: NotaInternaThread;
}) {
  const [menu, setMenu] = useState(menuAberto);
  const [visualizador, setVisualizador] = useState(false);
  const [pos, setPos] = useState<{ topo: number; esquerda: number } | null>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const fechar = useCallback((devolverFoco: boolean) => {
    setMenu(false);
    setPos(null);
    if (devolverFoco) gatilhoRef.current?.focus();
  }, []);
  const habilitados = useCallback(() => Array.from(painelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []), []);

  const autor = autorVisual ?? (nota ? "nota" : m.direcao === "ENTRADA" ? "cliente" : m.origem === "IA" ? "aria" : "humano");
  const ehNota = autor === "nota";
  const saida = autor !== "cliente";
  const nomeAutor = autor === "aria" ? "Aria · IA" : ehNota ? (nota?.origem === "oportunidade" ? "Nota da oportunidade · só equipe" : "Nota interna · só equipe") : autor === "humano" && m.propria ? "Você" : autorDaMensagem(m);
  const corAutor = autor === "aria" ? "text-ai-700" : ehNota ? "text-amber-700" : autor === "humano" ? "text-brand-800" : "text-gray-600";
  const fundo = autor === "aria" ? "bg-bubble-ia" : ehNota ? "bg-bubble-note border border-dashed border-amber-600" : saida ? "bg-entry-accent" : "bg-entry";
  const st = saida && !ehNota ? STATUS[m.status] ?? STATUS.ENVIADA : null;
  const todos: ItemAcao[] = [
    { cmd: "responder", rotulo: "Responder" },
    ...(m.corpo ? [{ cmd: "copiar" as const, rotulo: "Copiar" }] : []),
    { cmd: "reagir", rotulo: "Reagir", recurso: "reagir" },
    { cmd: "encaminhar", rotulo: "Encaminhar", recurso: "encaminhar" },
    { cmd: "favoritar", rotulo: m.favorita ? "Remover dos favoritos" : "Favoritar" },
    ...(saida && m.tipo === "TEXTO" ? [{ cmd: "editar" as const, rotulo: "Editar", recurso: "editar" as const }] : []),
    { cmd: "apagar", rotulo: "Apagar", recurso: "apagar", perigo: true },
  ];
  const itens = ehNota ? [] : comandos ? todos.filter((i) => comandos.includes(i.cmd)) : todos;
  const menuAtivo = menu && itens.length > 0;
  // Texto, ordem e disponibilidade alteram a altura do menu, inclusive após atualização da thread.
  const medidasDoMenu = itens.map((i) => `${i.cmd}:${i.rotulo}:${!!i.recurso && !recursos(i.recurso)}`).join("|");
  useLayoutEffect(() => {
    if (!menuAtivo || !gatilhoRef.current || !painelRef.current) return;
    const ancora = gatilhoRef.current.getBoundingClientRect();
    const painel = painelRef.current.getBoundingClientRect();
    const { topo, esquerda } = posicaoPopover({
      ancora,
      painel: { largura: painel.width, altura: painel.height },
      viewport: { largura: window.innerWidth, altura: window.innerHeight },
    });
    setPos({ topo, esquerda });
  }, [menuAtivo, medidasDoMenu]);
  useEffect(() => {
    // Hidden não recebe foco; preventScroll evita fechar o menu por rolagem ao focar.
    if (menuAtivo && pos) habilitados()[0]?.focus({ preventScroll: true });
  }, [menuAtivo, pos, habilitados]);
  useEffect(() => {
    if (!menuAtivo) return;
    return ligarMenuAberto({
      doc: document,
      painel: () => painelRef.current,
      gatilho: () => gatilhoRef.current,
      habilitados,
      fechar,
    });
  }, [menuAtivo, habilitados, fechar]);

  return (
    <div role={ehNota ? "note" : undefined} data-nota-id={ehNota ? nota?.id : undefined} data-mensagem-id={!ehNota ? m.id : undefined} className={`flex ${saida ? "justify-end" : "justify-start"} ${emSequencia ? "" : "mt-1.5"}`}>
      <div className={`group relative max-w-[min(560px,72%)] rounded-lg ${emSequencia ? "" : saida ? "rounded-tr-[4px]" : "rounded-tl-[4px]"} px-[11px] pb-1.5 pt-2 text-sm leading-[1.45] ${fundo} ${destacada ? "ring-2 ring-amber-600" : ""}`}>
        {itens.length > 0 && <button ref={gatilhoRef} type="button" aria-label="Opções da mensagem" aria-haspopup="menu" aria-expanded={menu} aria-controls={menu ? menuId : undefined}
          onClick={() => menu ? fechar(false) : setMenu(true)}
          className={`float-right -mr-1 ml-2 rounded hover:bg-highlight focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 ${menu ? "opacity-100" : "opacity-0"}`}><IconChevronDown size={16} aria-hidden /></button>}
        {!emSequencia && nomeAutor && <span className={`mb-[3px] flex items-center gap-[5px] text-xs font-semibold ${corAutor}`}>
          {autor === "humano" && <IconUser size={12} aria-hidden />}{autor === "aria" && <IconSparkles size={12} aria-hidden />}{ehNota && <IconLock size={12} aria-hidden />}{nomeAutor}
        </span>}
        {!ehNota && m.templateNome && <small className="block text-gray-600">Modelo: {m.templateNome}</small>}
        {!ehNota && temMidia(m) && <MidiaMensagem m={m} aoAbrir={() => setVisualizador(true)} />}
        {!ehNota && enquete && <EnqueteLeitura enquete={enquete} />}
        {!ehNota && pix && <CartaoPix pix={pix} />}
        {m.corpo && (ehNota || (!enquete && !pix)) && <p className="whitespace-pre-wrap break-words">{m.corpo}</p>}
        <div className="mt-0.5 flex flex-wrap items-center justify-end gap-1 font-mono text-[10.5px] tabular-nums text-gray-600">
          {ehNota && <span className="font-sans">{nota?.autorNome ?? "Autor não informado"}</span>}
          {!ehNota && m.apagada && <span>Apagada para todos</span>}
          {!ehNota && m.favorita && <IconStar size={12} aria-label="Favorita" />}
          <time dateTime={m.criadoEm}>{hora(m.criadoEm, fuso)}</time>
          {st && <span title={st.rotulo} className={`inline-flex items-center gap-0.5 ${st.erro ? "text-red-700" : ""}`}>{st.icone}{st.erro && <span>{st.rotulo}</span>}</span>}
        </div>
        {menuAtivo && (
          <div ref={painelRef} id={menuId} role="menu" aria-label="Opções da mensagem"
            style={{ position: "fixed", top: pos?.topo ?? 0, left: pos?.esquerda ?? 0, visibility: pos ? "visible" : "hidden", zIndex: 50, maxHeight: "calc(100dvh - 16px)", overflowY: "auto" }}
            className={CLASSE_PAINEL_MENU}>
            {itens.map((i) => {
              const indisponivel = !!i.recurso && !recursos(i.recurso);
              const classeItem = `${CLASSE_ITEM_MENU} ${i.perigo ? "text-red-700" : "text-gray-800"}`;
              return (
                <div key={i.cmd}>
                  <button type="button" role="menuitem" aria-label={i.rotulo} disabled={indisponivel}
                    onClick={() => { fechar(true); aoComando(i.cmd); }}
                    className={classeItem}>{i.rotulo}</button>
                  {indisponivel && <small className="block px-5 pb-1 text-xs text-gray-600">{AVISO_RECURSO_MOTOR}</small>}
                </div>
              );
            })}
          </div>
        )}
        {!ehNota && visualizador && <VisualizadorMidia m={m} aoFechar={() => setVisualizador(false)} />}
      </div>
    </div>
  );
}
