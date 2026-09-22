"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { concluirMatricula } from "@/server/matricula/acoes";

export function ConcluirMatriculas({ matriculas }: { matriculas: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  if (!matriculas.length) return null;
  return <section className="space-y-3 rounded-lg border p-4">
    <h2 className="font-medium">Conclusão da matrícula</h2>
    <p className="text-sm text-gray-600">Conclua após o aceite do contrato e a confirmação da taxa. A escola pode exigir também a primeira mensalidade.</p>
    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    {matriculas.map((m) => <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span>{m.nome}</span>
      <button disabled={ocupado !== null} className="rounded bg-brand-solid px-3 py-2 text-white disabled:opacity-50" onClick={async () => {
        setOcupado(m.id); setErro(null);
        try {
          const resultado = await concluirMatricula(m.id);
          if (!resultado.ok) setErro(resultado.erro); else router.refresh();
        } finally { setOcupado(null); }
      }}>{ocupado === m.id ? "Concluindo…" : "Concluir matrícula"}</button>
    </div>)}
  </section>;
}
