import { IconSparkles } from "@tabler/icons-react";
import type { SituacaoAriaInbox } from "@/server/inbox/contagens";

type PropsFaixaAriaAtiva = {
  situacao: SituacaoAriaInbox;
  contagens: { ia: number; aprovacao: number; handoff: number };
};

export function FaixaAriaAtiva({ situacao, contagens }: PropsFaixaAriaAtiva) {
  if (situacao.estado === "DESLIGADA") return null;

  const ensaio = situacao.estado === "SHADOW";
  const pausada = !ensaio && situacao.pausada;
  const titulo = ensaio ? "Aria em ensaio" : pausada ? "Aria pausada" : "Aria ativa";

  return (
    <div aria-label="Situação da Aria" className="mx-[18px] mb-3 flex items-center gap-2.5 rounded-[10px] bg-ai-50 p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai-solid text-white" aria-hidden="true">
        <IconSparkles size={16} />
      </span>
      <div role="status" className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ai-700">{titulo}</p>
        <p className="text-xs text-gray-600">
          {ensaio ? "Simula respostas sem falar com os contatos" : pausada ? "Pausada · novas conversas vão para a equipe" : <><span className="font-mono tabular-nums">{contagens.ia}</span> em atendimento · <span className="font-mono tabular-nums">{contagens.aprovacao + contagens.handoff}</span> aguardando você</>}
        </p>
      </div>
      {situacao.podeGerenciar && <a href="/aria" className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-ai-700 transition hover:bg-highlight max-sm:min-h-11 inline-flex items-center">Gerenciar</a>}
    </div>
  );
}
