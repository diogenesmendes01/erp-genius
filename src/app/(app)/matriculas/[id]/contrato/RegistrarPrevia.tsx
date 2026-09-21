"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarPreviaContratual } from "@/server/contratos/previas";
export function RegistrarPrevia({ matriculaId, modeloId, revisaoHash }: { matriculaId: string; modeloId: string; revisaoHash: string }) {
  const router = useRouter(), chave = useRef<string | null>(null), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  return <form className="space-y-3" onSubmit={async (e) => {
    e.preventDefault(); const d = new FormData(e.currentTarget);
    if (d.get("aplicacao") !== "on") { setErro("Confirme a aplicação do modelo antes de registrar."); return; }
    setOcupado(true); setErro(""); chave.current ??= crypto.randomUUID();
    try {
      const r = await registrarPreviaContratual({ matriculaId, modeloId, revisaoHash, aplicacaoConferida: true, motivo: String(d.get("motivo") ?? ""), chaveIdempotencia: chave.current });
      if (!r.ok) setErro(r.erro);
      else if (r.dado) { router.push(`/matriculas/${matriculaId}/contrato/previas/${r.dado.id}`); router.refresh(); }
    } catch { setErro("Resultado não confirmado. Consulte o histórico ou reenvie os mesmos dados."); }
    finally { setOcupado(false); }
  }}>
    <fieldset disabled={ocupado} className="space-y-3">
      <legend className="font-medium">Registrar o conteúdo revisado</legend>
      <label className="block"><input name="aplicacao" type="checkbox" required /> Conferi a aplicação deste modelo à matrícula e os dados preenchidos.</label>
      <label className="block">Motivo ou registro da conferência<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <button className="rounded border px-4 py-2">{ocupado ? "Registrando…" : "Preservar esta prévia"}</button>
    </fieldset>
    {erro && <p role="alert">{erro}</p>}
  </form>;
}
