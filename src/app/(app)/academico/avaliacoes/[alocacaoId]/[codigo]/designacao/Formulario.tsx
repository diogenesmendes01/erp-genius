"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { designarAvaliador } from "@/server/avaliacoes/designacao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";

export function FormularioDesignacao({ alocacaoId, codigoAvaliacao, versaoEsperada, atualId, professores }: {
  alocacaoId: string; codigoAvaliacao: string; versaoEsperada: number; atualId: string | null; professores: { id: string; nome: string }[];
}) {
  const router = useRouter(), chave = useRef<string | null>(null);
  const [professor, setProfessor] = useState(""), [motivo, setMotivo] = useState("");
  // Chave de idempotência estável entre tentativas: na falha de transporte, reenviar sem alterar (MSG_RESULTADO_INCERTO).
  const acao = useAcaoCliente({ idempotente: true });
  return <form className="space-y-3 rounded border p-4" onSubmit={async e => {
    e.preventDefault(); if (!professor) return;
    const chaveIdempotencia = (chave.current ??= crypto.randomUUID());
    const d = await acao.executar(() => designarAvaliador({ alocacaoId, codigoAvaliacao, versaoEsperada, professorId: professor === "revogar" ? null : professor, motivo, chaveIdempotencia }), "Designação registrada.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <fieldset disabled={acao.ocupado} className="space-y-3">
      <legend className="font-medium">Alterar responsável pela avaliação</legend>
      <label className="block">Professor ou revogação<select required className="block rounded border p-2" value={professor} onChange={e => { setProfessor(e.target.value); chave.current = null; }}>
        <option value="" disabled>Selecione uma opção</option>
        {atualId && <option value="revogar">Revogar a designação atual</option>}
        {professores.filter(p => p.id !== atualId).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select></label>
      <label className="block">Motivo<CampoTexto required minLength={5} maxLength={2000} value={motivo} className="block w-full rounded border p-2" onChange={e => { setMotivo(e.target.value); chave.current = null; }} /></label>
      <button disabled={!professor} className={botaoClasses({ variante: professor === "revogar" ? "perigo" : "secundario", tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : professor === "revogar" ? "Revogar designação" : "Registrar designação"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
