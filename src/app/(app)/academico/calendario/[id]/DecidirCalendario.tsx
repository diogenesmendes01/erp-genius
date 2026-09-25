"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirCalendarioEscolar } from "@/server/agenda/calendario-decisao";
import { botaoClasses } from "@/components/Botao";

export function DecidirCalendario({ id, podePublicar }: { id: string; podePublicar: boolean }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  function decidir(aprovar: boolean) {
    iniciar(async () => {
      setErro("");
      try {
        const r = await decidirCalendarioEscolar({ calendarioId: id, aprovar, motivo });
        if (!r.ok) { setErro(r.erro); return; }
        router.refresh();
      } catch { setErro("Não foi possível confirmar a decisão. Atualize a versão antes de tentar novamente."); }
    });
  }
  return <section className="space-y-3 border-t pt-4">
    <h2 className="font-medium">Decisão do calendário</h2>
    <label className="block">Motivo da decisão<textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={2000} disabled={ocupado} className="mt-1 block w-full rounded border bg-[var(--surface)] p-2" /></label>
    <div className="flex flex-wrap gap-3"><button disabled={ocupado || !podePublicar || motivo.trim().length < 5} onClick={() => decidir(true)} className={botaoClasses({ tamanho: "lg" })}>Aprovar e publicar calendário</button>
    <button disabled={ocupado || motivo.trim().length < 5} onClick={() => decidir(false)} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Rejeitar proposta</button></div>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
  </section>;
}
