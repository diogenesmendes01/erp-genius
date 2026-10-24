"use client";
import type { EtapaLead } from "@prisma/client";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { ETAPA_LABEL } from "@/lib/labels";
import type { DestinoArraste } from "@/server/crm/etapas";
import { opcoesEtapa, segmentosEtapa } from "./etapas-painel";

export function BarraEtapas({ etapa, podeMover, ocupado, aoEscolher }: {
  etapa: EtapaLead; podeMover: boolean; ocupado: boolean;
  aoEscolher(etapa: EtapaLead, destino: DestinoArraste): void;
}) {
  const opcoes = opcoesEtapa(etapa);
  return <div className="min-w-0 space-y-2">
    <div role="group" aria-label="Etapas da oportunidade" className="flex min-w-0 gap-[3px]">
      {segmentosEtapa(etapa).map(s => {
        const destino = opcoes.find(o => o.etapa === s.etapa)!.destino;
        return <Botao key={s.etapa} variante="fantasma" tamanho="md" className="min-h-11 min-w-0 flex-1 px-0 py-0" disabled={!podeMover || ocupado}
          aria-label={"Etapa " + ETAPA_LABEL[s.etapa]} aria-current={s.estado === "atual" ? "step" : undefined}
          title={destino.tipo === "recusar" ? destino.motivo : ETAPA_LABEL[s.etapa]} onClick={() => aoEscolher(s.etapa, destino)}>
          <span aria-hidden className={"h-1 w-full rounded-[2px] " + (s.tom === "perigo" ? "bg-[var(--danger-solid)]" : s.estado === "futura" || s.tom === "neutro" ? "bg-[var(--neutral-muted)]" : "bg-brand-solid")} />
        </Botao>;
      })}
    </div>
    <Campo rotulo="Etapa da oportunidade">{ligacao => <select {...ligacao} name="etapaOportunidade" value={etapa} disabled={!podeMover || ocupado}
      onChange={e => { const opcao = opcoes.find(o => o.etapa === e.target.value); if (opcao) aoEscolher(opcao.etapa, opcao.destino); }}
      className="h-[34px] min-h-11 w-full min-w-0 rounded-md border border-gray-300 bg-surface px-2 text-[13px] min-[700px]:min-h-[34px]">
      {opcoes.map(o => <option key={o.etapa} value={o.etapa} disabled={o.destino.tipo === "recusar"} title={o.destino.tipo === "recusar" ? o.destino.motivo : undefined}>{o.rotulo}</option>)}
    </select>}</Campo>
  </div>;
}