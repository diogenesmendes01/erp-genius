"use client";

import { useState } from "react";
import { classificarMensagemWhatsApp, revisarFalhaEnvio, type RevisaoEnvio, type ItemTriagem } from "@/server/whatsapp/operacoes-atendimento";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { TIPO_MENSAGEM_LABEL, rotular } from "@/lib/labels";

// Triagem e revisão de envio incerto, no painel da conversa (Task 33). classificarMensagemWhatsApp e
// revisarFalhaEnvio recusam a repetição ("já classificada" / "já revisado"): sem chave de idempotência.
// A triagem aparece a quem `listarTriagemWhatsApp` aceita (administrador ou responsável pela triagem do
// número); a revisão de falha é só do administrador (`revisoes` chega nulo para os demais).

export function PainelTriagem({ triagem, revisoes, preferenciaFusoExibicao }: { triagem: ItemTriagem[] | null; revisoes: RevisaoEnvio[] | null; preferenciaFusoExibicao: string | null }) {
  // Resolvida a mensagem ou a falha, ela sai do painel na hora (a próxima carga da página já não a traz).
  const [resolvidas, setResolvidas] = useState<ReadonlySet<string>>(new Set());
  const resolver = (id: string) => setResolvidas((atual) => new Set(atual).add(id));
  const pendentesTriagem = triagem?.filter((m) => !resolvidas.has(m.id)) ?? null;
  const pendentesRevisao = revisoes?.filter((r) => !resolvidas.has(r.id)) ?? null;
  if (!pendentesTriagem && !pendentesRevisao) return null;
  return <div className="space-y-3">
    {pendentesRevisao && <details className="rounded-lg border border-gray-200 p-3">
      <summary className="cursor-pointer text-sm font-medium">Envios que exigem revisão · {pendentesRevisao?.length}</summary>
      <p className="my-2 text-xs text-gray-600">Um envio com erro pode ter chegado ao destinatário. Confirme o resultado no provedor antes de autorizar uma nova tentativa.</p>
      <div className="max-h-96 space-y-2 overflow-y-auto">{pendentesRevisao.map((r) => <Revisao key={r.id} item={r} />)}</div>
    </details>}
    {pendentesTriagem && <details className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <summary className="cursor-pointer text-sm font-medium">Triagem administrativa · {pendentesTriagem.length} mensagens sem finalidade</summary>
      <p className="my-2 text-xs text-gray-600">Revise cada mensagem antes de conceder acesso ao assunto correspondente. Quando necessário, abra o atendimento do contato; a mensagem continua restrita até ser classificada.</p>
      <div className="max-h-96 space-y-2 overflow-y-auto">{pendentesTriagem.map((m) => <Item key={m.id} item={m} preferenciaFusoExibicao={preferenciaFusoExibicao} aoResolver={resolver} />)}</div>
    </details>}
  </div>;
}

function Item({ item, preferenciaFusoExibicao, aoResolver }: { item: ItemTriagem; preferenciaFusoExibicao: string | null; aoResolver(id: string): void }) {
  const [atendimentoId, setAtendimentoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const acao = useAcaoCliente({ idempotente: false });
  return <form className="space-y-2 rounded border border-amber-200 bg-surface p-3 text-sm" onSubmit={async (e) => {
    e.preventDefault();
    const d = await acao.executar(() => classificarMensagemWhatsApp({ mensagemId: item.id, atendimentoId, motivo }));
    if (d?.tipo === "ok") aoResolver(item.id);
  }}>
    <p className="font-medium">{item.nome} · {formatarInstanteExibicao(item.criadoEm, preferenciaFusoExibicao, "UTC").texto}</p>
    <p className="whitespace-pre-wrap break-words text-gray-700">{item.corpo ?? `[${rotular(TIPO_MENSAGEM_LABEL, item.tipo).toLowerCase()}]`}</p>
    {item.midiaPath && <a className="text-blue-700 underline" href={item.midiaPath} target="_blank" rel="noreferrer">Abrir anexo para revisão</a>}
    <label className="grid gap-1">Atendimento do mesmo contato e canal
      <select required value={atendimentoId} onChange={(e) => setAtendimentoId(e.target.value)} className="rounded border p-1.5">
        <option value="">Selecione após revisar</option>
        {item.atendimentos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
      </select>
    </label>
    <label className="grid gap-1">Motivo da classificação
      <input required minLength={12} maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="rounded border p-1.5" />
    </label>
    <button disabled={acao.ocupado || !item.atendimentos.length} className={botaoClasses({ variante: "secundario" })}>Classificar esta mensagem</button>
    <FeedbackAcao erro={acao.erro} />
  </form>;
}

function Revisao({ item }: { item: RevisaoEnvio }) {
  const [concluida, setConcluida] = useState(false);
  const [decisao, setDecisao] = useState<"CANCELAR" | "REENVIAR_APOS_VERIFICACAO">("CANCELAR");
  const [evidencia, setEvidencia] = useState("");
  const acao = useAcaoCliente({ idempotente: false });
  // Concluída, fica só o resultado do servidor (cancelado / nova tentativa autorizada / cobrança mudou).
  if (concluida) return <div className="rounded border bg-surface p-3 text-sm"><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></div>;
  return <form className="space-y-2 rounded border bg-surface p-3 text-sm" onSubmit={async (e) => {
    e.preventDefault();
    // A mensagem do servidor (cancelado / nova tentativa autorizada / cobrança mudou) é o resultado.
    const d = await acao.executar(() => revisarFalhaEnvio({ id: item.id, decisao, evidencia }), (dado) => dado?.mensagem ?? null);
    if (d?.tipo === "ok") setConcluida(true);
  }}>
    <p className="font-medium">{item.contato} · {item.motivo}</p>
    <p className="whitespace-pre-wrap">{item.corpo}</p>
    <label className="grid gap-1">Decisão após conferência
      <select value={decisao} onChange={(e) => setDecisao(e.target.value as typeof decisao)} className="rounded border p-1.5">
        <option value="CANCELAR">Encerrar sem novo envio</option>
        <option value="REENVIAR_APOS_VERIFICACAO">Provedor não enviou; autorizar nova tentativa</option>
      </select>
    </label>
    <label className="grid gap-1">Evidência da conferência
      <input required minLength={12} maxLength={1000} value={evidencia} onChange={(e) => setEvidencia(e.target.value)} className="rounded border p-1.5" />
    </label>
    <button disabled={acao.ocupado} className={botaoClasses({ variante: "secundario" })}>Registrar revisão</button>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
