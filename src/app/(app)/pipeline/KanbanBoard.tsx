"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type Announcements,
  type ClientRect,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { EtapaLead, Temperatura, MotivoPerda } from "@prisma/client";
import { COLUNAS } from "./colunas";
import { ETAPA_LABEL, TEMPERATURA_CLS, TEMPERATURA_LABEL, MOTIVO_PERDA_LABEL } from "@/lib/labels";
import { transicaoManualPermitida } from "@/server/_shared/regras";
import { moverEtapa, marcarPerdido } from "@/server/comercial/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Modal } from "@/components/Modal";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";

export interface KanbanLead {
  id: string;
  codigo: string | null;
  nome: string;
  etapa: EtapaLead;
  temperatura: Temperatura;
  b2b: boolean;
  pais: { nome: string } | null;
  proximaAcao: string | null;
  valorPrevisto: number | null;
  ultimaAcaoEm: string;
  etapaDesde: string;
}

function diasDesde(iso: string, agora: number): number {
  return Math.floor((agora - new Date(iso).getTime()) / 86400000);
}
function minutosDesde(iso: string, agora: number): number {
  return Math.floor((agora - new Date(iso).getTime()) / 60000);
}

// Acessibilidade do quadro (docs/42-auditoria-frontend-ux.md, E6/E7): o dnd-kit anuncia instruções de
// teclado por padrão — em inglês e sem KeyboardSensor registrado, ou seja, prometendo o que não
// funcionava. Aqui o teclado funciona de fato (Espaço/Enter pega, setas trocam de coluna, Espaço/Enter
// solta, Esc cancela) e as instruções e os anúncios saem em pt-BR, com o nome do lead e da etapa.
export const INSTRUCOES_KANBAN: ScreenReaderInstructions = {
  draggable:
    "Para mover o lead de etapa, pressione Espaço ou Enter na alça de arraste. " +
    "Use as setas para a esquerda e para a direita para escolher a etapa, " +
    "Espaço ou Enter para soltar e Esc para cancelar. " +
    "Sem arrastar, use o seletor “Mover para…” do card.",
};

function rotuloEtapa(id: UniqueIdentifier | undefined): string | null {
  if (id == null) return null;
  return ETAPA_LABEL[id as EtapaLead] ?? null;
}

/** Anúncios do leitor de tela para o arraste, a partir do lead de cada id. */
export function anunciosKanban(leadPorId: (id: UniqueIdentifier) => Pick<KanbanLead, "nome" | "etapa"> | undefined): Announcements {
  const lead = (id: UniqueIdentifier) => {
    const l = leadPorId(id);
    return { nome: l?.nome ?? "sem nome", etapa: l?.etapa, origem: l ? ETAPA_LABEL[l.etapa] : "etapa atual" };
  };
  return {
    onDragStart({ active }) {
      const l = lead(active.id);
      return `Lead ${l.nome} pego na etapa ${l.origem}.`;
    },
    onDragOver({ active, over }) {
      const l = lead(active.id);
      const destino = rotuloEtapa(over?.id);
      return destino ? `Lead ${l.nome} sobre a etapa ${destino}.` : `Lead ${l.nome} fora de uma etapa.`;
    },
    onDragEnd({ active, over }) {
      const l = lead(active.id);
      const destino = over ? (over.id as EtapaLead) : null;
      if (!destino || !rotuloEtapa(destino) || destino === l.etapa) {
        return `Lead ${l.nome} solto sem mudar de etapa; continua em ${l.origem}.`;
      }
      if (destino === EtapaLead.MATRICULADO) return `Lead ${l.nome} solto em ${ETAPA_LABEL[destino]}; abrindo a matrícula.`;
      if (destino === EtapaLead.PERDIDO) return `Lead ${l.nome} solto em ${ETAPA_LABEL[destino]}; informe o motivo da perda.`;
      if (l.etapa && !transicaoManualPermitida(l.etapa, destino)) {
        return `Lead ${l.nome} não pode ir de ${l.origem} para ${ETAPA_LABEL[destino]}; continua em ${l.origem}.`;
      }
      return `Lead ${l.nome} movido para ${ETAPA_LABEL[destino]}.`;
    },
    onDragCancel({ active }) {
      const l = lead(active.id);
      return `Movimentação cancelada; ${l.nome} continua em ${l.origem}.`;
    },
  };
}

/**
 * Seta para a esquerda/direita leva o card para a coluna vizinha de uma vez (o padrão do dnd-kit anda
 * 25px por tecla — uma dúzia de toques por coluna). Devolve a nova posição do canto superior esquerdo
 * do card, alinhada ao topo da coluna de destino, ou null quando não há coluna naquele sentido.
 */
export function colunaVizinha(colunas: ClientRect[], card: ClientRect, sentido: 1 | -1): { x: number; y: number } | null {
  if (colunas.length === 0) return null;
  const ordenadas = [...colunas].sort((a, b) => a.left - b.left);
  const centro = card.left + card.width / 2;
  // Coluna atual: a que contém o centro do card; fora de todas, a mais próxima dele.
  let atual = ordenadas.findIndex((c) => centro >= c.left && centro <= c.right);
  if (atual === -1) {
    let menor = Infinity;
    ordenadas.forEach((c, i) => {
      const d = Math.abs(c.left + c.width / 2 - centro);
      if (d < menor) { menor = d; atual = i; }
    });
  }
  const alvo = ordenadas[atual + sentido];
  if (!alvo) return null;
  return { x: alvo.left + (alvo.width - card.width) / 2, y: alvo.top };
}

const coordenadasTecladoKanban: KeyboardCoordinateGetter = (event, { context }) => {
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return undefined;
  const card = context.collisionRect;
  if (!card) return undefined;
  event.preventDefault();
  const destino = colunaVizinha([...context.droppableRects.values()], card, event.code === "ArrowRight" ? 1 : -1);
  return destino ?? undefined;
};

function Card({ lead, agora, bloqueado, aoMover }: {
  lead: KanbanLead;
  agora: number;
  bloqueado: boolean;
  aoMover: (lead: KanbanLead, destino: EtapaLead) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { etapa: lead.etapa },
    // Enquanto uma movimentação está no servidor, nenhum cartão arrasta: o segundo arraste seria
    // ignorado pela trava do executor, mas a tela deixaria tentar.
    disabled: bloqueado,
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={"rounded-lg border border-gray-200 bg-surface p-3 " + (isDragging ? "opacity-50" : "")}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-brand-700 hover:underline">
          {lead.nome}
        </Link>
        <span className={"rounded-full px-1.5 py-0.5 text-[10px] font-medium " + TEMPERATURA_CLS[lead.temperatura]}>
          {TEMPERATURA_LABEL[lead.temperatura]}
        </span>
      </div>
      <div className="mt-1 text-xs text-gray-400">
        {lead.codigo}
        {lead.pais ? ` · ${lead.pais.nome}` : ""}
        {lead.valorPrevisto != null ? ` · ${lead.valorPrevisto.toLocaleString("pt-BR")}` : ""}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-gray-400">
        <span>{diasDesde(lead.etapaDesde, agora)}d nesta etapa</span>
        <span>· últ. ação {diasDesde(lead.ultimaAcaoEm, agora)}d</span>
        {lead.etapa === EtapaLead.NOVO && minutosDesde(lead.etapaDesde, agora) > 60 && (
          <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 font-medium text-red-600">
            <IconAlertTriangle className="h-3 w-3" /> SLA
          </span>
        )}
      </div>
      {lead.proximaAcao && <div className="mt-1 text-xs text-gray-500">Próxima: {lead.proximaAcao}</div>}
      <div className="mt-2 flex gap-1">
        {/* alça de arraste — touch-none: no toque, o gesto arrasta o card em vez de rolar a página */}
        <button
          {...attributes}
          {...listeners}
          className="flex-1 cursor-grab touch-none rounded border border-dashed border-gray-200 py-0.5 text-[10px] text-gray-400 hover:bg-gray-50 active:cursor-grabbing"
        >
          ⠿ arrastar
        </button>
        {/* Alternativa sem arraste (E6): mesmo fluxo do soltar. Fica fora da alça — não inicia arraste. */}
        <select
          aria-label={`Mover ${lead.nome} para outra etapa`}
          value=""
          disabled={bloqueado}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const destino = e.target.value as EtapaLead;
            if (destino) aoMover(lead, destino);
          }}
          className="min-w-0 flex-1 rounded border border-gray-200 bg-surface px-1 py-0.5 text-[10px] text-gray-500 outline-none focus:border-brand-500 disabled:opacity-60"
        >
          <option value="">Mover para…</option>
          {COLUNAS.filter((c) => c !== lead.etapa).map((c) => (
            <option key={c} value={c}>{ETAPA_LABEL[c]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Coluna({ etapa, leads, agora, bloqueado, aoMover }: {
  etapa: EtapaLead;
  leads: KanbanLead[];
  agora: number;
  bloqueado: boolean;
  aoMover: (lead: KanbanLead, destino: EtapaLead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });
  const total = leads.reduce((s, l) => s + (l.valorPrevisto ?? 0), 0);
  const gargalo =
    etapa === EtapaLead.NOVO || etapa === EtapaLead.EXPERIMENTAL_AGENDADA || etapa === EtapaLead.PROPOSTA;
  return (
    <div className="w-64 shrink-0">
      <div
        className={
          "mb-2 flex items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium " +
          (etapa === EtapaLead.PERDIDO
            ? "bg-gray-100 text-gray-400"
            : gargalo
              ? "bg-amber-50 text-amber-800"
              : "bg-gray-50 text-gray-700")
        }
      >
        <span>{ETAPA_LABEL[etapa]}</span>
        <span className="text-xs">{leads.length}{total > 0 ? ` · ${total.toLocaleString("pt-BR")}` : ""}</span>
      </div>
      <div
        ref={setNodeRef}
        className={"flex min-h-[60px] flex-col gap-2 rounded-md p-1 " + (isOver ? "bg-brand-50 ring-1 ring-brand-300" : "")}
      >
        {leads.map((l) => (
          <Card key={l.id} lead={l} agora={agora} bloqueado={bloqueado} aoMover={aoMover} />
        ))}
        {leads.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-xs text-gray-300">vazio</div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ leads, referenciaTemporal }: { leads: KanbanLead[]; referenciaTemporal: number }) {
  const [agora, setAgora] = useState(referenciaTemporal);
  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const router = useRouter();
  const [tipo, setTipo] = useState<"pf" | "b2b">("pf");
  // Nem moverEtapa nem marcarPerdido recebem chave de idempotência (server/comercial/acoes.ts:364 e
  // :508 — cada chamada grava um evento novo): resultado incerto manda conferir antes de repetir.
  // O arraste NÃO é otimista: o card só muda de coluna com o refresh após a confirmação do servidor,
  // então na falha ele continua onde o servidor o tem e o motivo aparece logo acima do quadro.
  const acaoMover = useAcaoCliente({ idempotente: false });
  // A perda tem estado próprio: o erro fica dentro do modal, não atrás do overlay.
  const acaoPerda = useAcaoCliente({ idempotente: false });
  const [perda, setPerda] = useState<KanbanLead | null>(null);
  const [motivo, setMotivo] = useState<MotivoPerda>(MotivoPerda.NAO_RESPONDEU);
  const [obs, setObs] = useState("");
  const [periodoPerdido, setPeriodoPerdido] = useState(30); // dias; 0 = todos

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // No toque, um leve atraso separa "segurar para arrastar" de "rolar o quadro".
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: coordenadasTecladoKanban }),
  );

  const visiveis = useMemo(() => leads.filter((l) => (tipo === "b2b" ? l.b2b : !l.b2b)), [leads, tipo]);
  const porEtapa = useMemo(() => {
    const m = new Map<EtapaLead, KanbanLead[]>();
    for (const c of COLUNAS) m.set(c, []);
    for (const l of visiveis) (m.get(l.etapa) ?? m.set(l.etapa, []).get(l.etapa)!).push(l);
    return m;
  }, [visiveis]);
  const anuncios = useMemo(() => {
    const porId = new Map(leads.map((l) => [l.id as UniqueIdentifier, l]));
    return anunciosKanban((id) => porId.get(id));
  }, [leads]);

  // Fluxo único de mudança de etapa: o soltar do arraste e o seletor "Mover para…" passam por aqui.
  async function moverPara(lead: KanbanLead, destino: EtapaLead) {
    if (lead.etapa === destino) return;

    if (destino === EtapaLead.MATRICULADO) {
      router.push(`/matriculas/nova?lead=${lead.id}`);
      return;
    }
    if (destino === EtapaLead.PERDIDO) {
      setPerda(lead);
      return;
    }
    acaoMover.limpar();
    // Espelha a regra do servidor: feedback imediato e evita uma ida ao backend
    // para um destino que será recusado (etapa de evento ou salto inválido).
    if (!transicaoManualPermitida(lead.etapa, destino)) {
      acaoMover.setErro(
        `Não é possível arrastar de "${ETAPA_LABEL[lead.etapa]}" para "${ETAPA_LABEL[destino]}". ` +
          "Esta etapa é definida por uma ação específica.",
      );
      return;
    }
    const desfecho = await acaoMover.executar(() => moverEtapa(lead.id, destino));
    if (desfecho?.tipo === "ok") router.refresh();
  }

  async function onDragEnd(e: DragEndEvent) {
    const destino = e.over?.id as EtapaLead | undefined;
    if (!destino) return;
    const lead = visiveis.find((l) => l.id === e.active.id);
    if (!lead) return;
    await moverPara(lead, destino);
  }

  async function confirmarPerda() {
    if (!perda) return;
    const desfecho = await acaoPerda.executar(() => marcarPerdido(perda.id, { motivoPerda: motivo, observacao: obs }));
    // O modal só fecha com a perda confirmada; na falha, motivo e observação ficam para conferir.
    if (desfecho?.tipo !== "ok") return;
    setPerda(null);
    setObs("");
    router.refresh();
  }

  function fecharPerda() {
    acaoPerda.limpar();
    setPerda(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-medium">Pipeline</h1>
        <div className="flex gap-1 rounded-md bg-gray-100 p-1 text-sm">
          {(["pf", "b2b"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={"rounded px-3 py-1 " + (tipo === t ? "bg-surface font-medium" : "text-gray-500")}
            >
              {t === "pf" ? "Pessoa Física" : "Empresa (B2B)"}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        Arraste o card pela alça &quot;⠿ arrastar&quot; para mover de etapa. Soltar em <strong>Matriculado</strong> abre a matrícula; em <strong>Perdido</strong> pede o motivo.
        {" "}Pelo teclado, Espaço na alça pega o card e as setas trocam de coluna; ou use &quot;Mover para…&quot; no card.
      </p>
      <FeedbackAcao erro={acaoMover.erro} className="mb-3" />

      <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
        <span>Perdidos:</span>
        <select
          aria-label="Período dos perdidos exibidos"
          value={periodoPerdido}
          onChange={(e) => setPeriodoPerdido(Number(e.target.value))}
          className="rounded border border-gray-300 px-2 py-1 outline-none focus:border-brand-500"
        >
          <option value={30}>últimos 30 dias</option>
          <option value={90}>últimos 90 dias</option>
          <option value={0}>todos</option>
        </select>
      </div>

      <DndContext
        sensors={sensors}
        onDragEnd={onDragEnd}
        accessibility={{ announcements: anuncios, screenReaderInstructions: INSTRUCOES_KANBAN }}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUNAS.map((col) => {
            let itens = porEtapa.get(col) ?? [];
            if (col === EtapaLead.PERDIDO && periodoPerdido > 0) {
              const limite = agora - periodoPerdido * 86400000;
              itens = itens.filter((l) => new Date(l.ultimaAcaoEm).getTime() >= limite);
            }
            return <Coluna key={col} etapa={col} leads={itens} agora={agora} bloqueado={acaoMover.ocupado} aoMover={moverPara} />;
          })}
        </div>
      </DndContext>

      {perda && (
        <Modal titulo={<>Marcar perdido — {perda.nome}</>} aoFechar={fecharPerda} bloquearFechamento={acaoPerda.ocupado}>
          <select
            aria-label="Motivo da perda"
            className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as MotivoPerda)}
          >
            {Object.values(MotivoPerda).map((m) => (
              <option key={m} value={m}>{MOTIVO_PERDA_LABEL[m]}</option>
            ))}
          </select>
          <input
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            aria-label="Observação da perda"
            placeholder="Observação (obrigatória se 'Outro')"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
          <FeedbackAcao erro={acaoPerda.erro} className="mb-3" />
          <div className="flex gap-2">
            <button onClick={confirmarPerda} disabled={acaoPerda.ocupado} className={botaoClasses({ variante: "perigo", tamanho: "lg" })}>
              Confirmar perda
            </button>
            <button type="button" onClick={fecharPerda} disabled={acaoPerda.ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
