"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarRelatoIndisponibilidadeEquipe } from "@/server/diario/reposicao-operacoes-relatos";

/** Formulário comum da equipe e do professor designado. A ação decide o
 * escopo atual; enviar um relato não confirma falha nem interrompe o prazo. */
export function RelatarIndisponibilidadeReposicao({ reposicaoId }: { reposicaoId: string }) {
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const router = useRouter();
  return <form className="space-y-2 rounded border p-3" onSubmit={(evento) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const dados = new FormData(formulario);
    iniciar(async () => {
      setErro("");
      try {
        const resultado = await registrarRelatoIndisponibilidadeEquipe({ reposicaoId, descricao: String(dados.get("descricao") ?? "") });
        if (!resultado.ok) { setErro(resultado.erro); return; }
        formulario.reset();
        router.refresh();
      } catch { setErro("Não foi possível confirmar o relato. Consulte a reposição antes de tentar novamente."); }
    });
  }}>
    <p className="font-medium">Relatar indisponibilidade do material</p>
    <label className="block">Descrição do problema<textarea name="descricao" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
    <p className="text-sm text-gray-600">Registrar o relato não confirma a falha, não pausa o prazo e não altera a entrega.</p>
    <button disabled={ocupado} className="rounded border px-3 py-2">{ocupado ? "Registrando…" : "Registrar relato"}</button>
    {erro && <p role="alert">{erro}</p>}
  </form>;
}
