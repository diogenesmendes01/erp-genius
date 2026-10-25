"use client";
import Link from "next/link";
import { InterruptorAria } from "./InterruptorAria";
import { IconSparkles } from "@tabler/icons-react";
import { botaoClasses } from "@/components/Botao";
import type { SituacaoAriaInbox } from "@/server/inbox/contagens";

type PropsFaixaAriaAtiva = {
  situacao: SituacaoAriaInbox;
  aoMudar?: () => void;
  contagens: { ia: number; aprovacao: number; handoff: number };
};

export function FaixaAriaAtiva({ situacao, contagens, aoMudar }: PropsFaixaAriaAtiva) {
  if (situacao.estado === "DESLIGADA") return null;

  const ensaio = situacao.estado === "SHADOW";
  const pausada = !ensaio && situacao.pausada;
  const titulo = ensaio ? "Aria em ensaio" : pausada ? "Aria pausada" : "Aria ativa";

  return (
    <div role="region" aria-label="Situação da Aria" className="mx-[18px] mb-3 flex flex-col gap-2 rounded-[10px] bg-ai-50 p-3">
      <div className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai-solid text-white" aria-hidden="true">
        <IconSparkles size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p role="status" className="text-[13px] font-semibold text-ai-700">{titulo}</p>
        <p className="text-xs text-gray-600">
          {ensaio ? "Simula respostas sem falar com os contatos" : pausada ? "Pausada · novas conversas vão para a equipe" : <><span className="font-mono tabular-nums">{contagens.ia}</span> em atendimento · <span className="font-mono tabular-nums">{contagens.aprovacao + contagens.handoff}</span> aguardando você</>}
        </p>
      </div>
      </div>
      {situacao.podeGerenciar && <div role="group" aria-label="Ações da Aria" className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        <InterruptorAria key={`${situacao.estado}:${situacao.pausada}`} pausada={situacao.pausada} aoMudar={aoMudar} />
        <Link href="/aria" prefetch={false} className={botaoClasses({ variante: "iaFantasma", tamanho: "sm" }) + " shrink-0"}>Gerenciar</Link>
      </div>}
    </div>
  );
}
