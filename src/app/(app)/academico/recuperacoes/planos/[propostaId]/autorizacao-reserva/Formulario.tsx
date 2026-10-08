"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { autorizarReservaEspecialLocal } from "@/server/avaliacoes/recuperacao-autorizacao-reserva-local";
import { reservarTentativaRecuperacao } from "@/server/avaliacoes/recuperacao-reserva";
import type { HABILIDADES } from "@/server/avaliacoes/calculo";
import { CampoFuso } from "@/components/CampoFuso";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { HABILIDADE_LABEL, rotular } from "@/lib/labels";

type Habilidade = typeof HABILIDADES[number];

export function AutorizarReservaEspecial({ propostaId, habilidades, fusoInstitucional }: { propostaId: string; habilidades: string[]; fusoInstitucional: string | null }) {
  const router = useRouter();
  // Chave de idempotência estável entre tentativas com a mesma entrada: na falha de transporte, reenviar é seguro.
  const acao = useAcaoCliente({ idempotente: true });
  const [habilidade, setHabilidade] = useState("");
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);

  return <form className="space-y-3 rounded border p-4" onSubmit={async evento => {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const motivo = String(dados.get("motivo") ?? "");
    const prazoLocal = String(dados.get("prazoLocal") ?? "");
    const fuso = String(dados.get("fuso") ?? "");
    const entrada = JSON.stringify({ propostaId, habilidade, motivo, prazoLocal, fuso });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    const d = await acao.executar(() => autorizarReservaEspecialLocal({ propostaId, habilidade: habilidade as Habilidade, motivo, prazoLocal, fuso, chaveIdempotencia }), "Pré-reserva especial autorizada.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <h2 className="text-xl font-medium">Autorizar pré-reserva especial</h2>
    <fieldset disabled={acao.ocupado} className="space-y-3">
      <label className="block" htmlFor="habilidade">Habilidade<select id="habilidade" value={habilidade} onChange={evento => setHabilidade(evento.target.value)} required className="block rounded border p-2"><option value="" disabled>Selecione</option>{habilidades.map(item => <option key={item} value={item}>{rotular(HABILIDADE_LABEL, item)}</option>)}</select></label>
      <label className="block" htmlFor="prazo-local">Prazo para reservar<input id="prazo-local" name="prazoLocal" type="datetime-local" step="1" required className="block rounded border p-2" /></label>
      <label className="block" htmlFor="fuso">Fuso do prazo<CampoFuso id="fuso" padrao={fusoInstitucional ?? ""} className="block rounded border p-2" /></label>
      <p>Revise o fuso antes de registrar. A data e a hora são convertidas no servidor; horários ambíguos ou inexistentes precisam de correção.</p>
      <label className="block" htmlFor="motivo">Motivo da autorização<CampoTexto id="motivo" name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} type="submit">{acao.ocupado ? "Autorizando…" : "Autorizar pré-reserva"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}

export function ReservarComAutorizacao({ propostaId, propostaHash, autorizacaoId, habilidade }: { propostaId: string; propostaHash: string; autorizacaoId: string; habilidade: string }) {
  const router = useRouter();
  // Chave de idempotência estável entre tentativas com a mesma entrada: na falha de transporte, reenviar é seguro.
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);

  return <form className="space-y-2 rounded border p-3" onSubmit={async evento => {
    evento.preventDefault();
    const motivo = String(new FormData(evento.currentTarget).get("motivoReserva") ?? "");
    const entrada = JSON.stringify({ propostaId, propostaHash, autorizacaoId, habilidade, motivo });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    const d = await acao.executar(() => reservarTentativaRecuperacao({ propostaId, propostaHash, habilidades: [habilidade as Habilidade], motivo, chaveIdempotencia, autorizacaoEspecialReservaId: autorizacaoId }), "Tentativa reservada com a autorização especial.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <fieldset disabled={acao.ocupado} className="space-y-2">
      <label className="block" htmlFor={`motivo-reserva-${autorizacaoId}`}>Motivo da reserva<CampoTexto id={`motivo-reserva-${autorizacaoId}`} name="motivoReserva" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} type="submit">{acao.ocupado ? "Reservando…" : "Reservar tentativa autorizada"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
