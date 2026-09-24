"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { concluirMatricula } from "@/server/matricula/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function ConcluirMatriculas({ matriculas }: { matriculas: { id: string; nome: string }[] }) {
  const router = useRouter();
  // Sem chave de idempotência: repetir uma conclusão já aplicada é recusado pelo servidor, então
  // a falha de rede manda conferir a página antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  const [alvo, setAlvo] = useState<string | null>(null);
  // A linha concluída sai da lista no refresh; por isso o sucesso é anunciado na seção, não na linha,
  // e a seção continua montada enquanto houver uma confirmação a mostrar.
  if (!matriculas.length && !acao.sucesso) return null;
  return <section className="space-y-3 rounded-lg border p-4">
    <h2 className="font-medium">Conclusão da matrícula</h2>
    <p className="text-sm text-gray-600">Conclua após o aceite do contrato e a confirmação da taxa. A escola pode exigir também a primeira mensalidade.</p>
    <MensagemStatus texto={acao.sucesso} className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700" />
    {matriculas.map((m) => <div key={m.id} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>{m.nome}</span>
        <button disabled={acao.ocupado} className="rounded bg-brand-solid px-3 py-2 text-white disabled:opacity-50" onClick={async () => {
          setAlvo(m.id);
          const desfecho = await acao.executar(() => concluirMatricula(m.id), `Matrícula de ${m.nome} concluída.`);
          if (desfecho?.tipo === "ok") router.refresh();
        }}>{acao.ocupado && alvo === m.id ? "Concluindo…" : "Concluir matrícula"}</button>
      </div>
      <FeedbackAcao erro={alvo === m.id ? acao.erro : null} className="text-sm" />
    </div>)}
  </section>;
}
