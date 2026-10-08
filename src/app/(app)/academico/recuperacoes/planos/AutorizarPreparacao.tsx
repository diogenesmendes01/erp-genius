"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { autorizarPreparacaoEspecialLocal } from "@/server/avaliacoes/recuperacao-autorizacao-preparacao-local";
import { CampoFuso } from "@/components/CampoFuso";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";

export function AutorizarPreparacao({ alocacaoId, fusoInstitucional }: { alocacaoId: string; fusoInstitucional: string | null }) {
  const router = useRouter();
  // Chave de idempotência estável entre tentativas com a mesma entrada: na falha de transporte, reenviar é seguro.
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);

  return <form className="space-y-3 rounded border p-4" onSubmit={async evento => {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const motivo = String(dados.get("motivo") ?? "");
    const prazoLocal = String(dados.get("prazoLocal") ?? "");
    const fuso = String(dados.get("fuso") ?? "");
    const entrada = JSON.stringify({ alocacaoId, motivo, prazoLocal, fuso });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    const d = await acao.executar(() => autorizarPreparacaoEspecialLocal({ alocacaoId, motivo, prazoLocal, fuso, chaveIdempotencia }), "Preparação especial autorizada.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <h2 className="text-xl font-medium">Autorizar preparação especial</h2>
    <p>A autorização libera somente a preparação de uma proposta. Ela não aprova o plano nem executa qualquer recuperação.</p>
    <fieldset disabled={acao.ocupado} className="space-y-3">
      <label className="block" htmlFor="prazo-local">Prazo da autorização<input id="prazo-local" name="prazoLocal" type="datetime-local" step="1" required className="block rounded border p-2" /></label>
      <label className="block" htmlFor="fuso">Fuso do prazo<CampoFuso id="fuso" padrao={fusoInstitucional ?? ""} className="block rounded border p-2" /></label>
      <p>Revise o fuso antes de registrar. A data e a hora são convertidas no servidor; horários ambíguos ou inexistentes exigem correção.</p>
      <label className="block" htmlFor="motivo">Motivo da autorização<CampoTexto id="motivo" name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Autorizando…" : "Autorizar preparação"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
