"use client";
import { useRef } from "react";
import { Formulario } from "../../../planos/[propostaId]/Formularios";
import { proporSubstituicaoRecuperacao } from "@/server/avaliacoes/recuperacao-substituicao-proposta";
import { executarAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
export function ProporSubstituicao({ itemReservaId, substitutoId, estadoConferido, versaoEsperada }: { itemReservaId: string; substitutoId: string; estadoConferido: string; versaoEsperada: number }) {
  const chave = useRef<{ entrada: string; id: string } | null>(null);
  return <Formulario titulo="Guardar proposta de substituição" executar={async dados => {
    const d = { itemReservaId, substitutoId, estadoConferido, versaoEsperada, motivo: String(dados.get("motivo") ?? "") }, entrada = JSON.stringify(d);
    if (chave.current?.entrada !== entrada) chave.current = { entrada, id: crypto.randomUUID() };
    const chaveIdempotencia = chave.current.id;
    // O <Formulario> compartilhado guarda ocupado/erro e só entende { ok, erro }; executarAcaoCliente decide a mensagem de resultado incerto.
    // Chave estável por entrada; o servidor devolve a proposta já criada com a mesma chave (server/avaliacoes/recuperacao-substituicao-proposta.ts:34-37).
    const r = await executarAcaoCliente(() => proporSubstituicaoRecuperacao({ ...d, chaveIdempotencia }), { idempotente: true });
    return r.tipo === "ok" ? { ok: true } : { ok: false, erro: r.mensagem };
  }}>
    <p>A proposta conserva esta conferência para revisão. O avaliador atual permanece responsável até outra pessoa aprovar e a troca ser aplicada conjuntamente à agenda e à designação.</p>
    <label className="block"><input type="checkbox" required /> Conferi a fonte, o horário, o fuso e as pendências apresentados acima.</label>
    <label className="block">Motivo da substituição<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
