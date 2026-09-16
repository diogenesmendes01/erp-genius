"use client";
import { useState } from "react";
import { preverAgendaRecuperacao } from "@/server/avaliacoes/recuperacao-agenda";

export function PreviaAgenda({ itemReservaId }: { itemReservaId: string }) {
  const [resposta, setResposta] = useState<Awaited<ReturnType<typeof preverAgendaRecuperacao>> | null>(null);
  const [consultando, setConsultando] = useState(false);
  return <form className="space-y-2 rounded border p-3" onChange={() => setResposta(null)} onSubmit={async e => {
    e.preventDefault(); if (consultando) return;
    const dados = new FormData(e.currentTarget), campo = (nome: string) => String(dados.get(nome) ?? "");
    setResposta(null); setConsultando(true);
    try { setResposta(await preverAgendaRecuperacao({ itemReservaId, inicioLocal: campo("inicio"), fimLocal: campo("fim"), fuso: campo("fuso") })); }
    catch { setResposta({ ok: false, erro: "Não foi possível conferir. Consulte novamente." }); }
    finally { setConsultando(false); }
  }}>
    <h4 className="font-medium">Prévia do horário da recuperação</h4>
    <p>Esta tela mostra somente a prévia. O horário continua sem agendamento confirmado.</p>
    <fieldset disabled={consultando} className="space-y-2">
      <label className="block">Início<input type="datetime-local" name="inicio" required className="block rounded border p-2" /></label>
      <label className="block">Fim<input type="datetime-local" name="fim" required className="block rounded border p-2" /></label>
      <label className="block">Fuso dos horários<input name="fuso" required defaultValue="UTC" maxLength={100} className="block rounded border p-2" /></label>
      <p>Exemplo: America/Sao_Paulo. Informe a data final correta se atravessar a meia-noite.</p>
      <button type="submit" className="rounded border px-4 py-2">{consultando ? "Conferindo…" : "Conferir horário"}</button>
    </fieldset>
    {resposta && !resposta.ok && <p role="alert">{resposta.erro}</p>}
    {resposta?.ok && resposta.dado && <div role="status" className="space-y-2">
      <p>Avaliador: {resposta.dado.professor?.nome ?? "Pendente de designação"}.</p>
      <p>Intervalo em UTC: {resposta.dado.inicio} até {resposta.dado.fim}.</p>
      {resposta.dado.pendencias.length ? <ul className="list-disc pl-5">{resposta.dado.pendencias.map(p => <li key={p}>{p}</li>)}</ul> : <p>Nenhum impedimento encontrado nesta conferência. O horário ainda não está agendado.</p>}
      {resposta.dado.conflitos.length > 0 && <ul className="list-disc pl-5">{resposta.dado.conflitos.map((c, i) => <li key={i}>Encontro conflitante: {c.inicio} até {c.fim} (UTC){c.envolveAvaliador ? "; envolve o avaliador" : "; envolve o aluno"}.</li>)}</ul>}
    </div>}
  </form>;
}
