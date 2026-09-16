"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reconferirPendenciaAvisoAgenda } from "@/server/comunicacoes-agenda/reconferencia";

export function ReconferirPendencia({ pendenciaId }: { pendenciaId: string }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault(); setOcupado(true); setResultado(null);
    const r = await reconferirPendenciaAvisoAgenda({ pendenciaId, motivo });
    setOcupado(false);
    if (!r.ok) return setResultado(r.erro ?? "Não foi possível reconferir a pendência.");
    if (!r.dado) return setResultado("Não foi possível reconferir a pendência.");
    setResultado(r.dado.explicacao); if (r.dado.resolvida) router.refresh();
  }
  return <form className="mt-3 space-y-2" onSubmit={enviar}>
    <label className="block text-sm">Motivo da reconferência<textarea className="mt-1 block w-full rounded border p-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={5} maxLength={2000} required disabled={ocupado} /></label>
    <button className="rounded border px-3 py-1 text-sm" disabled={ocupado}>{ocupado ? "Reconferindo…" : "Reconferir condição"}</button>
    {resultado && <p role="status" className="text-sm">{resultado}</p>}
  </form>;
}
