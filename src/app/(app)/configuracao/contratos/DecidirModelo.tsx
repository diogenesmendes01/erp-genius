"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { decidirModeloContratual } from "@/server/contratos/modelos";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
export function DecidirModelo({ modeloId, conteudoHash }: { modeloId: string; conteudoHash: string }) {
  const router = useRouter(), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
  return <form className="space-y-3 border-t pt-3" onSubmit={async (e) => {
    e.preventDefault(); const d = new FormData(e.currentTarget); setOcupado(true); setErro("");
    try {
      const r = await decidirModeloContratual({ modeloId, conteudoHash, aprovada: d.get("decisao") === "aprovar", motivo: String(d.get("motivo") ?? "") });
      if (!r.ok) setErro(r.erro); else router.refresh();
    } catch { setErro(MSG_DECISAO_INCERTA); }
    finally { setOcupado(false); }
  }}>
    <fieldset disabled={ocupado} className="space-y-3">
      <legend className="font-medium">Decisão da Administração</legend>
      <label className="block">Decisão<select name="decisao" required defaultValue="" className="ml-2 rounded border p-2"><option value="" disabled>Selecione</option><option value="aprovar">Aprovar e publicar esta versão</option><option value="rejeitar">Rejeitar esta versão</option></select></label>
      <label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label className="block"><input type="checkbox" required /> Conferi o conteúdo, os campos, a aplicação e as regras de assinatura desta versão.</label>
      <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar decisão"}</button>
    </fieldset>
    {erro && <p role="alert">{erro}</p>}
  </form>;
}
