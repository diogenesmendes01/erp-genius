"use client";
import { useRef } from "react";
import { designarProfessorRecuperacao } from "@/server/avaliacoes/recuperacao-designacao";
import { Formulario } from "../../../planos/[propostaId]/Formularios";
import { executarAcaoCliente } from "@/lib/acao-cliente";

export function Designar({ itemReservaId, versaoEsperada, atualId, professores }: { itemReservaId: string; versaoEsperada: number; atualId: string | null; professores: { id: string; nome: string }[] }) {
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  return <Formulario titulo="Registrar designação" executar={async data => {
    const escolha = String(data.get("professor") ?? "");
    const dados = { itemReservaId, versaoEsperada, professorId: escolha === "revogar" ? null : escolha, motivo: String(data.get("motivo") ?? "") }, entrada = JSON.stringify(dados);
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    // O <Formulario> compartilhado guarda ocupado/erro e só entende { ok, erro }; executarAcaoCliente decide a mensagem de resultado incerto.
    // Chave estável por entrada; o servidor devolve a designação já criada com a mesma chave (server/avaliacoes/recuperacao-designacao.ts:21-24).
    const r = await executarAcaoCliente(() => designarProfessorRecuperacao({ ...dados, chaveIdempotencia }), { idempotente: true });
    if (r.tipo !== "ok") return { ok: false, erro: r.mensagem };
    tentativa.current = null;
    return { ok: true };
  }}>
    <label className="block">Professor ou revogação<select name="professor" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione</option>{atualId && <option value="revogar">Revogar designação atual</option>}{professores.filter(p => p.id !== atualId).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
