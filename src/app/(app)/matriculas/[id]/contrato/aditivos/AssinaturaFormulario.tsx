"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { registrarConferenciaAssinaturaAditivo } from "@/server/contratos/aditivo-assinatura";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
export function AssinaturaFormulario({ matriculaId, propostaId, artefatoId, revisaoHash }: { matriculaId: string; propostaId: string; artefatoId: string; revisaoHash: string }) {
  // Chave estável enquanto os dados não mudam: na falha de transporte, reenviar confere a mesma conferência.
  const router = useRouter(), acao = useAcaoCliente({ idempotente: true });
  const tentativa = useRef<{ dados: string; chave: string } | null>(null);
  return <form className="space-y-3 rounded border p-4" onSubmit={async e => {
    e.preventDefault(); const motivo = String(new FormData(e.currentTarget).get("motivo") ?? "").trim();
    const dados = { matriculaId, propostaId, artefatoId, revisaoHash, motivo, dadosConferidos: true as const }, conteudo = JSON.stringify(dados);
    if (!tentativa.current || tentativa.current.dados !== conteudo) tentativa.current = { dados: conteudo, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    const d = await acao.executar(() => registrarConferenciaAssinaturaAditivo({ ...dados, chaveIdempotencia }), "Conferência do original registrada.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <h2 className="text-xl">Registrar conferência do original</h2>
    <label className="block"><input type="checkbox" required disabled={acao.ocupado} /> Abri o PDF preservado e conferi o documento, a vigência e os signatários apresentados.</label>
    <label className="block">Motivo<CampoTexto className="mt-1 block w-full rounded border p-2" required minLength={5} maxLength={2000} name="motivo" disabled={acao.ocupado} /></label>
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={acao.ocupado}>{acao.ocupado ? "Registrando…" : "Registrar conferência"}</button>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
