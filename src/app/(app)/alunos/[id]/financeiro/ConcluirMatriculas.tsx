"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { concluirMatricula } from "@/server/matricula/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function ConcluirMatriculas({ matriculas }: { matriculas: { id: string; nome: string }[] }) {
  const router = useRouter();
  // Sem chave de idempotência: repetir uma conclusão já aplicada é recusado pelo servidor, então
  // a falha de rede manda conferir a página antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  const [alvo, setAlvo] = useState<string | null>(null);
  if (!matriculas.length) return null;
  return <section className="space-y-3 rounded-lg border p-4">
    <h2 className="font-medium">Conclusão da matrícula</h2>
    <p className="text-sm text-gray-600">Conclua após o aceite do contrato e a confirmação da taxa. A escola pode exigir também a primeira mensalidade.</p>
    {matriculas.map((m) => <div key={m.id} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>{m.nome}</span>
        <button disabled={acao.ocupado} className="rounded bg-brand-solid px-3 py-2 text-white disabled:opacity-50" onClick={async () => {
          setAlvo(m.id);
          await acao.executar(() => concluirMatricula(m.id), () => router.refresh());
        }}>{acao.ocupado && alvo === m.id ? "Concluindo…" : "Concluir matrícula"}</button>
      </div>
      {alvo === m.id && <FeedbackAcao erro={acao.erro} className="text-sm" />}
    </div>)}
  </section>;
}
