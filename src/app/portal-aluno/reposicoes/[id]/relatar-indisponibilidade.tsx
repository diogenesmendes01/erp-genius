"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Relato = { id: string; descricao: string; situacao: string; criadoEm: string; confirmadoEm: string | null };
type Pausa = { id: string; inicio: string; fim: string | null };

const data = (valor: string) => new Date(valor).toLocaleString("pt-BR");

/** Q57/Q58: o aluno vê só seus relatos e as interrupções do material da sua
 * própria reposição; a ação de escrita volta a confirmar o mesmo vínculo. */
export function RelatarIndisponibilidadePortalAluno({
  reposicaoId, podeRelatar, relatos, pausas,
}: { reposicaoId: string; podeRelatar: boolean; relatos: Relato[]; pausas: Pausa[] }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false), [erro, setErro] = useState<string | null>(null), [sucesso, setSucesso] = useState<string | null>(null);

  async function relatar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    setEnviando(true); setErro(null); setSucesso(null);
    try {
      const dados = new FormData(formulario);
      const resposta = await fetch(`/api/portal-aluno/reposicoes/${encodeURIComponent(reposicaoId)}/indisponibilidades`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ descricao: dados.get("descricao") }),
      });
      if (!resposta.ok) { setErro("Não foi possível registrar o relato agora. Tente novamente ou procure a escola."); return; }
      formulario.reset(); setSucesso("Relato enviado para conferência da escola."); router.refresh();
    } catch { setErro("Não foi possível registrar o relato agora. Tente novamente ou procure a escola."); }
    finally { setEnviando(false); }
  }

  return <section className="mt-5 space-y-3 rounded border bg-white p-5" aria-label="Indisponibilidade do material">
    <h2 className="font-medium">Problema com o material</h2>
    <p className="text-sm text-gray-600">Avise a escola se a gravação autorizada não estiver disponível. O prazo só é pausado depois da confirmação.</p>
    {pausas.length > 0 && <div className="space-y-2 text-sm" aria-label="Histórico de indisponibilidades">
      <p className="font-medium">Indisponibilidades confirmadas</p>
      {pausas.map((pausa) => <p key={pausa.id} className="rounded bg-amber-50 p-2">{pausa.fim
        ? `Material indisponível de ${data(pausa.inicio)} até ${data(pausa.fim)}.`
        : `Material indisponível desde ${data(pausa.inicio)}. A escola está regularizando.`}</p>)}
    </div>}
    {relatos.length > 0 && <details className="text-sm"><summary>Meus relatos enviados</summary><div className="mt-2 space-y-2">
      {relatos.map((relato) => <article key={relato.id} className="rounded border p-2"><p className="whitespace-pre-wrap">{relato.descricao}</p><p className="mt-1 text-gray-600">{relato.situacao} em {data(relato.criadoEm)}{relato.confirmadoEm ? ` · confirmado em ${data(relato.confirmadoEm)}` : ""}</p></article>)}
    </div></details>}
    {podeRelatar && <form onSubmit={relatar} className="space-y-2 border-t pt-3"><label className="block text-sm">Descreva o problema<textarea required minLength={5} maxLength={4000} name="descricao" className="mt-1 min-h-20 w-full rounded border p-2" /></label><button disabled={enviando} className="rounded border px-3 py-2 text-sm disabled:opacity-60">{enviando ? "Enviando…" : "Relatar indisponibilidade"}</button></form>}
    {sucesso && <p role="status" className="text-sm text-green-700">{sucesso}</p>}
    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
  </section>;
}
