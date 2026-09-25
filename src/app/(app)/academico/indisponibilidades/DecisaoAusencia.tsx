"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirIndisponibilidadeDocente } from "@/server/agenda/indisponibilidade";
import { botaoClasses } from "@/components/Botao";

export function DecisaoAusencia({ id, impactoHash }: { id: string; impactoHash: string | null }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  function decidir(aprovar: boolean) {
    iniciar(async () => {
      setErro(null);
      try {
        const r = await decidirIndisponibilidadeDocente({ indisponibilidadeId: id, aprovar, motivo, impactoHash: aprovar ? impactoHash ?? undefined : undefined });
        if (!r.ok) { setErro(r.erro); return; }
        router.refresh();
      } catch { setErro("Não foi possível confirmar a decisão. Atualize a lista antes de tentar novamente."); }
    });
  }
  return <div className="space-y-2 border-t pt-3">
    <label className="block text-sm">Motivo da decisão<textarea className="mt-1 block w-full rounded border p-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={2000} disabled={ocupado} /></label>
    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    <div className="flex gap-3"><button className={botaoClasses({ tamanho: "lg" })} disabled={ocupado || !impactoHash || motivo.trim().length < 5} onClick={() => decidir(true)}>Aprovar indisponibilidade</button>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado || motivo.trim().length < 5} onClick={() => decidir(false)}>Rejeitar</button></div>
  </div>;
}
