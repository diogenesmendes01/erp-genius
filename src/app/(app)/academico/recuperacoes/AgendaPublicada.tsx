"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgendaRecuperacaoConsulta } from "@/server/avaliacoes/recuperacao-agenda-consulta-tx";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { botaoClasses } from "@/components/Botao";

export function AgendaPublicada({ agenda, preferenciaFusoExibicao }: { agenda: AgendaRecuperacaoConsulta | null; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter();
  const [fuso, setFuso] = useState(resolverFusoExibicao(preferenciaFusoExibicao, agenda?.fusoOrigem ?? "UTC")), id = useId();
  if (!agenda) return <p>Sem horário publicado para esta tentativa.</p>;
  let intervalo: { inicio: string; fim: string } | null = null;
  try {
    if (FusoInstitucionalSchema.safeParse(fuso.trim()).success) {
      intervalo = {
        inicio: formatarInstanteExibicao(agenda.inicio, resolverFusoExibicao(fuso.trim(), agenda.fusoOrigem), agenda.fusoOrigem).texto,
        fim: formatarInstanteExibicao(agenda.fim, resolverFusoExibicao(fuso.trim(), agenda.fusoOrigem), agenda.fusoOrigem).texto,
      };
    }
  } catch { /* A preferência inválida não altera os horários registrados. */ }
  return <div className="space-y-2 rounded border p-3">
    <h3 className="font-medium">Horário publicado da recuperação</h3>
    <p>{agenda.status === "CANCELADO" ? "Encontro cancelado" : agenda.status === "MINISTRADO" ? "Realização registrada" : "Encontro previsto"}. Avaliador: {agenda.avaliador}.</p>
    <label className="block" htmlFor={id}>Exibir no fuso</label>
    <input id={id} list={`${id}-fusos`} value={fuso} onChange={e => setFuso(e.target.value)} maxLength={100} className="block rounded border p-2" />
    <datalist id={`${id}-fusos`}>{[...new Set([agenda.fusoOrigem, "America/Sao_Paulo", "America/Costa_Rica", "UTC"])].map(f => <option key={f} value={f} />)}</datalist>
    {intervalo ? <p><time dateTime={agenda.inicio}>{intervalo.inicio}</time> até <time dateTime={agenda.fim}>{intervalo.fim}</time> — {resolverFusoExibicao(fuso.trim(), agenda.fusoOrigem)}.</p> : <p role="alert">Informe um fuso válido, como America/Sao_Paulo ou America/Costa_Rica.</p>}
    <p>Fuso de origem: {agenda.fusoOrigem}. A escolha acima muda apenas a exibição.</p>
    {agenda.excecaoDiaNaoLetivo && <p>Este encontro tem exceção aprovada para dia não letivo.</p>}
    <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => router.refresh()}>Atualizar situação</button>
  </div>;
}
