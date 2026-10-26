import { IconLifebuoy } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import type { HandoffDoAtendimento } from "@/server/aria/handoff-inbox";
import type { Ref } from "react";
import { haQuanto } from "./textos-aria";
export type PropsFaixaHandoff = {
    handoff: HandoffDoAtendimento;
    agora: Date;
    aoVerResumo(): void;
    gatilhoRef?: Ref<HTMLButtonElement>;
};
export function FaixaHandoff({ handoff, agora, aoVerResumo, gatilhoRef }: PropsFaixaHandoff) {
    return <div className="mx-4 my-3 flex flex-wrap items-center gap-3 rounded-xl border border-danger bg-surface p-3">
  <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger"><IconLifebuoy size={16}/></span>
  <div className="min-w-0 flex-1"><p className="text-[13.5px] font-semibold">Aria pediu ajuda {haQuanto(handoff.pedidoEm, agora)}</p><p className="text-[12.5px] text-gray-600">{handoff.motivoTexto}</p></div>
  <Botao ref={gatilhoRef} variante="perigo" tamanho="sm" onClick={aoVerResumo}>{handoff.podeAssumir ? "Ver resumo e assumir" : "Ver resumo"}</Botao>
 </div>;
}
