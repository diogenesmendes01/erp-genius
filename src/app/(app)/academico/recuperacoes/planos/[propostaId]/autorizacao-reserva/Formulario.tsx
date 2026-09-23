"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autorizarReservaEspecialLocal } from "@/server/avaliacoes/recuperacao-autorizacao-reserva-local";
import { reservarTentativaRecuperacao } from "@/server/avaliacoes/recuperacao-reserva";
import type { HABILIDADES } from "@/server/avaliacoes/calculo";
import { CampoFuso } from "@/components/CampoFuso";

type Habilidade = typeof HABILIDADES[number];

function Mensagem({ mensagem }: { mensagem: string }) {
  return mensagem ? <p role="alert">{mensagem}</p> : null;
}

export function AutorizarReservaEspecial({ propostaId, habilidades, fusoInstitucional }: { propostaId: string; habilidades: string[]; fusoInstitucional: string | null }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");
  const [habilidade, setHabilidade] = useState("");
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);

  return <form className="space-y-3 rounded border p-4" onSubmit={evento => {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const motivo = String(dados.get("motivo") ?? "");
    const prazoLocal = String(dados.get("prazoLocal") ?? "");
    const fuso = String(dados.get("fuso") ?? "");
    const entrada = JSON.stringify({ propostaId, habilidade, motivo, prazoLocal, fuso });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    iniciar(async () => {
      setMensagem("");
      try {
        const resultado = await autorizarReservaEspecialLocal({ propostaId, habilidade: habilidade as Habilidade, motivo, prazoLocal, fuso, chaveIdempotencia: tentativa.current!.chave });
        if (resultado.ok) router.refresh(); else setMensagem(resultado.erro);
      } catch {
        setMensagem("Resultado não confirmado. Reenvie sem alterar os dados para conferir a mesma operação.");
      }
    });
  }}>
    <h2 className="text-xl font-medium">Autorizar pré-reserva especial</h2>
    <fieldset disabled={ocupado} className="space-y-3">
      <label className="block" htmlFor="habilidade">Habilidade<select id="habilidade" value={habilidade} onChange={evento => setHabilidade(evento.target.value)} required className="block rounded border p-2"><option value="" disabled>Selecione</option>{habilidades.map(item => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
      <label className="block" htmlFor="prazo-local">Prazo para reservar<input id="prazo-local" name="prazoLocal" type="datetime-local" step="1" required className="block rounded border p-2" /></label>
      <label className="block" htmlFor="fuso">Fuso do prazo<CampoFuso id="fuso" padrao={fusoInstitucional ?? ""} className="block rounded border p-2" /></label>
      <p>Revise o fuso antes de registrar. A data e a hora são convertidas no servidor; horários ambíguos ou inexistentes precisam de correção.</p>
      <label className="block" htmlFor="motivo">Motivo da autorização<textarea id="motivo" name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <button className="rounded border px-4 py-2" type="submit">{ocupado ? "Autorizando…" : "Autorizar pré-reserva"}</button>
    </fieldset>
    <Mensagem mensagem={mensagem} />
  </form>;
}

export function ReservarComAutorizacao({ propostaId, propostaHash, autorizacaoId, habilidade }: { propostaId: string; propostaHash: string; autorizacaoId: string; habilidade: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);

  return <form className="space-y-2 rounded border p-3" onSubmit={evento => {
    evento.preventDefault();
    const motivo = String(new FormData(evento.currentTarget).get("motivoReserva") ?? "");
    const entrada = JSON.stringify({ propostaId, propostaHash, autorizacaoId, habilidade, motivo });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    iniciar(async () => {
      setMensagem("");
      try {
        const resultado = await reservarTentativaRecuperacao({ propostaId, propostaHash, habilidades: [habilidade as Habilidade], motivo, chaveIdempotencia: tentativa.current!.chave, autorizacaoEspecialReservaId: autorizacaoId });
        if (resultado.ok) router.refresh(); else setMensagem(resultado.erro);
      } catch {
        setMensagem("Resultado não confirmado. Reenvie sem alterar os dados para conferir a mesma operação.");
      }
    });
  }}>
    <fieldset disabled={ocupado} className="space-y-2">
      <label className="block" htmlFor={`motivo-reserva-${autorizacaoId}`}>Motivo da reserva<textarea id={`motivo-reserva-${autorizacaoId}`} name="motivoReserva" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <button className="rounded border px-4 py-2" type="submit">{ocupado ? "Reservando…" : "Reservar tentativa autorizada"}</button>
    </fieldset>
    <Mensagem mensagem={mensagem} />
  </form>;
}
