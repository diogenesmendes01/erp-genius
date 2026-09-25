"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirGradeInicialTurma } from "@/server/agenda/grade-decisao";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";

export function DecidirGrade({ id, podePublicar }: { id: string; podePublicar: boolean }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  function decidir(aprovar: boolean) {
    iniciar(async () => {
      setErro("");
      try {
        const r = await decidirGradeInicialTurma({ propostaId: id, aprovar, motivo });
        if (!r.ok) { setErro(r.erro); return; }
        router.refresh();
      } catch { setErro(MSG_DECISAO_INCERTA); }
    });
  }
  return <section className="space-y-3 border-t pt-4">
    <h2 className="font-medium">Decisão da grade</h2>
    <label className="block">Motivo da decisão<CampoTexto className="mt-1 block w-full rounded border bg-[var(--surface)] p-2" maxLength={2000} disabled={ocupado} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
    <div className="flex flex-wrap gap-3">
      <button className={botaoClasses({ tamanho: "lg" })} disabled={ocupado || !podePublicar || motivo.trim().length < 5} onClick={() => decidir(true)}>Aprovar e publicar encontros</button>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado || motivo.trim().length < 5} onClick={() => decidir(false)}>Rejeitar proposta</button>
    </div>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
  </section>;
}
