"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reconferirPendenciaAvisoAgenda } from "@/server/comunicacoes-agenda/reconferencia";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";

export function ReconferirPendencia({ pendenciaId }: { pendenciaId: string }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  // Sem chave de idempotência: na falha de transporte, conferir antes de repetir (MSG_RESULTADO_INCERTO_SEM_CHAVE).
  const acao = useAcaoCliente({ idempotente: false });
  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    // A explicação do servidor é o resultado da reconferência (resolvida ou não): sai como status.
    const d = await acao.executar(() => reconferirPendenciaAvisoAgenda({ pendenciaId, motivo }), (dado) => dado?.explicacao ?? null);
    if (d?.tipo !== "ok") return;
    if (!d.dado) { acao.setErro("Não foi possível reconferir a pendência."); return; }
    if (d.dado.resolvida) router.refresh();
  }
  return <form className="mt-3 space-y-2" onSubmit={enviar}>
    <label className="block text-sm">Motivo da reconferência<CampoTexto className="mt-1 block w-full rounded border p-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={5} maxLength={2000} required disabled={acao.ocupado} /></label>
    <button className={botaoClasses({ variante: "secundario", tamanho: "sm" })} disabled={acao.ocupado}>{acao.ocupado ? "Reconferindo…" : "Reconferir condição"}</button>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="text-sm" />
  </form>;
}
