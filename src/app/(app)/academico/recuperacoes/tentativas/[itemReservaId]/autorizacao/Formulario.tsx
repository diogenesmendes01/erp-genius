"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { autorizarRecuperacaoEspecialLocal } from "@/server/avaliacoes/recuperacao-autorizacao-local";
import { CampoFuso } from "@/components/CampoFuso";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";

export function Formulario({ itemReservaId, fusoInstitucional }: { itemReservaId: string; fusoInstitucional: string | null }) {
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
    const entrada = JSON.stringify({ itemReservaId, motivo, prazoLocal, fuso });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    const d = await acao.executar(() => autorizarRecuperacaoEspecialLocal({ itemReservaId, motivo, prazoLocal, fuso, chaveIdempotencia }), "Realização especial autorizada.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <h2 className="text-xl font-medium">Autorizar realização especial</h2>
    <p>Informe a data e a hora limite para realizar esta recuperação e confira o fuso escolhido.</p>
    <fieldset disabled={acao.ocupado} className="space-y-3">
      <label className="block" htmlFor="prazo-local">Prazo para realização<input id="prazo-local" name="prazoLocal" type="datetime-local" step="1" required className="block rounded border p-2" /></label>
      <label className="block" htmlFor="fuso">Fuso do prazo<CampoFuso id="fuso" padrao={fusoInstitucional ?? ""} className="block rounded border p-2" /></label>
      <p>Revise o fuso antes de registrar. Exemplos: America/Sao_Paulo e America/Costa_Rica. Horários ambíguos ou inexistentes exigem correção.</p>
      <label className="block" htmlFor="motivo">Motivo da autorização<CampoTexto id="motivo" name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} type="submit">{acao.ocupado ? "Autorizando…" : "Autorizar realização especial"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
