"use client";

import { IconBellOff, IconClockExclamation, IconPin, IconUsersGroup, IconUserX } from "@tabler/icons-react";
import { Avatar } from "@/components/Avatar";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { BadgeEstado } from "./BadgeEstado";
import { estadoVisualItem } from "./estado-visual";

export function ItemConversa({ item, selecionado, agora, aoSelecionar, usuarioId, fuso }: {
  item: ItemListaInbox;
  selecionado: boolean;
  agora: Date;
  aoSelecionar(): void;
  usuarioId?: string;
  fuso: string | null;
}) {
  const visual = estadoVisualItem(item, agora, usuarioId);
  const hora = item.ultimaMensagemEm ? formatarInstanteExibicao(item.ultimaMensagemEm, fuso, "UTC", "hora").texto : "";
  return (
    <button
      type="button"
      aria-current={selecionado ? "true" : undefined}
      onClick={aoSelecionar}
      className={"flex w-full gap-3 rounded-lg px-2.5 py-[11px] text-left " + (selecionado ? "bg-gray-100" : "hover:bg-surface-muted")}
    >
      {item.grupo
        ? <span data-testid="icone-grupo" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600"><IconUsersGroup size={20} aria-label="Grupo" /></span>
        : <Avatar nome={item.contatoNome} tamanho={44} tom={visual.avatarTom} selo={visual.seloIa ? "ia" : undefined} />}
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold">{item.contatoNome}</span>
          {item.silenciada && <IconBellOff size={12} className="shrink-0 text-gray-400" aria-label="Silenciada" />}
          {item.fixada && <IconPin size={12} className="shrink-0 text-gray-400" aria-label="Fixada" />}
          <span className={"ml-auto shrink-0 font-mono text-[11.5px] tabular-nums " + (item.naoLidas > 0 ? "text-brand-700" : "text-gray-400")}>{hora}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] text-gray-600">{visual.previa}</span>
          {item.naoLidas > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-solid px-1.5 text-[11px] font-semibold font-mono tabular-nums text-on-brand">{item.naoLidas}</span>}
        </span>
        {visual.badges.length > 0 && <span className="mt-[3px] flex flex-wrap items-center gap-1.5">
          {visual.badges.map((badge) => <BadgeEstado key={badge.texto} tom={badge.tom} ponto={badge.ponto} tracejado={badge.tracejado}
            icone={badge.icone === "relogio" ? <IconClockExclamation size={11} data-testid="icone-prazo" aria-hidden /> : badge.icone === "sem-nome" ? <IconUserX size={11} data-testid="icone-sem-nome" aria-hidden /> : undefined}>
            {badge.texto}
          </BadgeEstado>)}
        </span>}
      </span>
    </button>
  );
}
