"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepararExcecaoAdmissao, decidirExcecaoAdmissao } from "@/server/matricula/excecao-admissao";

export function FormularioExcecao({ reservaId, estadoHash, propostaId, podeAprovar = true }: { reservaId: string; estadoHash: string; propostaId?: string; podeAprovar?: boolean }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [erro, setErro] = useState("");
  const [chave] = useState(() => crypto.randomUUID());
  return <form className="space-y-3 rounded border p-3" onSubmit={(e) => {
    e.preventDefault(); const d = new FormData(e.currentTarget); setErro("");
    iniciar(async () => {
      const motivo = String(d.get("motivo") ?? "");
      const r = propostaId ? await decidirExcecaoAdmissao({ propostaId, estadoHash, motivo, aprovada: d.get("decisao") === "aprovar" })
        : await prepararExcecaoAdmissao({ reservaId, estadoHash, motivo, parecerViabilidade: String(d.get("parecer") ?? ""), chaveIdempotencia: chave });
      if (!r.ok) setErro(r.erro); else router.refresh();
    });
  }}>
    {!propostaId && <label className="block">Viabilidade pedagógica do ingresso<textarea name="parecer" minLength={10} maxLength={6000} required disabled={pendente} className="block w-full rounded border p-2" /></label>}
    <label className="block">Motivo<textarea name="motivo" minLength={5} maxLength={2000} required disabled={pendente} className="block w-full rounded border p-2" /></label>
    {propostaId && <label className="block">Decisão<select name="decisao" className="mx-2 rounded border p-2" disabled={pendente} defaultValue="rejeitar"><option value="rejeitar">Rejeitar</option>{podeAprovar && <option value="aprovar">Aprovar exceção para esta reserva</option>}</select></label>}
    {erro && <p role="alert">{erro}</p>}
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Registrando…" : propostaId ? "Registrar decisão" : "Propor exceção"}</button>
  </form>;
}
