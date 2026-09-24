"use client";
import { useRouter } from "next/navigation";
import { preservarOriginalContratual } from "@/server/contratos/originais";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function PreservarOriginal({ previaId, conferenciaId }: { previaId: string; conferenciaId: string }) {
  const router = useRouter();
  // Sem chaveIdempotencia, mas a própria conferenciaId (estável, única em ArtefatoContratual) faz esse
  // papel: repetida, o servidor devolve o original já preservado (server/contratos/originais.ts:27-28).
  const acao = useAcaoCliente({ idempotente: true });
  const pendente = acao.ocupado;
  return <form className="space-y-3 rounded border p-4" onSubmit={async (e) => {
    e.preventDefault(); const d = new FormData(e.currentTarget); acao.limpar();
    if (d.get("conferido") !== "on") { acao.setErro("Confirme a revisão do conteúdo e dos participantes."); return; }
    const desfecho = await acao.executar(() => preservarOriginalContratual({ previaId, conferenciaId, motivo: String(d.get("motivo") ?? ""), conteudoConferido: true }));
    if (desfecho?.tipo === "ok") router.refresh();
  }}>
    <h2 className="text-xl">Preservar original contratual</h2>
    <p>O arquivo será preservado com os participantes conferidos. Esta operação não envia para assinatura nem confirma o aceite.</p>
    <label className="block"><input type="checkbox" name="conferido" required disabled={pendente} /> Conferi o conteúdo desta prévia e a identificação dos participantes.</label>
    <label className="block">Motivo do registro<textarea className="block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={pendente} /></label>
    <FeedbackAcao erro={acao.erro} />
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Gerando e preservando…" : "Gerar e preservar original"}</button>
  </form>;
}
