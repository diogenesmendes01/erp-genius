"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarRascunhoReplanejamento } from "@/server/agenda/replanejamento-rascunho";
import type { AjusteReplanejamento } from "@/server/agenda/replanejamento-ajustes";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";

export function SalvarRevisao({ calendarioId, estadoHash, versaoAnterior, ajustes }: { calendarioId: string; estadoHash: string; versaoAnterior: number; ajustes?: AjusteReplanejamento[] }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const tentativa = useRef<{ assinatura: string; chave: string } | null>(null);
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = { calendarioId, estadoHash, versaoAnterior, motivo, ajustes }, assinatura = JSON.stringify(dados);
    if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    iniciar(async () => {
      setErro("");
      try {
        const r = await registrarRascunhoReplanejamento({ ...dados, chaveIdempotencia });
        if (!r.ok || !r.dado) { setErro(r.ok ? "Registro não confirmado." : r.erro); return; }
        router.push(`/academico/calendario/${encodeURIComponent(calendarioId)}/revisoes`);
      } catch { setErro(MSG_RESULTADO_INCERTO); }
    });
  }
  return <form onSubmit={enviar} className="space-y-3 rounded border p-4">
    <h2 className="font-medium">Guardar esta revisão</h2>
    <p>O registro conserva as datas e pendências mostradas nesta consulta. A agenda permanece como está até a aprovação e aplicação do conjunto.</p>
    <fieldset disabled={ocupado} className="space-y-3">
      <label className="block">Motivo do registro<textarea required minLength={5} maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 block w-full rounded border bg-[var(--surface)] p-2" /></label>
      <button disabled={motivo.trim().length < 5} className={botaoClasses({ tamanho: "lg" })}>{ocupado ? "Registrando…" : "Guardar revisão"}</button>
    </fieldset>
    {erro && <div role="alert"><p>{erro}</p><button type="button" disabled={ocupado} onClick={() => router.refresh()} className={botaoClasses({ variante: "fantasma", tamanho: "sm" })}>Consultar novamente a agenda</button></div>}
  </form>;
}
