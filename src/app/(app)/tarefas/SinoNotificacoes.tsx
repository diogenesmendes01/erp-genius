"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconBell } from "@tabler/icons-react";
import { Drawer } from "@/components/Drawer";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ItemLista } from "@/components/ItemLista";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { marcarNotificacaoLida } from "@/server/crm/tarefas-acoes";
import type { NotificacaoItem } from "@/server/crm/notificacoes";
import { hrefTarefas } from "./visao";

/** Destino da notificação: o atendimento no Inbox (prazo estourado) ou a tarefa (lembrete). */
export function hrefNotificacao(n: NotificacaoItem): string {
  if (n.tipo === "SLA_ESTOURADO") return `/inbox?${new URLSearchParams({ c: n.refId })}`;
  return hrefTarefas({ t: n.refId });
}

/** Lê as notificações a cada navegação (o servidor entrega a lista); o tempo real fica para a Fase 3. */
export function SinoNotificacoes({ notificacoes, fusoExibicao, fusoEscola }: { notificacoes: NotificacaoItem[]; fusoExibicao: string; fusoEscola: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  async function abrir(n: NotificacaoItem) {
    // Falha em marcar como lida não impede de abrir o destino.
    if (!n.lida) await marcarNotificacaoLida(n.id).catch(() => undefined);
    setAberto(false);
    router.push(hrefNotificacao(n));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={naoLidas ? `Notificações, ${naoLidas} não lidas` : "Notificações"}
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-gray-600 hover:bg-highlight max-sm:min-h-11 max-sm:min-w-11"
      >
        <IconBell aria-hidden="true" className="h-5 w-5" />
        {naoLidas > 0 && <span aria-hidden="true" className="ml-0.5 text-xs font-medium text-red-700">{naoLidas}</span>}
      </button>
      <Drawer open={aberto} onClose={() => setAberto(false)} title="Notificações">
        {notificacoes.length === 0 ? (
          <EstadoVazio>Nenhuma notificação.</EstadoVazio>
        ) : (
          <ul className="divide-y divide-gray-200">
            {notificacoes.map((n) => (
              <li key={n.id}>
                <ItemLista titulo={n.titulo} resumo={formatarInstanteExibicao(n.criadaEm, fusoExibicao, fusoEscola).texto} selecionado={!n.lida} onClick={() => abrir(n)} />
              </li>
            ))}
          </ul>
        )}
        <Link href="/tarefas" className="mt-3 inline-block text-sm text-brand-700 hover:underline" onClick={() => setAberto(false)}>Ver todas as tarefas</Link>
      </Drawer>
    </>
  );
}
