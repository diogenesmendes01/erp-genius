"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepararExcecaoAdmissao, decidirExcecaoAdmissao } from "@/server/matricula/excecao-admissao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function FormularioExcecao({ reservaId, estadoHash, propostaId, podeAprovar = true }: { reservaId: string; estadoHash: string; propostaId?: string; podeAprovar?: boolean }) {
  const router = useRouter();
  const [chave] = useState(() => crypto.randomUUID());
  // Proposta: chave estável por formulário e o servidor devolve a proposta já criada com a mesma chave (server/matricula/excecao-admissao.ts:29-30).
  // Decisão: o contrato não recebe chave de idempotência (excecao-admissao.ts:41), então a falha não manda reenviar.
  const preparo = useAcaoCliente({ idempotente: true }), decisao = useAcaoCliente({ idempotente: false });
  const acao = propostaId ? decisao : preparo, pendente = acao.ocupado;
  return <form className="space-y-3 rounded border p-3" onSubmit={async (e) => {
    e.preventDefault(); const d = new FormData(e.currentTarget);
    const motivo = String(d.get("motivo") ?? "");
    const r = propostaId ? await acao.executar(() => decidirExcecaoAdmissao({ propostaId, estadoHash, motivo, aprovada: d.get("decisao") === "aprovar" }))
      : await acao.executar(() => prepararExcecaoAdmissao({ reservaId, estadoHash, motivo, parecerViabilidade: String(d.get("parecer") ?? ""), chaveIdempotencia: chave }));
    if (r?.tipo === "ok") router.refresh();
  }}>
    {!propostaId && <label className="block">Viabilidade pedagógica do ingresso<textarea name="parecer" minLength={10} maxLength={6000} required disabled={pendente} className="block w-full rounded border p-2" /></label>}
    <label className="block">Motivo<textarea name="motivo" minLength={5} maxLength={2000} required disabled={pendente} className="block w-full rounded border p-2" /></label>
    {propostaId && <label className="block">Decisão<select name="decisao" className="mx-2 rounded border p-2" disabled={pendente} defaultValue="rejeitar"><option value="rejeitar">Rejeitar</option>{podeAprovar && <option value="aprovar">Aprovar exceção para esta reserva</option>}</select></label>}
    <FeedbackAcao erro={acao.erro} />
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Registrando…" : propostaId ? "Registrar decisão" : "Propor exceção"}</button>
  </form>;
}
