"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { IconDotsVertical, IconGripVertical } from "@tabler/icons-react";
import { Botao, botaoClasses } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { Chip } from "@/components/Chip";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Menu } from "@/components/Menu";
import { Modal } from "@/components/Modal";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { STATUS_MENSAGEM_AGENDADA_LABEL, TIPO_TAREFA_LABEL } from "@/lib/labels";
import { instanteDaGrade } from "@/server/agenda/grade";
import { reagendarMensagem, reagendarTarefa } from "@/server/crm/tarefas-acoes";
import type { ItemAgenda } from "@/server/crm/mensagens-agendadas";
import {
  chaveItem, dataCivilDoItem, deslocarData, diasDaSemana, horaNoFuso, hrefTarefas, instanteDoItem, rotuloDia, rotuloDiaCurto, textoHora,
  type ParamsTarefas,
} from "./visao";

/** Passo do arraste: 30 minutos. Das 06:00 às 21:30. */
export const HORAS_DA_GRADE: string[] = Array.from({ length: 32 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

/** Slot de 30 min que contém a hora (HH:MM), preso aos limites da grade. */
export function slotDaHora(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const minutos = Math.min(Math.max(h * 60 + (m >= 30 ? 30 : 0), 6 * 60), 21 * 60 + 30);
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${minutos % 60 ? "30" : "00"}`;
}

/** `v` distingue a árvore do celular da da grade: o dnd-kit indexa por id, então ids repetidos se anulariam. */
const idSlot = (data: string, hora: string, v: string) => `slot|${data}|${hora}|${v}`;
export function lerSlot(alvo: unknown): { data: string; hora: string | null } | null {
  if (typeof alvo !== "string" || !alvo.startsWith("slot|")) return null;
  const partes = alvo.split("|");
  return partes[1] ? { data: partes[1], hora: partes[2] || null } : null;
}

type Props = {
  visao: "dia" | "semana";
  data: string;
  hoje: string;
  itens: ItemAgenda[];
  fusoEscola: string;
  fusoExibicao: string;
  params: ParamsTarefas;
};

export function AgendaTarefas({ visao, data, hoje, itens, fusoEscola, fusoExibicao, params }: Props) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  const [reagendando, setReagendando] = useState<ItemAgenda | null>(null);
  const [diaEscolhido, setDiaMovel] = useState(data);
  const dias = visao === "semana" ? diasDaSemana(data) : [data];
  // Derivado: ao navegar para outra semana o componente segue montado, e o dia antigo não pertence mais à semana.
  const diaMovel = dias.includes(diaEscolhido) ? diaEscolhido : dias.includes(hoje) ? hoje : dias[0];
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const porDia = useMemo(() => {
    const m = new Map<string, ItemAgenda[]>();
    for (const i of itens) {
      const d = dataCivilDoItem(i, fusoEscola);
      if (d) m.set(d, [...(m.get(d) ?? []), i]);
    }
    return m;
  }, [itens, fusoEscola]);

  async function aoSoltar(e: DragEndEvent) {
    const destino = lerSlot(e.over?.id);
    const idItem = String(e.active.id).split("|")[0];
    const item = itens.find((i) => i.tipo === "tarefa" && chaveItem(i) === idItem);
    if (!destino || !item || item.tipo !== "tarefa") return;
    const t = item.tarefa;
    const d = await acao.executar(() => reagendarTarefa(t.id, t.versao, { dataCivil: destino.data, hora: destino.hora }), "Tarefa reagendada.");
    if (d?.tipo === "ok") router.refresh();
  }

  const coluna = (d: string, rotulos: boolean, v: string) => (
    <ColunaDia key={d} data={d} hoje={hoje} itens={porDia.get(d) ?? []} fusoEscola={fusoEscola} fusoExibicao={fusoExibicao} rotulos={rotulos} v={v} params={params} aoReagendar={setReagendando} />
  );

  return (
    <div className="space-y-3">
      <nav aria-label="Período" className="flex flex-wrap items-center gap-2">
        <Link href={hrefTarefas({ ...params, data: deslocarData(visao, data, -1) })} className={botaoClasses({ variante: "secundario", tamanho: "md" })}>Anterior</Link>
        <Link href={hrefTarefas({ ...params, data: hoje })} className={botaoClasses({ variante: "secundario", tamanho: "md" })}>Hoje</Link>
        <Link href={hrefTarefas({ ...params, data: deslocarData(visao, data, 1) })} className={botaoClasses({ variante: "secundario", tamanho: "md" })}>Próximo</Link>
        <h2 className="text-sm font-medium text-gray-800">{visao === "dia" ? rotuloDia(data) : `${rotuloDiaCurto(dias[0])} a ${rotuloDiaCurto(dias[6])}`}</h2>
      </nav>
      {fusoExibicao !== fusoEscola && <p className="text-xs text-gray-600">As linhas seguem o horário da escola; as horas dos itens aparecem no seu fuso.</p>}
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
      <DndContext sensors={sensores} onDragEnd={aoSoltar}>
        {visao === "dia" ? (
          coluna(data, true, "d")
        ) : (
          <>
            <div className="sm:hidden">
              <div role="group" aria-label="Dia exibido" className="mb-2 flex gap-2 overflow-x-auto">
                {dias.map((d) => (
                  <Chip key={d} selecionado={d === diaMovel} onClick={() => setDiaMovel(d)}>{rotuloDiaCurto(d)}</Chip>
                ))}
              </div>
              {coluna(diaMovel, true, "m")}
            </div>
            <div className="hidden sm:grid sm:grid-cols-7 sm:gap-2">{dias.map((d) => coluna(d, false, "g"))}</div>
          </>
        )}
      </DndContext>
      {reagendando && <ReagendarModal item={reagendando} fusoEscola={fusoEscola} aoFechar={() => setReagendando(null)} aoConcluir={() => { setReagendando(null); router.refresh(); }} />}
    </div>
  );
}

function ColunaDia({ data, hoje, itens, fusoEscola, fusoExibicao, rotulos, v, params, aoReagendar }: {
  data: string; hoje: string; itens: ItemAgenda[]; fusoEscola: string; fusoExibicao: string; rotulos: boolean; v: string; params: ParamsTarefas; aoReagendar: (i: ItemAgenda) => void;
}) {
  const porSlot = new Map<string, ItemAgenda[]>();
  const diaTodo: ItemAgenda[] = [];
  for (const i of itens) {
    const inst = instanteDoItem(i);
    if (!inst) { diaTodo.push(i); continue; }
    const slot = slotDaHora(horaNoFuso(inst, fusoEscola));
    porSlot.set(slot, [...(porSlot.get(slot) ?? []), i]);
  }
  const bloco = (i: ItemAgenda) => <BlocoItem key={chaveItem(i)} item={i} fusoEscola={fusoEscola} fusoExibicao={fusoExibicao} params={params} aoReagendar={aoReagendar} v={v} />;
  return (
    <section aria-label={rotuloDia(data)} className="min-w-0 rounded-md border border-gray-200">
      <h3 className={`border-b border-gray-200 px-2 py-1.5 text-xs font-medium ${data === hoje ? "bg-brand-bg text-brand-800" : "text-gray-700"}`}>{rotuloDiaCurto(data)}</h3>
      <Slot id={idSlot(data, "", v)} rotulo={rotulos ? "Dia todo" : null}>{diaTodo.map(bloco)}</Slot>
      {HORAS_DA_GRADE.map((h) => (
        <Slot key={h} id={idSlot(data, h, v)} rotulo={rotulos || h.endsWith(":00") ? h : null}>{(porSlot.get(h) ?? []).map(bloco)}</Slot>
      ))}
    </section>
  );
}

function Slot({ id, rotulo, children }: { id: string; rotulo: string | null; children?: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex min-h-11 items-start gap-1 border-b border-gray-200 px-1 py-0.5 last:border-b-0 ${isOver ? "bg-brand-bg" : ""}`}>
      <span className="w-10 shrink-0 text-xs text-gray-500">{rotulo}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
    </div>
  );
}

function BlocoItem({ item, fusoEscola, fusoExibicao, params, aoReagendar, v }: { v: string; item: ItemAgenda; fusoEscola: string; fusoExibicao: string; params: ParamsTarefas; aoReagendar: (i: ItemAgenda) => void }) {
  const router = useRouter();
  const ehTarefa = item.tipo === "tarefa";
  const aberta = ehTarefa && item.tarefa.status === "ABERTA";
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: `${chaveItem(item)}|${v}`, disabled: !aberta });
  const inst = instanteDoItem(item);
  const hora = inst ? textoHora(inst, fusoExibicao, fusoEscola) : null;
  const titulo = ehTarefa ? item.tarefa.titulo : `Mensagem para ${item.nomeContato}`;
  const meta = ehTarefa ? TIPO_TAREFA_LABEL[item.tarefa.tipo] : STATUS_MENSAGEM_AGENDADA_LABEL[item.status];
  const itens = [
    ...(ehTarefa ? [{ rotulo: "Abrir", aoEscolher: () => router.push(hrefTarefas({ ...params, t: item.tarefa.id })) }] : []),
    { rotulo: "Reagendar", desabilitado: ehTarefa ? !aberta : item.status !== "PENDENTE" && item.status !== "ADIADA", aoEscolher: () => aoReagendar(item) },
  ];
  return (
    <div ref={setNodeRef} data-arrastando={isDragging ? "true" : undefined} className={`flex items-center gap-1 rounded-md px-1 text-xs ${ehTarefa ? "bg-brand-bg text-brand-800" : "bg-gray-100 text-gray-700"} ${isDragging ? "opacity-60" : ""}`}>
      {aberta && (
        <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={`Arrastar tarefa ${titulo}`} className="flex h-6 w-6 shrink-0 touch-none items-center justify-center text-gray-600 max-sm:h-11 max-sm:w-11">
          <IconGripVertical aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
      <span className="min-w-0 flex-1 truncate" title={hora?.dica ?? undefined}>
        {hora && <>{hora.hora} · </>}{titulo} · {meta}
      </span>
      <Menu rotulo={`Ações de ${titulo}`} gatilho={<IconDotsVertical aria-hidden="true" className="h-4 w-4" />} itens={itens} />
    </div>
  );
}

/** Alternativa por teclado e toque ao arraste: escolher data e hora em campos. */
export function ReagendarModal({ item, fusoEscola, aoFechar, aoConcluir }: { item: ItemAgenda; fusoEscola: string; aoFechar: () => void; aoConcluir: () => void }) {
  const acao = useAcaoCliente({ idempotente: false });
  const inicioData = dataCivilDoItem(item, fusoEscola) ?? "";
  const inst = instanteDoItem(item);
  const [data, setData] = useState(inicioData);
  const [hora, setHora] = useState(inst ? horaNoFuso(inst, fusoEscola) : "");

  async function salvar() {
    const d = await acao.executar(
      async () => {
        if (item.tipo === "mensagem" && (!data || !hora)) return { ok: false as const, erro: "Informe data e hora." };
        if (item.tipo === "tarefa") return reagendarTarefa(item.tarefa.id, item.tarefa.versao, { dataCivil: data || null, hora: hora || null });
        return reagendarMensagem(item.id, instanteDaGrade(data, hora, fusoEscola).toISOString());
      },
      "Reagendado.",
    );
    if (d?.tipo === "ok") aoConcluir();
  }

  return (
    <Modal titulo="Reagendar" aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
      <div className="space-y-3">
        <Campo rotulo="Data" obrigatorio={item.tipo === "mensagem"}>{(c) => <input {...c} type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm max-sm:min-h-11" />}</Campo>
        <Campo rotulo="Hora" dica="No horário da escola." obrigatorio={item.tipo === "mensagem"}>{(c) => <input {...c} type="time" step={1800} value={hora} onChange={(e) => setHora(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm max-sm:min-h-11" />}</Campo>
        <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar} disabled={acao.ocupado}>Voltar</Botao>
          <Botao onClick={salvar} disabled={acao.ocupado}>{acao.ocupado ? "Salvando…" : "Reagendar"}</Botao>
        </div>
      </div>
    </Modal>
  );
}
