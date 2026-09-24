"use client";
import { useRef } from "react";
import { proporAgendaRecuperacao } from "@/server/avaliacoes/recuperacao-agenda-proposta";
import { decidirAgendaRecuperacao } from "@/server/avaliacoes/recuperacao-agenda-decisao";
import { Formulario } from "../../../planos/[propostaId]/Formularios";
import { CampoFuso } from "@/components/CampoFuso";
import { useInicioDoPeriodo } from "@/lib/periodo-form";
import { executarAcaoCliente, type DesfechoAcao } from "@/lib/acao-cliente";

// O <Formulario> compartilhado guarda ocupado/erro e só entende { ok, erro }: executarAcaoCliente decide a
// mensagem de resultado incerto conforme a idempotência desta action, e o desfecho volta nesse formato.
const resposta = (d: DesfechoAcao<unknown>) => d.tipo === "ok" ? { ok: true as const } : { ok: false as const, erro: d.mensagem };

export function ProporAgenda({ itemReservaId, versaoEsperada, fusoInstitucional }: { itemReservaId: string; versaoEsperada: number; fusoInstitucional: string | null }) {
  const chave = useRef<{ entrada: string; id: string } | null>(null);
  const periodo = useInicioDoPeriodo();
  return <Formulario titulo="Guardar proposta de horário" executar={async dados => {
    const campo = (nome: string) => String(dados.get(nome) ?? "");
    const d = { itemReservaId, versaoEsperada, inicioLocal: campo("inicio"), fimLocal: campo("fim"), fuso: campo("fuso"), motivo: campo("motivo") };
    const entrada = JSON.stringify(d);
    if (chave.current?.entrada !== entrada) chave.current = { entrada, id: crypto.randomUUID() };
    const chaveIdempotencia = chave.current.id;
    // Chave estável por entrada; o servidor devolve a proposta já criada com a mesma chave (server/avaliacoes/recuperacao-agenda-proposta.ts:30-33).
    return resposta(await executarAcaoCliente(() => proporAgendaRecuperacao({ ...d, chaveIdempotencia }), { idempotente: true }));
  }}>
    <p>A proposta preserva os horários e a conferência para revisão. Não agenda a avaliação.</p>
    <label className="block">Início<input name="inicio" type="datetime-local" required {...periodo.propsInicio} className="block rounded border p-2" /></label>
    <label className="block">Fim<input name="fim" type="datetime-local" required min={periodo.min} className="block rounded border p-2" /></label>
    <label className="block">Fuso dos horários<CampoFuso padrao={fusoInstitucional ?? ""} className="block rounded border p-2" /></label>
    <p>Exemplo: America/Sao_Paulo. Confira também a data final ao atravessar a meia-noite.</p>
    <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}

export function DecidirAgenda({ propostaId, estadoConferido, podeAprovar }: { propostaId: string; estadoConferido: string; podeAprovar: boolean }) {
  // Decisão sem chave de idempotência no contrato (server/avaliacoes/recuperacao-agenda-decisao.ts:14): a falha não manda reenviar.
  return <Formulario titulo="Decidir proposta de horário" executar={async dados => resposta(await executarAcaoCliente(() => decidirAgendaRecuperacao({ propostaId, estadoConferido,
    aprovar: dados.get("decisao") === "aprovar", autorizarDiaNaoLetivo: dados.get("excecao") === "on", motivo: String(dados.get("motivo") ?? "") }), { idempotente: false }))}>
    <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2">
      <option value="" disabled>Selecione</option><option value="rejeitar">Rejeitar proposta</option>
      {podeAprovar && <option value="aprovar">Aprovar e publicar o horário</option>}
    </select></label>
    {podeAprovar && <label className="block"><input name="excecao" type="checkbox" /> Autorizar este encontro em dia não letivo, quando indicado na conferência</label>}
    <label className="block">Justificativa da decisão<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <p>A aprovação confere novamente os conflitos e publica o horário. Se houver exceção de calendário, justifique expressamente sua autorização.</p>
  </Formulario>;
}
