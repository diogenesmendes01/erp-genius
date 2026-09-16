"use client";
import { useRef } from "react";
import { Formulario } from "../../../planos/[propostaId]/Formularios";
import { proporCancelamentoAgendaRecuperacao, decidirCancelamentoAgendaRecuperacao } from "@/server/avaliacoes/recuperacao-agenda-cancelamento";
export function Propor({ reservaId, estadoConferido }: { reservaId: string; estadoConferido: string }) {
  const chave = useRef<{ entrada: string; id: string } | null>(null);
  return <Formulario titulo="Propor cancelamento pela escola" executar={async dados => {
    const d = { reservaId, estadoConferido, motivo: String(dados.get("motivo") ?? ""), evidencia: String(dados.get("evidencia") ?? "") }, entrada = JSON.stringify(d);
    if (chave.current?.entrada !== entrada) chave.current = { entrada, id: crypto.randomUUID() };
    return proporCancelamentoAgendaRecuperacao({ ...d, chaveIdempotencia: chave.current.id });
  }}>
    <p>A proposta cancela as habilidades ainda não realizadas desta reserva e seus encontros previstos. As realizações e os consumos anteriores permanecem.</p>
    <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <label className="block">Evidência da iniciativa da escola<textarea name="evidencia" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
export function Decidir({ propostaId, estadoConferido, podeAprovar }: { propostaId: string; estadoConferido: string; podeAprovar: boolean }) {
  return <Formulario titulo="Decidir cancelamento" executar={async dados => decidirCancelamentoAgendaRecuperacao({ propostaId, estadoConferido, aprovar: dados.get("decisao") === "aprovar", motivo: String(dados.get("motivo") ?? "") })}>
    <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione</option><option value="rejeitar">Rejeitar</option>{podeAprovar && <option value="aprovar">Aprovar e aplicar cancelamento</option>}</select></label>
    <label className="block">Justificativa<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
