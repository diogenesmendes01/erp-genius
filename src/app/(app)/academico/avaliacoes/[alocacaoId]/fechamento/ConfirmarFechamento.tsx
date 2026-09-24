"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { confirmarFechamentoAcademico } from "@/server/avaliacoes/fechamento";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function ConfirmarFechamento({ alocacaoId, estadoHash, versaoEsperada, podeFechar, resultadoSuficiente }: {
  alocacaoId: string;
  estadoHash: string;
  versaoEsperada: number;
  podeFechar: boolean;
  resultadoSuficiente: boolean;
}) {
  const router = useRouter();
  const chave = useRef<string | null>(null);
  // A chave só é trocada após sucesso; o servidor devolve o fechamento já registrado com a mesma chave (server/avaliacoes/fechamento.ts:38-43).
  const acao = useAcaoCliente({ idempotente: true });
  const ocupado = acao.ocupado;

  async function confirmar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const dados = new FormData(formulario);
    const motivo = String(dados.get("motivo") ?? "");
    if (!chave.current) chave.current = crypto.randomUUID();
    const chaveIdempotencia = chave.current;
    const resposta = await acao.executar(() => confirmarFechamentoAcademico({
      alocacaoId,
      estadoHash,
      versaoEsperada,
      motivo,
      chaveIdempotencia,
    }));
    if (resposta?.tipo !== "ok") return;
    chave.current = null;
    formulario.reset();
    router.refresh();
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
    <FeedbackAcao erro={acao.erro} />
    <button type="submit" disabled={ocupado} className="rounded bg-brand-solid px-3 py-2 text-white disabled:opacity-50">{ocupado ? "Confirmando…" : "Confirmar fechamento"}</button>
  </form>;
}
