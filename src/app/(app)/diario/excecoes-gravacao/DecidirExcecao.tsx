"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirConclusaoSemGravacao } from "@/server/diario/excecao-gravacao";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";

export function DecidirExcecao({ id, diarioCorresponde }: { id: string; diarioCorresponde: boolean }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  function decidir(aprovar: boolean) {
    iniciar(async () => {
      setErro("");
      try {
        const r = await decidirConclusaoSemGravacao({ excecaoId: id, aprovar, motivo });
        if (!r.ok) { setErro(r.erro); return; }
        router.refresh();
      } catch { setErro(MSG_DECISAO_INCERTA); }
    });
  }
  return <div className="space-y-3 border-t pt-3">
    {!diarioCorresponde && <p role="alert">O diário atual não corresponde à solicitação. É necessária nova conferência.</p>}
    <label className="block text-sm">Motivo da decisão<CampoTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={ocupado} maxLength={2000} className="mt-1 block w-full rounded border p-2" /></label>
    <div className="flex flex-wrap gap-3"><button onClick={() => decidir(true)} disabled={ocupado || !diarioCorresponde || motivo.trim().length < 5} className={botaoClasses({ tamanho: "lg" })}>Aprovar exceção e concluir aula</button>
      <button onClick={() => decidir(false)} disabled={ocupado || motivo.trim().length < 5} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Rejeitar solicitação</button></div>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
  </div>;
}
