"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { conferirEEmitirEntrada } from "@/server/secretaria/conferencia-emissao";
import { botaoClasses } from "@/components/Botao";
export function ConfirmarEmissao({ matriculaId, revisaoHash }: { matriculaId: string; revisaoHash: string }) {
  const router = useRouter(), chave = useRef<string | null>(null), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  return <form className="space-y-3" onSubmit={async (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    if (f.get("cadastro") !== "on" || f.get("condicoes") !== "on") { setErro("Confirme as duas conferências antes de emitir."); return; }
    setOcupado(true); setErro("");
    try {
      chave.current ??= crypto.randomUUID();
      const r = await conferirEEmitirEntrada({ matriculaId, revisaoHash, cadastroDocumentosConferidos: true, condicoesConferidas: true, motivo: String(f.get("motivo") ?? ""), chaveIdempotencia: chave.current });
      if (!r.ok) setErro(r.erro); else router.refresh();
    } catch { setErro("Resultado não confirmado. Consulte esta página ou reenvie os mesmos dados para verificar a emissão."); }
    finally { setOcupado(false); }
  }}>
    <label className="block"><input name="cadastro" type="checkbox" required /> Conferi o cadastro, a identificação do pagador e os documentos necessários, incluindo os avisos apresentados.</label>
    <label className="block"><input name="condicoes" type="checkbox" required /> Conferi valores, cobertura e vencimentos das cobranças previstas.</label>
    <label className="block">Registro da conferência<textarea name="motivo" required minLength={5} maxLength={2000} className="block rounded border p-2" /></label>
    <button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Conferindo e emitindo…" : "Confirmar conferência e emitir cobranças"}</button>
    {erro && <p role="alert">{erro}</p>}
  </form>;
}
