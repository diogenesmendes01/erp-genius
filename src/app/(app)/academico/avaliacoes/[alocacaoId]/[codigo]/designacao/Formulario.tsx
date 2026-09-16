"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { designarAvaliador } from "@/server/avaliacoes/designacao";

export function FormularioDesignacao({ alocacaoId, codigoAvaliacao, versaoEsperada, atualId, professores }: {
  alocacaoId: string; codigoAvaliacao: string; versaoEsperada: number; atualId: string | null; professores: { id: string; nome: string }[];
}) {
  const router = useRouter(), chave = useRef<string | null>(null);
  const [professor, setProfessor] = useState(""), [motivo, setMotivo] = useState(""), [mensagem, setMensagem] = useState("");
  const [pendente, iniciar] = useTransition();
  return <form className="space-y-3 rounded border p-4" onSubmit={e => {
    e.preventDefault(); if (!professor) return;
    iniciar(async () => {
      chave.current ??= crypto.randomUUID();
      try {
        const r = await designarAvaliador({ alocacaoId, codigoAvaliacao, versaoEsperada, professorId: professor === "revogar" ? null : professor, motivo, chaveIdempotencia: chave.current });
        if (!r.ok) { setMensagem(r.erro); return; }
        setMensagem("Designação registrada."); router.refresh();
      } catch { setMensagem("Não foi possível confirmar o resultado. Tente novamente para conferir a mesma solicitação."); }
    });
  }}>
    <fieldset disabled={pendente} className="space-y-3">
      <legend className="font-medium">Alterar responsável pela avaliação</legend>
      <label className="block">Professor ou revogação<select required className="block rounded border p-2" value={professor} onChange={e => { setProfessor(e.target.value); chave.current = null; }}>
        <option value="" disabled>Selecione uma opção</option>
        {atualId && <option value="revogar">Revogar a designação atual</option>}
        {professores.filter(p => p.id !== atualId).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select></label>
      <label className="block">Motivo<textarea required minLength={5} maxLength={2000} value={motivo} className="block w-full rounded border p-2" onChange={e => { setMotivo(e.target.value); chave.current = null; }} /></label>
      <button disabled={!professor} className="rounded border px-3 py-2">{pendente ? "Registrando…" : professor === "revogar" ? "Revogar designação" : "Registrar designação"}</button>
    </fieldset>
    {mensagem && <p role="status">{mensagem}</p>}
  </form>;
}
