"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirConclusaoSemGravacao } from "@/server/diario/excecao-gravacao";

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
      } catch { setErro("Não foi possível confirmar a decisão. Atualize a lista antes de tentar novamente."); }
    });
  }
  return <div className="space-y-3 border-t pt-3">
    {!diarioCorresponde && <p role="alert">O diário atual não corresponde à solicitação. É necessária nova conferência.</p>}
    <label className="block text-sm">Motivo da decisão<textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={ocupado} maxLength={2000} className="mt-1 block w-full rounded border p-2" /></label>
    <div className="flex flex-wrap gap-3"><button onClick={() => decidir(true)} disabled={ocupado || !diarioCorresponde || motivo.trim().length < 5} className="rounded bg-brand-700 px-3 py-2 text-white disabled:opacity-50">Aprovar exceção e concluir aula</button>
      <button onClick={() => decidir(false)} disabled={ocupado || motivo.trim().length < 5} className="rounded border px-3 py-2 disabled:opacity-50">Rejeitar solicitação</button></div>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
  </div>;
}
