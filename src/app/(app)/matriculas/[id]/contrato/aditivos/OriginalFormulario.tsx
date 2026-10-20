"use client";
import { useRouter } from "next/navigation";
import { preservarOriginalAditivo } from "@/server/contratos/aditivo-originais";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
export function OriginalFormulario({ matriculaId, propostaId, conferencia }: { matriculaId: string; propostaId: string; conferencia: { id: string; versao: number; revisaoHash: string } }) {
  // Idempotente por natureza (#166): um original por conferência; repetir devolve o artefato já preservado
  // (aditivo-original-tx.ts; aditivo.int.test.ts). Reenviar é seguro.
  const router = useRouter(), acao = useAcaoCliente({ idempotente: true });
  return <form className="space-y-3 rounded border p-3" onSubmit={async e => {
    e.preventDefault(); const motivo = String(new FormData(e.currentTarget).get("motivo") ?? "").trim();
    const d = await acao.executar(() => preservarOriginalAditivo({ matriculaId, propostaId, conferenciaId: conferencia.id, conferenciaHash: conferencia.revisaoHash, motivo, conteudoConferido: true }),
      "Original do aditivo preservado. Consulte o PDF abaixo.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <p>Gerar com a conferência de signatários versão {conferencia.versao}.</p>
    <label className="block">Motivo<CampoTexto className="mt-1 block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={acao.ocupado} /></label>
    <label className="block"><input type="checkbox" required disabled={acao.ocupado} /> Conferi o texto, as alterações, a vigência e os signatários deste aditivo.</label>
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={acao.ocupado}>{acao.ocupado ? "Gerando…" : "Gerar e preservar original do aditivo"}</button>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
