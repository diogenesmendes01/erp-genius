"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarConferenciaAssinaturaAditivo } from "@/server/contratos/aditivo-assinatura";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
export function AssinaturaFormulario({ matriculaId, propostaId, artefatoId, revisaoHash }: { matriculaId: string; propostaId: string; artefatoId: string; revisaoHash: string }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  const tentativa = useRef<{ dados: string; chave: string } | null>(null);
  return <form className="space-y-3 rounded border p-4" onSubmit={e => {
    e.preventDefault(); const motivo = String(new FormData(e.currentTarget).get("motivo") ?? "").trim();
    const dados = { matriculaId, propostaId, artefatoId, revisaoHash, motivo, dadosConferidos: true as const }, conteudo = JSON.stringify(dados);
    if (!tentativa.current || tentativa.current.dados !== conteudo) tentativa.current = { dados: conteudo, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave; setMensagem("");
    iniciar(async () => { try {
      const r = await registrarConferenciaAssinaturaAditivo({ ...dados, chaveIdempotencia });
      if (!r.ok) { setMensagem(r.erro); return; } setMensagem("Conferência do original registrada."); router.refresh();
    } catch { setMensagem(MSG_RESULTADO_INCERTO); } });
  }}>
    <h2 className="text-xl">Registrar conferência do original</h2>
    <label className="block"><input type="checkbox" required disabled={pendente} /> Abri o PDF preservado e conferi o documento, a vigência e os signatários apresentados.</label>
    <label className="block">Motivo<textarea className="mt-1 block w-full rounded border p-2" required minLength={5} maxLength={2000} name="motivo" disabled={pendente} /></label>
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente}>{pendente ? "Registrando…" : "Registrar conferência"}</button>
    <MensagemStatus texto={mensagem} />
  </form>;
}
