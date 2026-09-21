"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { proporRegularizacaoFonteGravacao } from "@/server/gravacoes/regularizacao-fonte";

export function CorrecaoFonteGravacao({ publicacaoId, podePropor }: { publicacaoId: string | null; podePropor: boolean }) {
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const chaves = useRef(new Map<string, string>());
  if (!publicacaoId) return null;
  if (!podePropor) return <p className="text-sm text-gray-700">A gravação oficial permanece no histórico. Só a gestão ou o docente ainda vinculado à aula pode propor uma nova fonte.</p>;

  const propor = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const arquivoOficialId = String(formulario.get("arquivoOficialId") ?? "").trim();
    const motivo = String(formulario.get("motivo") ?? "").trim();
    if (arquivoOficialId.length < 3 || motivo.length < 5) { setErro("Informe o identificador institucional e o motivo da correção."); return; }
    const assinatura = `${publicacaoId}:${arquivoOficialId}:${motivo}`;
    const chaveIdempotencia = chaves.current.get(assinatura) ?? crypto.randomUUID();
    chaves.current.set(assinatura, chaveIdempotencia);
    iniciar(async () => {
      setErro(""); setFeito("");
      try {
        const resultado = await proporRegularizacaoFonteGravacao({ alvo: "PUBLICACAO_AULA", alvoId: publicacaoId, arquivoOficialId, motivo, chaveIdempotencia });
        if (!resultado.ok || !resultado.dado) { setErro(resultado.ok ? "Não foi possível preparar a proposta." : resultado.erro); return; }
        setFeito("Proposta registrada para decisão independente. A gravação atual continua vigente até aprovação.");
      } catch {
        setErro("Não foi possível preparar a proposta. Recarregue a aula para conferir sua autorização.");
      }
    });
  };

  return <section className="space-y-3 rounded border bg-[var(--surface)] p-4">
    <header><h2 className="text-lg font-medium">Correção da gravação oficial</h2><p className="text-sm text-gray-700">A proposta fixa uma revisão institucional e depende de decisão de outra pessoa da gestão. Ela não altera a chamada nem substitui a gravação atual agora.</p></header>
    <form className="space-y-3" onSubmit={propor}>
      <label className="block text-sm">ID do arquivo institucional<input name="arquivoOficialId" required minLength={3} maxLength={500} disabled={ocupado} className="mt-1 block w-full rounded border p-2" /></label>
      <label className="block text-sm">Motivo da correção<textarea name="motivo" required minLength={5} maxLength={4000} disabled={ocupado} className="mt-1 block w-full rounded border p-2" /></label>
      <button type="submit" disabled={ocupado} className="rounded border px-3 py-2 disabled:opacity-50">{ocupado ? "Preparando…" : "Propor nova fonte para revisão"}</button>
    </form>
    {feito && <p role="status" className="text-green-700">{feito}</p>}
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
  </section>;
}
