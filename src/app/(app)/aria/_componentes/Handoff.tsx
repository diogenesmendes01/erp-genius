"use client";

import { useState } from "react";
import { Campo } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { ETAPA_LABEL } from "@/lib/labels";
import { ETAPAS_ARIA, type ConfigAria } from "@/server/aria/config-schema";
import { CONTROLE, Interruptor, emLinhas } from "./Campos";
import { Salvar } from "./Salvar";

type Props = { config: ConfigAria; baseVersaoId: string | null; podeEditar: boolean };
type Gatilhos = ConfigAria["handoff"]["gatilhos"];

const GATILHOS: { chave: keyof Gatilhos; rotulo: string; descricao: string }[] = [
  { chave: "pedidoHumano", rotulo: "Pediu para falar com uma pessoa", descricao: "O contato pede atendente, humano ou responsável." },
  { chave: "confiancaBaixa", rotulo: "Confiança baixa", descricao: "A confiança fica abaixo do limite de transferência." },
  { chave: "palavrasChave", rotulo: "Palavras-chave", descricao: "A mensagem cita uma das palavras da lista abaixo." },
  { chave: "humor", rotulo: "Contato irritado", descricao: "O tom da conversa indica insatisfação." },
  { chave: "etapa", rotulo: "Chegou a uma etapa", descricao: "A oportunidade chega à etapa escolhida." },
  { chave: "valor", rotulo: "Valor alto", descricao: "O valor da oportunidade passa do limite escolhido." },
  { chave: "foraPolitica", rotulo: "Fora da política", descricao: "O pedido passa dos limites comerciais." },
  { chave: "semAvanco", rotulo: "Conversa sem avanço", descricao: "Muitas trocas sem a oportunidade avançar." },
];
const DESTINOS: { valor: ConfigAria["handoff"]["destino"]; rotulo: string }[] = [
  { valor: "RESPONSAVEL", rotulo: "Responsável pela oportunidade" },
  { valor: "FILA_SETOR", rotulo: "Fila do setor" },
  { valor: "USUARIO", rotulo: "Uma pessoa específica" },
];

export function Handoff({ config, baseVersaoId, podeEditar }: Props) {
  const [c, setC] = useState<ConfigAria>(config);
  const h = c.handoff;
  const alterado = JSON.stringify(c) !== JSON.stringify(config);
  const setH = (parte: Partial<ConfigAria["handoff"]>) => setC((x) => ({ ...x, handoff: { ...x.handoff, ...parte } }));
  const ro = !podeEditar;

  return (
    <section aria-labelledby="titulo-handoff" className="space-y-6">
      <div>
        <h2 id="titulo-handoff" className="text-lg font-semibold text-gray-900">Quando passar para uma pessoa</h2>
        <p className="mt-1 text-sm text-gray-600">Basta um gatilho para a Aria transferir a conversa.</p>
        <div className="mt-2 divide-y divide-border-soft">
          {GATILHOS.map((g) => (
            <Interruptor key={g.chave} rotulo={g.rotulo} descricao={g.descricao} ligado={h.gatilhos[g.chave]} desabilitado={ro} aoMudar={(v) => setH({ gatilhos: { ...h.gatilhos, [g.chave]: v } })} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo rotulo="Palavras-chave" dica="Uma por linha.">
          {(campo) => <CampoTexto {...campo} className={CONTROLE} rows={5} value={h.palavrasChave.join("\n")} readOnly={ro} onChange={(e) => setH({ palavrasChave: emLinhas(e.target.value).slice(0, 50) })} />}
        </Campo>
        <div className="grid grid-cols-1 gap-4">
          <Campo rotulo="Etapa que dispara a transferência">
            {(campo) => (
              <select {...campo} className={CONTROLE} disabled={ro} value={h.etapaGatilho ?? ""} onChange={(e) => setH({ etapaGatilho: (e.target.value || undefined) as ConfigAria["handoff"]["etapaGatilho"] })}>
                <option value="">Nenhuma</option>
                {ETAPAS_ARIA.map((e) => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo="Valor da oportunidade a partir do qual transfere">
            {(campo) => <input {...campo} type="number" min={0} className={CONTROLE} readOnly={ro} value={h.valorGatilho ?? ""} onChange={(e) => setH({ valorGatilho: e.target.value === "" ? undefined : Number(e.target.value) })} />}
          </Campo>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo rotulo="Para quem transferir">
          {(campo) => (
            <select {...campo} className={CONTROLE} disabled={ro} value={h.destino} onChange={(e) => setH({ destino: e.target.value as ConfigAria["handoff"]["destino"] })}>
              {DESTINOS.filter((d) => d.valor !== "USUARIO" || h.destino === "USUARIO").map((d) => <option key={d.valor} value={d.valor}>{d.rotulo}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Fora do horário comercial">
          {(campo) => (
            <select {...campo} className={CONTROLE} disabled={ro} value={h.foraHorario} onChange={(e) => setH({ foraHorario: e.target.value as ConfigAria["handoff"]["foraHorario"] })}>
              <option value="AVISAR_E_AGUARDAR">Avisar o contato e aguardar</option>
              <option value="CONTINUAR">Continuar atendendo</option>
            </select>
          )}
        </Campo>
      </div>

      <Campo rotulo="Mensagem para o contato" dica="Use {nome} e {responsavel}.">
        {(campo) => <CampoTexto {...campo} className={CONTROLE} rows={3} maxLength={500} value={h.mensagem} readOnly={ro} onChange={(e) => setH({ mensagem: e.target.value })} />}
      </Campo>

      {podeEditar && <Salvar montar={() => c} baseVersaoId={baseVersaoId} alterado={alterado} />}
    </section>
  );
}
