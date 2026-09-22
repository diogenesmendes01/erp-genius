"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function EntregaGravacaoPortalAluno({ reposicaoId, podeEntregar, motivoBloqueio }: { reposicaoId: string; podeEntregar: boolean; motivoBloqueio: string | null }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null); const [enviando, setEnviando] = useState(false);
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    setErro(null); setEnviando(true);
    try {
      const dados = new FormData(formulario);
      const resposta = await fetch(`/api/portal-aluno/reposicoes/${encodeURIComponent(reposicaoId)}/entregas`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumo: dados.get("resumo"), atividade: dados.get("atividade"), evidencia: dados.get("evidencia") }),
      });
      if (!resposta.ok) { setErro("A entrega não foi registrada. Confira o prazo, a situação da matrícula e a pendência atual."); return; }
      formulario.reset(); router.refresh();
    } catch { setErro("Não foi possível registrar a entrega agora."); }
    finally { setEnviando(false); }
  }
  if (!podeEntregar) return <p className="mt-5 rounded border bg-surface p-4 text-sm text-gray-700">{motivoBloqueio ?? "Não há uma entrega aberta neste momento."}</p>;
  return <form onSubmit={enviar} className="mt-5 space-y-3 rounded border bg-surface p-5"><h2 className="font-medium">Enviar resumo e atividade</h2>
    <p className="text-sm text-gray-600">O envio registra uma nova versão para avaliação do professor designado. Assistir ao material e enviar a atividade são etapas distintas.</p>
    <label className="block text-sm">Resumo do que foi assistido<textarea required minLength={5} maxLength={4000} name="resumo" className="mt-1 min-h-24 w-full rounded border p-2" /></label>
    <label className="block text-sm">Atividade realizada<textarea required minLength={5} maxLength={4000} name="atividade" className="mt-1 min-h-24 w-full rounded border p-2" /></label>
    <label className="block text-sm">Evidência ou observação<textarea required minLength={5} maxLength={4000} name="evidencia" className="mt-1 min-h-20 w-full rounded border p-2" /></label>
    <button disabled={enviando} className="rounded bg-brand-600 px-3 py-2 text-sm text-white disabled:opacity-60">{enviando ? "Enviando…" : "Enviar para avaliação"}</button>
    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
  </form>;
}
