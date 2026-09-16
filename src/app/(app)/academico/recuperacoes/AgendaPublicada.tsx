"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgendaRecuperacaoConsulta } from "@/server/avaliacoes/recuperacao-agenda-consulta-tx";

export function AgendaPublicada({ agenda }: { agenda: AgendaRecuperacaoConsulta | null }) {
  const router = useRouter();
  const [fuso, setFuso] = useState(agenda?.fusoOrigem ?? "UTC"), id = useId();
  if (!agenda) return <p>Sem horário publicado para esta tentativa.</p>;
  let intervalo: { inicio: string; fim: string } | null = null;
  try {
    if (fuso.trim()) {
      const formato = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso.trim(), dateStyle: "short", timeStyle: "short", hourCycle: "h23" });
      intervalo = { inicio: formato.format(new Date(agenda.inicio)), fim: formato.format(new Date(agenda.fim)) };
    }
  } catch { /* A preferência inválida não altera os horários registrados. */ }
  return <div className="space-y-2 rounded border p-3">
    <h3 className="font-medium">Horário publicado da recuperação</h3>
    <p>{agenda.status === "CANCELADO" ? "Encontro cancelado" : agenda.status === "MINISTRADO" ? "Realização registrada" : "Encontro previsto"}. Avaliador: {agenda.avaliador}.</p>
    <label className="block" htmlFor={id}>Exibir no fuso</label>
    <input id={id} list={`${id}-fusos`} value={fuso} onChange={e => setFuso(e.target.value)} maxLength={100} className="block rounded border p-2" />
    <datalist id={`${id}-fusos`}>{[...new Set([agenda.fusoOrigem, "America/Sao_Paulo", "America/Costa_Rica", "UTC"])].map(f => <option key={f} value={f} />)}</datalist>
    {intervalo ? <p><time dateTime={agenda.inicio}>{intervalo.inicio}</time> até <time dateTime={agenda.fim}>{intervalo.fim}</time> — {fuso.trim()}.</p> : <p role="alert">Informe um fuso válido, como America/Sao_Paulo ou America/Costa_Rica.</p>}
    <p>Fuso de origem: {agenda.fusoOrigem}. A escolha acima muda apenas a exibição.</p>
    {agenda.excecaoDiaNaoLetivo && <p>Este encontro tem exceção aprovada para dia não letivo.</p>}
    <button type="button" className="rounded border px-3 py-2" onClick={() => router.refresh()}>Atualizar situação</button>
  </div>;
}
