"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmarAceiteOriginal } from "@/server/contratos/aceite";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";

export function ConferirAceite({ matriculaId, conclusaoId, revisaoHash }: { matriculaId: string; conclusaoId: string; revisaoHash: string }) {
  // Chave estável pela vida do formulário: na falha de transporte, reenviar confere o mesmo aceite.
  const router = useRouter(), acao = useAcaoCliente({ idempotente: true });
  const [chave] = useState(() => crypto.randomUUID());
  return <form className="space-y-3 rounded border p-4" onSubmit={async e => {
    e.preventDefault(); const d = new FormData(e.currentTarget);
    if (d.get("conferido") !== "on") { acao.limpar(); acao.setErro("Confira os documentos e as condições antes de confirmar."); return; }
    const desfecho = await acao.executar(() => confirmarAceiteOriginal({ matriculaId, conclusaoId, revisaoHash, evidenciasConferidas: true, motivo: String(d.get("motivo") ?? ""), chaveIdempotencia: chave }),
      "Aceite registrado. A ativação continua sujeita aos demais requisitos da matrícula.");
    if (desfecho?.tipo === "ok") router.refresh();
  }}>
    <label className="block"><input type="checkbox" name="conferido" required disabled={acao.ocupado} /> Conferi o original, o PDF assinado, a auditoria, todas as assinaturas exigidas e as condições desta matrícula.</label>
    <label className="block">Registro da conferência<CampoTexto name="motivo" className="block w-full rounded border p-2" required minLength={5} maxLength={2000} disabled={acao.ocupado} /></label>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={acao.ocupado}>{acao.ocupado ? "Registrando…" : "Confirmar aceite do original assinado"}</button>
  </form>;
}
