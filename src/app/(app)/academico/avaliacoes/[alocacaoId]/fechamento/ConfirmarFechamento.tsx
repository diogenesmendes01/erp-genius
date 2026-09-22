"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarFechamentoAcademico } from "@/server/avaliacoes/fechamento";

export function ConfirmarFechamento({ alocacaoId, estadoHash, versaoEsperada, podeFechar, resultadoSuficiente }: {
  alocacaoId: string;
  estadoHash: string;
  versaoEsperada: number;
  podeFechar: boolean;
  resultadoSuficiente: boolean;
}) {
  const router = useRouter();
  const chave = useRef<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  function confirmar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const dados = new FormData(formulario);
    const motivo = String(dados.get("motivo") ?? "");
    if (!chave.current) chave.current = crypto.randomUUID();
    setErro("");
    iniciar(async () => {
      const resposta = await confirmarFechamentoAcademico({
        alocacaoId,
        estadoHash,
        versaoEsperada,
        motivo,
        chaveIdempotencia: chave.current!,
      });
      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }
      chave.current = null;
      formulario.reset();
      router.refresh();
    });
  }

  if (!podeFechar) return <p role="status" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">Resolva as pendências da revisão antes de confirmar uma versão final.</p>;
  return <form className="space-y-3 rounded border p-4" onSubmit={confirmar}>
    <h2 className="text-lg font-medium">Confirmar versão final</h2>
    <p className="text-sm text-gray-700">{resultadoSuficiente
      ? "O resultado atual é suficiente. Esta confirmação não executa progressão nem muda a turma."
      : "O resultado atual pode ser confirmado como insuficiente. Esta confirmação não autoriza progressão."}</p>
    <label className="block text-sm">Motivo da confirmação
      <textarea name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="mt-1 block w-full rounded border p-2" />
    </label>
    <label className="flex items-start gap-2 text-sm"><input name="conferido" type="checkbox" required disabled={ocupado} />
      <span>Revisei as fontes, notas, frequência e pendências exibidas neste estado.</span>
    </label>
    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    <button type="submit" disabled={ocupado} className="rounded bg-brand-solid px-3 py-2 text-white disabled:opacity-50">{ocupado ? "Confirmando…" : "Confirmar fechamento"}</button>
  </form>;
}
