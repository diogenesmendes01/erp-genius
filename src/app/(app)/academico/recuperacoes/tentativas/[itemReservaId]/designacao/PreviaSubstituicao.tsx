"use client";
import { useState, useTransition } from "react";
import { preverSubstituicaoAvaliadorRecuperacao } from "@/server/avaliacoes/recuperacao-substituicao-previa";
import { ProporSubstituicao } from "./ProporSubstituicao";
export function PreviaSubstituicao({ itemReservaId, atualId, professores }: { itemReservaId: string; atualId: string | null; professores: { id: string; nome: string }[] }) {
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof preverSubstituicaoAvaliadorRecuperacao>> | null>(null);
  const [pendente, iniciar] = useTransition();
  return <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Conferir substituição na agenda</h2>
    <p>Esta tela confere a disponibilidade para o horário aprovado. O avaliador e a atribuição atuais permanecem em vigor.</p>
    <form onChange={() => setResultado(null)} onSubmit={e => { e.preventDefault(); const substitutoId = String(new FormData(e.currentTarget).get("substituto") ?? ""); iniciar(async () => setResultado(await preverSubstituicaoAvaliadorRecuperacao({ itemReservaId, substitutoId }))); }} className="space-y-2">
      <label className="block">Professor substituto<select name="substituto" required defaultValue="" disabled={pendente} className="block rounded border p-2"><option value="" disabled>Selecione</option>{professores.filter(p => p.id !== atualId).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <button type="submit" disabled={pendente} className="rounded border px-4 py-2">{pendente ? "Conferindo…" : "Conferir disponibilidade"}</button>
    </form>
    {resultado && (!resultado.ok ? <p role="alert">{resultado.erro}</p> : resultado.dado && <div className="space-y-2" role="status">
      <p>Avaliador atual: {resultado.dado.avaliadorAtual}. Substituto conferido: {resultado.dado.substituto}.</p>
      <p>Horário conferido: {formatar(resultado.dado.inicio, resultado.dado.fusoOrigem)} até {formatar(resultado.dado.fim, resultado.dado.fusoOrigem)} ({resultado.dado.fusoOrigem}).</p>
      <p className="text-sm">Fontes conferidas: encontro publicado, matrícula e vínculo, fontes do plano, prazo vigente, professor ativo, calendário/fuso e disponibilidade do professor e do aluno.</p>
      {resultado.dado.pendencias.length ? <ul className="list-disc pl-5">{resultado.dado.pendencias.map(p => <li key={p}>{p}</li>)}</ul> : <p>Nenhum impedimento identificado nesta conferência. A substituição ainda não foi aplicada.</p>}
      {resultado.dado.excecaoDiaNaoLetivo && <p>O encontro original possui exceção aprovada para dia não letivo.</p>}
      <ProporSubstituicao itemReservaId={itemReservaId} substitutoId={resultado.dado.substitutoId} estadoConferido={resultado.dado.estadoConferido} versaoEsperada={resultado.dado.versaoEsperada} />
    </div>)}
  </section>;
}

function formatar(valor: string, fuso: string) {
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(valor)); }
  catch { return valor.replace("T", " ").replace("Z", " UTC"); }
}
