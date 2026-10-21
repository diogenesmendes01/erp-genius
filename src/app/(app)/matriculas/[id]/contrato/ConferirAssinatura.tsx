"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarConferenciaAssinatura } from "@/server/contratos/assinatura-conferencia";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";

export function ConferirAssinatura({ matriculaId, artefatoId, revisaoHash }: { matriculaId: string; artefatoId: string; revisaoHash: string }) {
  const router = useRouter();
  const [chave] = useState(() => crypto.randomUUID());
  // Chave fixa pela vida do formulário e o servidor devolve a conferência existente quando ela se repete
  // com a mesma entrada (server/contratos/assinatura-conferencia.ts:36-39): reenviar sem alterar é seguro.
  const acao = useAcaoCliente({ idempotente: true });
  const pendente = acao.ocupado;
  return <form className="space-y-3 rounded border p-4" onSubmit={async (e) => {
    e.preventDefault(); const dados = new FormData(e.currentTarget); acao.limpar();
    if (dados.get("conferido") !== "on") { acao.setErro("Confirme os dados revisados."); return; }
    const d = await acao.executar(() => registrarConferenciaAssinatura({ matriculaId, artefatoId, revisaoHash, dadosConferidos: true, motivo: String(dados.get("motivo") ?? ""), chaveIdempotencia: chave }), "Conferência registrada. O documento ainda não foi enviado para assinatura.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <label className="block"><input name="conferido" type="checkbox" required disabled={pendente} /> Conferi o original, os participantes e as condições de reserva e pagamento apresentadas.</label>
    <label className="block">Motivo<CampoTexto className="block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={pendente} /></label>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente}>{pendente ? "Registrando…" : "Registrar conferência para assinatura"}</button>
  </form>;
}
