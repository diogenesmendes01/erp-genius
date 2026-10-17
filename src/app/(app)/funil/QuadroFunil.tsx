"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { EtapaLead } from "@prisma/client";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { executarAcaoCliente } from "@/lib/acao-cliente";
import { ETAPA_LABEL } from "@/lib/labels";
import { moverEtapa } from "@/server/comercial/acoes";
import { COLUNAS_RECOLHIDAS, destinoDoArraste } from "@/server/crm/etapas";
import type { ColunaFunil } from "@/server/crm/funil";
import { CartaoOportunidade, FUSO_PADRAO, ID_INSTRUCOES, INSTRUCOES_ARRASTE, valorComMoeda, type AcaoDoCartao } from "./CartaoOportunidade";

type Props = {
  colunas: ColunaFunil[];
  podeMover: boolean;
  aoAbrir: (id: string) => void;
  aoPedirAcao: (id: string, acao: AcaoDoCartao) => void;
  /** Instante de referência para "dias na etapa" e vencimento (testes); padrão: agora. */
  agora?: Date;
  /** Fuso institucional (ConfiguracaoOperacional.fusoInstitucional). */
  fuso?: string;
};

const ID_COLUNA = "coluna:";
const idDaColuna = (etapa: EtapaLead) => ID_COLUNA + etapa;
const etapaDoId = (id: unknown): EtapaLead | null =>
  typeof id === "string" && id.startsWith(ID_COLUNA) ? (id.slice(ID_COLUNA.length) as EtapaLead) : null;

const colisao: CollisionDetection = (args) => (args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args));

// Setas esquerda/direita levam o cartão para o centro da coluna vizinha; as demais teclas não movem.
const coordenadasPorSetas: KeyboardCoordinateGetter = (evento, { context: { droppableRects, droppableContainers, collisionRect }, currentCoordinates }) => {
  if (!collisionRect) return undefined;
  if (evento.code !== "ArrowRight" && evento.code !== "ArrowLeft") return undefined;
  evento.preventDefault();
  const colunas = droppableContainers
    .getEnabled()
    .map((c) => ({ id: c.id, rect: droppableRects.get(c.id) }))
    .filter((c) => etapaDoId(c.id) && c.rect)
    .sort((a, b) => a.rect!.left - b.rect!.left);
  const centro = collisionRect.left + collisionRect.width / 2;
  const atual = colunas.findIndex((c) => centro >= c.rect!.left && centro <= c.rect!.left + c.rect!.width);
  const alvo = colunas[atual + (evento.code === "ArrowRight" ? 1 : -1)];
  if (!alvo) return currentCoordinates;
  return { x: alvo.rect!.left + (alvo.rect!.width - collisionRect.width) / 2, y: currentCoordinates.y };
};

function ColunaView({
  coluna, recolhida, aberta, aoAlternar, children,
}: { coluna: ColunaFunil; recolhida: boolean; aberta: boolean; aoAlternar: () => void; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: idDaColuna(coluna.etapa) });
  return (
    <section
      ref={setNodeRef}
      data-coluna={coluna.etapa}
      data-recolhida={recolhida && !aberta ? "true" : "false"}
      aria-label={`${ETAPA_LABEL[coluna.etapa]}, ${coluna.total} ${coluna.total === 1 ? "oportunidade" : "oportunidades"}`}
      className={
        "flex w-full shrink-0 flex-col gap-2 rounded-lg border bg-surface-muted p-2 min-[700px]:w-72 " +
        (isOver ? "border-brand-500" : "border-border-soft")
      }
    >
      <header className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{ETAPA_LABEL[coluna.etapa]}</h3>
          <p className="text-xs text-gray-600">{coluna.total}</p>
          {coluna.somaPorMoeda.map((s) => (
            <p key={s.moeda} className="text-xs text-gray-600">{valorComMoeda(s.valor, s.moeda)}</p>
          ))}
        </div>
        {recolhida && (
          <Botao variante="fantasma" tamanho="sm" aria-expanded={aberta} onClick={aoAlternar}>
            {aberta ? "Recolher" : "Mostrar cartões"}
          </Botao>
        )}
      </header>
      {(!recolhida || aberta) && <div className="flex flex-col gap-2">{children}</div>}
    </section>
  );
}

export function QuadroFunil({ colunas, podeMover, aoAbrir, aoPedirAcao, agora, fuso = FUSO_PADRAO }: Props) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [movendo, setMovendo] = useState(false);
  const [abertas, setAbertas] = useState<ReadonlySet<EtapaLead>>(new Set());
  const [etapaMobile, setEtapaMobile] = useState<EtapaLead>(colunas[0]?.etapa ?? EtapaLead.NOVO);
  const referencia = useMemo(() => agora ?? new Date(), [agora]);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: coordenadasPorSetas }),
  );

  const nomeDo = (id: unknown) => {
    for (const c of colunas) {
      const k = c.cartoes.find((x) => x.id === id);
      if (k) return k.nome;
    }
    return "cartão";
  };
  const rotuloDe = (id: unknown) => {
    const e = etapaDoId(id);
    return e ? ETAPA_LABEL[e] : "fora das colunas";
  };

  async function aoSoltar({ active, over }: DragEndEvent) {
    const destino = etapaDoId(over?.id);
    const origem = active.data.current?.etapa as EtapaLead | undefined;
    if (!destino || !origem || movendo) return;
    const id = String(active.id);
    const d = destinoDoArraste(origem, destino);
    if (d.tipo === "nenhum") return;
    if (d.tipo === "recusar") return setErro(d.motivo);
    setErro(null);
    if (d.tipo === "acao") return aoPedirAcao(id, d.acao);
    // Sem mudança otimista: a coluna fica travada até o Resultado; só então a tela recarrega.
    setMovendo(true);
    const desfecho = await executarAcaoCliente(() => moverEtapa(id, destino), { idempotente: false });
    if (desfecho.tipo === "ok") router.refresh();
    else setErro(desfecho.mensagem);
    setMovendo(false);
  }

  const alternar = (etapa: EtapaLead) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (!n.delete(etapa)) n.add(etapa);
      return n;
    });

  return (
    <div aria-busy={movendo || undefined}>
      <FeedbackAcao erro={erro} className="mb-3" />
      <p id={ID_INSTRUCOES} className="sr-only">{INSTRUCOES_ARRASTE}</p>
      <label className="mb-3 block min-[700px]:hidden">
        <span className="sr-only">Etapa exibida</span>
        <select
          aria-label="Etapa exibida"
          value={etapaMobile}
          onChange={(e) => setEtapaMobile(e.target.value as EtapaLead)}
          className="min-h-11 w-full rounded-md border border-gray-300 bg-surface px-3 text-sm"
        >
          {colunas.map((c) => (
            <option key={c.etapa} value={c.etapa}>{`${ETAPA_LABEL[c.etapa]} (${c.total})`}</option>
          ))}
        </select>
      </label>
      <DndContext
        sensors={sensores}
        collisionDetection={colisao}
        onDragEnd={aoSoltar}
        accessibility={{
          screenReaderInstructions: { draggable: INSTRUCOES_ARRASTE },
          announcements: {
            onDragStart: ({ active }) => `Pegou o cartão de ${nomeDo(active.id)}.`,
            onDragOver: ({ active, over }) => `Cartão de ${nomeDo(active.id)} sobre a coluna ${rotuloDe(over?.id)}.`,
            onDragEnd: ({ active, over }) => `Soltou o cartão de ${nomeDo(active.id)} na coluna ${rotuloDe(over?.id)}.`,
            onDragCancel: ({ active }) => `Movimento do cartão de ${nomeDo(active.id)} cancelado.`,
          },
        }}
      >
        <div className="flex flex-col gap-3 min-[700px]:flex-row min-[700px]:items-start min-[700px]:overflow-x-auto">
          {colunas.map((coluna) => {
            const recolhida = COLUNAS_RECOLHIDAS.includes(coluna.etapa);
            return (
              <div key={coluna.etapa} className={coluna.etapa === etapaMobile ? "contents" : "hidden min-[700px]:contents"}>
                <ColunaView coluna={coluna} recolhida={recolhida} aberta={abertas.has(coluna.etapa)} aoAlternar={() => alternar(coluna.etapa)}>
                  {coluna.cartoes.map((cartao) => (
                    <CartaoOportunidade key={cartao.id} cartao={cartao} podeMover={podeMover} bloqueado={movendo} agora={referencia} fuso={fuso} aoAbrir={aoAbrir} />
                  ))}
                  {coluna.possuiMais && <p className="px-1 text-xs text-gray-600">Há mais oportunidades nesta etapa. Refine os filtros para ver todas.</p>}
                </ColunaView>
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
