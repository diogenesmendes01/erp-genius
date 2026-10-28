"use client";
import { useSyncExternalStore } from "react";
import type { EtapaLead } from "@prisma/client";
import { Botao } from "@/components/Botao";
import { Campo, CONTROLE_CAMPO } from "@/components/Campo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ETAPA_LABEL } from "@/lib/labels";
import type { DestinoArraste } from "@/server/crm/etapas";
import { opcoesEtapa, segmentosEtapa } from "./etapas-painel";

export { ETAPAS_BARRA, opcoesEtapa, segmentosEtapa } from "./etapas-painel";
export type { SegmentoEtapa } from "./etapas-painel";

function assinarNada() { return () => {}; }
function selectComFormulario() {
  return "form" in document.createElement("select") && typeof HTMLFormElement === "function";
}

export function BarraEtapas({ etapa, podeMover, ocupado, aoEscolher }: {
  etapa: EtapaLead; podeMover: boolean; ocupado: boolean;
  aoEscolher(etapa: EtapaLead, destino: DestinoArraste): void;
}) {
  const opcoes = opcoesEtapa(etapa);
  const comSelect = useSyncExternalStore(assinarNada, selectComFormulario, () => false);
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
    <Campo rotulo="Etapa da oportunidade">{ligacao => {
      const escolher = (valor: string) => { const opcao = opcoes.find(o => o.etapa === valor); if (opcao) aoEscolher(opcao.etapa, opcao.destino); };
      const rotulo = opcoes.find(o => o.etapa === etapa)?.rotulo ?? etapa;
      return <>
        <select id={comSelect ? undefined : ligacao.id} name="etapaOportunidade" value={etapa} disabled={!podeMover || ocupado} tabIndex={comSelect ? -1 : undefined} aria-hidden={comSelect || undefined} aria-required={comSelect ? undefined : ligacao["aria-required"]} aria-invalid={comSelect ? undefined : ligacao["aria-invalid"]} aria-describedby={comSelect ? undefined : ligacao["aria-describedby"]} onChange={e => escolher(e.target.value)} className={comSelect ? "sr-only" : CONTROLE_CAMPO}>
          {opcoes.map(o => <option key={o.etapa} value={o.etapa} disabled={o.destino.tipo === "recusar"} title={o.destino.tipo === "recusar" ? o.destino.motivo : undefined}>{o.rotulo}</option>)}
        </select>
        {comSelect && <Select value={etapa} onValueChange={escolher} disabled={!podeMover || ocupado}>
          <SelectTrigger id={ligacao.id} aria-required={ligacao["aria-required"]} aria-invalid={ligacao["aria-invalid"]} aria-describedby={ligacao["aria-describedby"]} className="h-[34px] min-h-11 w-full min-w-0 text-[13px] min-[700px]:min-h-[34px]">
            <SelectValue>{rotulo}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {opcoes.map(o => <SelectItem key={o.etapa} value={o.etapa} disabled={o.destino.tipo === "recusar" && o.etapa !== etapa} title={o.destino.tipo === "recusar" ? o.destino.motivo : undefined}>{o.rotulo}</SelectItem>)}
          </SelectContent>
        </Select>}
      </>;
    }}</Campo>
  </div>;
}
