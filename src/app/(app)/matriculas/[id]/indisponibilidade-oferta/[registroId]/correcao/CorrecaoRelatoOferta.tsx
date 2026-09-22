"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirCorrecaoRelatoIndisponibilidadeOferta, proporCorrecaoRelatoIndisponibilidadeOferta } from "@/server/matricula/indisponibilidade-oferta-correcao";

/** Datas civis: o navegador não reinterpreta fuso. Relato aberto não recebe fim por aqui (término, Q156). */
export function ProporCorrecaoRelato({ registroId, inicio, fim }: { registroId: string; inicio: string; fim: string | null }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  const [chave] = useState(() => crypto.randomUUID());
  return <form className="space-y-3 rounded border p-4" onSubmit={(e) => {
    e.preventDefault(); const dados = new FormData(e.currentTarget); setMensagem("");
    iniciar(async () => {
      const r = await proporCorrecaoRelatoIndisponibilidadeOferta({ registroId, inicio: String(dados.get("inicio") ?? ""), fim: fim === null ? null : String(dados.get("fim") ?? ""),
        motivo: String(dados.get("motivo") ?? ""), evidenciaTexto: String(dados.get("evidencia") ?? ""), chaveIdempotencia: chave });
      if (!r.ok) setMensagem(r.erro); else { setMensagem("Correção proposta. O relato só muda depois da aprovação de outra pessoa."); router.refresh(); }
    });
  }}>
    <h2 className="text-xl">Propor correção do período</h2>
    <label className="block">Início correto<input className="mt-1 block rounded border p-2" type="date" name="inicio" defaultValue={inicio} required disabled={pendente} /></label>
    {fim === null ? <p>Relato em aberto: o último dia é registrado pelo término da indisponibilidade, não pela correção.</p>
      : <label className="block">Fim correto<input className="mt-1 block rounded border p-2" type="date" name="fim" defaultValue={fim} required disabled={pendente} /></label>}
    <label className="block">Motivo<textarea className="block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={pendente} /></label>
    <label className="block">Evidência<textarea className="block w-full rounded border p-2" name="evidencia" minLength={5} maxLength={4000} required disabled={pendente} /></label>
    {mensagem && <p role="status">{mensagem}</p>}
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Registrando…" : "Propor correção"}</button>
  </form>;
}

export function DecidirCorrecaoRelato({ propostaId }: { propostaId: string }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  const decidir = (aprovada: boolean, formulario: HTMLFormElement | null) => {
    if (!formulario || !formulario.reportValidity()) return;
    const dados = new FormData(formulario); setMensagem("");
    iniciar(async () => {
      const r = await decidirCorrecaoRelatoIndisponibilidadeOferta({ propostaId, aprovada, motivo: String(dados.get("motivo") ?? ""), evidenciaTexto: String(dados.get("evidencia") ?? "") });
      if (!r.ok) setMensagem(r.erro); else { setMensagem(aprovada ? "Correção aprovada: o relato passou a refletir o novo período." : "Correção rejeitada; o relato permanece como estava."); router.refresh(); }
    });
  };
  return <form className="space-y-3 rounded border p-4" onSubmit={(e) => e.preventDefault()}>
    <h2 className="text-xl">Decidir correção pendente</h2>
    <p>Confira a oferta no período corrigido. Aprovar altera o período do relato e os cálculos que dele dependem; não altera cobranças por si só.</p>
    <label className="block">Motivo da decisão<textarea className="block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={pendente} /></label>
    <label className="block">Evidência conferida<textarea className="block w-full rounded border p-2" name="evidencia" minLength={5} maxLength={4000} required disabled={pendente} /></label>
    {mensagem && <p role="status">{mensagem}</p>}
    <div className="flex gap-3"><button type="button" className="rounded border px-4 py-2" disabled={pendente} onClick={(e) => decidir(true, e.currentTarget.form)}>Aprovar correção</button>
      <button type="button" className="rounded border px-4 py-2" disabled={pendente} onClick={(e) => decidir(false, e.currentTarget.form)}>Rejeitar correção</button></div>
  </form>;
}
