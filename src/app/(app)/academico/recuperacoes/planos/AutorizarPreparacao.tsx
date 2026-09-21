"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autorizarPreparacaoEspecialLocal } from "@/server/avaliacoes/recuperacao-autorizacao-preparacao-local";

export function AutorizarPreparacao({ alocacaoId }: { alocacaoId: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);

  return <form className="space-y-3 rounded border p-4" onSubmit={evento => {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const motivo = String(dados.get("motivo") ?? "");
    const prazoLocal = String(dados.get("prazoLocal") ?? "");
    const fuso = String(dados.get("fuso") ?? "");
    const entrada = JSON.stringify({ alocacaoId, motivo, prazoLocal, fuso });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    iniciar(async () => {
      setMensagem("");
      try {
        const resultado = await autorizarPreparacaoEspecialLocal({ alocacaoId, motivo, prazoLocal, fuso, chaveIdempotencia: tentativa.current!.chave });
        if (resultado.ok) router.refresh(); else setMensagem(resultado.erro);
      } catch {
        setMensagem("Resultado não confirmado. Reenvie sem alterar os dados para conferir a mesma operação.");
      }
    });
  }}>
    <h2 className="text-xl font-medium">Autorizar preparação especial</h2>
    <p>A autorização libera somente a preparação de uma proposta. Ela não aprova o plano nem executa qualquer recuperação.</p>
    <fieldset disabled={ocupado} className="space-y-3">
      <label className="block" htmlFor="prazo-local">Prazo da autorização<input id="prazo-local" name="prazoLocal" type="datetime-local" step="1" required className="block rounded border p-2" /></label>
      <label className="block" htmlFor="fuso">Fuso do prazo<input id="fuso" name="fuso" list="fusos-autorizacao-preparacao" defaultValue="UTC" required maxLength={100} className="block rounded border p-2" /></label>
      <datalist id="fusos-autorizacao-preparacao"><option value="America/Sao_Paulo" /><option value="America/Costa_Rica" /><option value="UTC" /></datalist>
      <p>Revise o fuso antes de registrar. A data e a hora são convertidas no servidor; horários ambíguos ou inexistentes exigem correção.</p>
      <label className="block" htmlFor="motivo">Motivo da autorização<textarea id="motivo" name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <button type="submit" className="rounded border px-4 py-2">{ocupado ? "Autorizando…" : "Autorizar preparação"}</button>
    </fieldset>
    {mensagem && <p role="alert">{mensagem}</p>}
  </form>;
}
