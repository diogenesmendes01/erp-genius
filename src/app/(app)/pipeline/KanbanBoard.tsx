"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { EtapaLead, Temperatura, MotivoPerda } from "@prisma/client";
import { ETAPA_LABEL, TEMPERATURA_CLS, TEMPERATURA_LABEL, MOTIVO_PERDA_LABEL } from "@/lib/labels";
import { ETAPAS_MANUAIS } from "@/server/comercial/schema";
import { moverEtapa, marcarPerdido } from "@/server/comercial/acoes";

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

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function minutosDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

const COLUNAS: EtapaLead[] = [...ETAPAS_MANUAIS, EtapaLead.MATRICULADO, EtapaLead.PERDIDO];

function Card({ lead }: { lead: KanbanLead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { etapa: lead.etapa },
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
        <span>{diasDesde(lead.etapaDesde)}d nesta etapa</span>
        <span>· últ. ação {diasDesde(lead.ultimaAcaoEm)}d</span>
        {lead.etapa === EtapaLead.NOVO && minutosDesde(lead.etapaDesde) > 60 && (
          <span className="rounded bg-red-100 px-1 font-medium text-red-600">🚨 SLA</span>
        )}
      </div>
      {lead.proximaAcao && <div className="mt-1 text-xs text-gray-500">Próxima: {lead.proximaAcao}</div>}
      {/* alça de arraste */}
      <button
        {...attributes}
        {...listeners}
        className="mt-2 w-full cursor-grab rounded border border-dashed border-gray-200 py-0.5 text-[10px] text-gray-400 hover:bg-gray-50 active:cursor-grabbing"
      >
        ⠿ arrastar
      </button>
    </div>
  );
}

function Coluna({ etapa, leads }: { etapa: EtapaLead; leads: KanbanLead[] }) {
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
          <Card key={l.id} lead={l} />
        ))}
        {leads.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-xs text-gray-300">vazio</div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ leads }: { leads: KanbanLead[] }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"pf" | "b2b">("pf");
  const [erro, setErro] = useState<string | null>(null);
  const [perda, setPerda] = useState<KanbanLead | null>(null);
  const [motivo, setMotivo] = useState<MotivoPerda>(MotivoPerda.NAO_RESPONDEU);
  const [obs, setObs] = useState("");
  const [periodoPerdido, setPeriodoPerdido] = useState(30); // dias; 0 = todos

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const visiveis = useMemo(() => leads.filter((l) => (tipo === "b2b" ? l.b2b : !l.b2b)), [leads, tipo]);
  const porEtapa = useMemo(() => {
    const m = new Map<EtapaLead, KanbanLead[]>();
    for (const c of COLUNAS) m.set(c, []);
    for (const l of visiveis) (m.get(l.etapa) ?? m.set(l.etapa, []).get(l.etapa)!).push(l);
    return m;
  }, [visiveis]);

  async function onDragEnd(e: DragEndEvent) {
    const destino = e.over?.id as EtapaLead | undefined;
    if (!destino) return;
    const lead = visiveis.find((l) => l.id === e.active.id);
    if (!lead || lead.etapa === destino) return;

    if (destino === EtapaLead.MATRICULADO) {
      router.push(`/matriculas/nova?lead=${lead.id}`);
      return;
    }
    if (destino === EtapaLead.PERDIDO) {
      setPerda(lead);
      return;
    }
    setErro(null);
    const r = await moverEtapa(lead.id, destino);
    if (!r.ok) setErro(r.erro);
    else router.refresh();
  }

  async function confirmarPerda() {
    if (!perda) return;
    setErro(null);
    const r = await marcarPerdido(perda.id, { motivoPerda: motivo, observacao: obs });
    if (!r.ok) setErro(r.erro);
    else {
      setPerda(null);
      setObs("");
      router.refresh();
    }
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
        Arraste o card pela alça "⠿ arrastar" para mover de etapa. Soltar em <strong>Matriculado</strong> abre a matrícula; em <strong>Perdido</strong> pede o motivo.
      </p>
      {erro && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
        <span>Perdidos:</span>
        <select
          value={periodoPerdido}
          onChange={(e) => setPeriodoPerdido(Number(e.target.value))}
          className="rounded border border-gray-300 px-2 py-1 outline-none focus:border-brand-500"
        >
          <option value={30}>últimos 30 dias</option>
          <option value={90}>últimos 90 dias</option>
          <option value={0}>todos</option>
        </select>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUNAS.map((col) => {
            let itens = porEtapa.get(col) ?? [];
            if (col === EtapaLead.PERDIDO && periodoPerdido > 0) {
              const limite = Date.now() - periodoPerdido * 86400000;
              itens = itens.filter((l) => new Date(l.ultimaAcaoEm).getTime() >= limite);
            }
            return <Coluna key={col} etapa={col} leads={itens} />;
          })}
        </div>
      </DndContext>

      {perda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setPerda(null)}>
          <div className="w-full max-w-md rounded-lg bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-medium">Marcar perdido — {perda.nome}</h3>
            <select
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
              placeholder="Observação (obrigatória se 'Outro')"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={confirmarPerda} className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                Confirmar perda
              </button>
              <button onClick={() => setPerda(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
