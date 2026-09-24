"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatarMoeda } from "@/lib/dinheiro";
import { FORMA_PAGAMENTO_LABEL, rotular } from "@/lib/labels";
import { conferirPagamento } from "@/server/financeiro/acoes";
import type { listarInformesPagamento } from "@/server/financeiro/consultas";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

function textoInstanteOperacional(iso: string, preferenciaFusoExibicao: string | null) {
  const exibicao = formatarInstanteExibicao(iso, preferenciaFusoExibicao, "UTC");
  return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
}

export function InformesPagamento({ informes, preferenciaFusoExibicao = null }: { informes: Awaited<ReturnType<typeof listarInformesPagamento>>; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter();
  // Conferência de dinheiro sem chave de idempotência (server/financeiro/acoes.ts:127); só a versão do
  // informe e a repetição pelo mesmo conferente (acoes.ts:136-137) protegem. Conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  // O erro aparece no informe cujo botão disparou a conferência.
  const [alvo, setAlvo] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  async function decidir(id: string, versao: number, confirmar: boolean) {
    setAlvo(id);
    const d = await acao.executar(() => conferirPagamento(id, { versao, confirmar, motivo: motivos[id] }));
    if (d?.tipo === "ok") router.refresh();
  }
  return <section className="space-y-3">
    <h2 className="text-lg font-medium">Pagamentos informados</h2>
    <p className="text-sm text-gray-600">Informes a conferir preservam o saldo até a confirmação de outra pessoa do Financeiro.</p>
    {!informes.length && <p className="text-sm text-gray-500">Nenhum informe neste atendimento.</p>}
    {informes.map((i) => <article key={i.id} className="space-y-2 rounded-md border p-3 text-sm">
      <p><strong>{i.aluno}</strong> · {i.cobranca} · {formatarMoeda(i.valor, i.moeda)} · {new Date(i.dataPagamento).toLocaleDateString("pt-BR")}</p>
      <p>{i.status === "A_CONFERIR" ? "A conferir" : i.status === "CONFIRMADO" ? "Confirmado" : "Rejeitado"} · {rotular(FORMA_PAGAMENTO_LABEL, i.forma)}</p>
      {i.status === "A_CONFERIR" && i.suspenderLembretesAte && <p className="text-xs text-gray-600">Prazo de conferência: {textoInstanteOperacional(i.suspenderLembretesAte, preferenciaFusoExibicao)}</p>}
      {i.comentario && <p>{i.comentario}</p>}
      {i.comprovanteUrl && <a className="text-brand-700 underline" href={i.comprovanteUrl} target="_blank" rel="noreferrer">{i.comprovanteNome ?? "Abrir comprovante"}</a>}
      {i.motivoConferencia && <p>Motivo: {i.motivoConferencia}</p>}
      {i.podeConferir && <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Motivo da decisão" className="rounded border px-2 py-1" placeholder="Motivo (obrigatório para rejeitar)" value={motivos[i.id] ?? ""} onChange={(e) => setMotivos({ ...motivos, [i.id]: e.target.value })} />
        <button disabled={acao.ocupado} className="rounded bg-brand-solid px-3 py-1.5 text-white disabled:opacity-50" onClick={() => decidir(i.id, i.versao, true)}>Confirmar recebimento</button>
        <button disabled={acao.ocupado || !motivos[i.id]?.trim()} className="rounded border px-3 py-1.5 disabled:opacity-50" onClick={() => decidir(i.id, i.versao, false)}>Rejeitar</button>
      </div>}
      <FeedbackAcao erro={alvo === i.id ? acao.erro : null} />
    </article>)}
  </section>;
}
