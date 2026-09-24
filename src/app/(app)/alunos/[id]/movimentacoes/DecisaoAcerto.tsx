"use client";
import { useState } from "react";
import { decidirAcertoEncerramento } from "@/server/matricula/encerramento-decisao";
import { MensagemStatus } from "@/components/MensagemStatus";
export function DecisaoAcerto({ alunoId, rascunhoId }: { alunoId: string; rascunhoId: string }) {
  const [ocupado, setOcupado] = useState(false), [mensagem, setMensagem] = useState("");
  return <form onSubmit={async event => {
    event.preventDefault(); const f = new FormData(event.currentTarget); setOcupado(true); setMensagem("");
    try {
      const r = await decidirAcertoEncerramento({ alunoId, rascunhoId, aprovar: f.get("decisao") === "aprovar", motivo: String(f.get("motivo")), autorizaRetroatividade: f.has("retro"), autorizaExcecaoMulta: f.has("multa") });
      setMensagem(r.ok ? "Decisão registrada. Atualize a conferência para consultar o histórico. Encerramento ainda não efetivado." : r.erro);
    } catch { setMensagem("Consulte o histórico antes de repetir a decisão."); } finally { setOcupado(false); }
  }}><fieldset disabled={ocupado} className="grid gap-2 border p-3"><legend>Decisão financeira independente</legend>
    <label>Decisão<select name="decisao" required defaultValue=""><option value="">Selecione</option><option value="aprovar">Aprovar acerto conferido</option><option value="rejeitar">Rejeitar esta versão</option></select></label>
    <label>Motivo<textarea name="motivo" required minLength={5} maxLength={2000} /></label>
    <label><input type="checkbox" name="retro" /> Autorizo a retroatividade identificada no pedido.</label>
    <label><input type="checkbox" name="multa" /> Autorizo as exceções de multa identificadas nesta versão.</label>
    <button>Registrar decisão</button>
  </fieldset><MensagemStatus texto={mensagem} /></form>;
}
