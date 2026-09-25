"use client";
import { useRef } from "react";
import { Formulario } from "../../../planos/[propostaId]/Formularios";
import { proporCancelamentoAgendaRecuperacao, decidirCancelamentoAgendaRecuperacao } from "@/server/avaliacoes/recuperacao-agenda-cancelamento";
import { executarAcaoCliente, type DesfechoAcao } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
// O <Formulario> compartilhado guarda ocupado/erro e só entende { ok, erro }: executarAcaoCliente decide a
// mensagem de resultado incerto conforme a idempotência desta action, e o desfecho volta nesse formato.
const resposta = (d: DesfechoAcao<unknown>) => d.tipo === "ok" ? { ok: true as const } : { ok: false as const, erro: d.mensagem };
export function Propor({ reservaId, estadoConferido }: { reservaId: string; estadoConferido: string }) {
  const chave = useRef<{ entrada: string; id: string } | null>(null);
  return <Formulario titulo="Propor cancelamento pela escola" executar={async dados => {
    const d = { reservaId, estadoConferido, motivo: String(dados.get("motivo") ?? ""), evidencia: String(dados.get("evidencia") ?? "") }, entrada = JSON.stringify(d);
    if (chave.current?.entrada !== entrada) chave.current = { entrada, id: crypto.randomUUID() };
    const chaveIdempotencia = chave.current.id;
    // Chave estável por entrada; o servidor devolve a proposta já criada com a mesma chave (server/avaliacoes/recuperacao-agenda-cancelamento.ts:36-37).
    return resposta(await executarAcaoCliente(() => proporCancelamentoAgendaRecuperacao({ ...d, chaveIdempotencia }), { idempotente: true }));
  }}>
    <p>A proposta cancela as habilidades ainda não realizadas desta reserva e seus encontros previstos. As realizações e os consumos anteriores permanecem.</p>
    <label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <label className="block">Evidência da iniciativa da escola<CampoTexto name="evidencia" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
export function Decidir({ propostaId, estadoConferido, podeAprovar }: { propostaId: string; estadoConferido: string; podeAprovar: boolean }) {
  // Decisão sem chave de idempotência no contrato (server/avaliacoes/recuperacao-agenda-cancelamento.ts:62): a falha não manda reenviar.
  return <Formulario titulo="Decidir cancelamento" executar={async dados => resposta(await executarAcaoCliente(() => decidirCancelamentoAgendaRecuperacao({ propostaId, estadoConferido, aprovar: dados.get("decisao") === "aprovar", motivo: String(dados.get("motivo") ?? "") }), { idempotente: false }))}>
    <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione</option><option value="rejeitar">Rejeitar</option>{podeAprovar && <option value="aprovar">Aprovar e aplicar cancelamento</option>}</select></label>
    <label className="block">Justificativa<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
