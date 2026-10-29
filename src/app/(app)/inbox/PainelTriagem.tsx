"use client";

import { useState } from "react";
import { classificarMensagemWhatsApp, revisarFalhaEnvio, type RevisaoEnvio, type ItemTriagem } from "@/server/whatsapp/operacoes-atendimento";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Combobox } from "@/components/ui/combobox";
import { garantirEstilo } from "@/app/(app)/inbox/garantir-estilo";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { TIPO_MENSAGEM_LABEL, rotular } from "@/lib/labels";

export function PainelTriagem({ triagem, revisoes, preferenciaFusoExibicao }: { triagem: ItemTriagem[] | null; revisoes: RevisaoEnvio[] | null; preferenciaFusoExibicao: string | null }) {
  const [resolvidas, setResolvidas] = useState<ReadonlySet<string>>(new Set());
  const resolver = (id: string) => setResolvidas((atual) => new Set(atual).add(id));
  const pendentes = <T extends { id: string }>(l: T[] | null) => { const f = l?.filter((x) => !resolvidas.has(x.id)); return f?.length ? f : null; };
  const pendentesTriagem = pendentes(triagem);
  const pendentesRevisao = pendentes(revisoes);
  if (!pendentesTriagem && !pendentesRevisao) return null;
  return <div className="space-y-3">
    {pendentesRevisao && <details className="rounded-lg border border-gray-200 p-3">
      <summary className="cursor-pointer text-sm font-medium">Envios que exigem revisão · {pendentesRevisao.length}</summary>
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
  garantirEstilo();
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
      <Combobox aria-label="Atendimento do mesmo contato e canal" required value={atendimentoId} onValueChange={setAtendimentoId} vazio="Selecione após revisar" className="rounded border p-1.5" opcoes={item.atendimentos.map((a) => ({ valor: a.id, rotulo: a.nome }))} />
    </label>
    <label className="grid gap-1">Motivo da classificação
      <input required minLength={12} maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="rounded border p-1.5" />
    </label>
    <button disabled={acao.ocupado || !item.atendimentos.length} className={botaoClasses({ variante: "secundario" })}>Classificar esta mensagem</button>
    <FeedbackAcao erro={acao.erro} />
  </form>;
}

function Revisao({ item }: { item: RevisaoEnvio }) {
  garantirEstilo();
  const [concluida, setConcluida] = useState(false);
  const [decisao, setDecisao] = useState<"CANCELAR" | "REENVIAR_APOS_VERIFICACAO">("CANCELAR");
  const [evidencia, setEvidencia] = useState("");
  const acao = useAcaoCliente({ idempotente: false });
  if (concluida) return <div className="rounded border bg-surface p-3 text-sm"><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></div>;
  return <form className="space-y-2 rounded border bg-surface p-3 text-sm" onSubmit={async (e) => {
    e.preventDefault();
    const d = await acao.executar(() => revisarFalhaEnvio({ id: item.id, decisao, evidencia }), (dado) => dado?.mensagem ?? null);
    if (d?.tipo === "ok") setConcluida(true);
  }}>
    <p className="font-medium">{item.contato} · {item.motivo}</p>
    <p className="whitespace-pre-wrap">{item.corpo}</p>
    <label className="grid gap-1">Decisão após conferência
      <Combobox aria-label="Decisão após conferência" value={decisao} onValueChange={(valor) => setDecisao(valor as typeof decisao)} className="rounded border p-1.5" opcoes={[{ valor: "CANCELAR", rotulo: "Encerrar sem novo envio" }, { valor: "REENVIAR_APOS_VERIFICACAO", rotulo: "Provedor não enviou; autorizar nova tentativa" }]} />
    </label>
    <label className="grid gap-1">Evidência da conferência
      <input required minLength={12} maxLength={1000} value={evidencia} onChange={(e) => setEvidencia(e.target.value)} className="rounded border p-1.5" />
    </label>
    <button disabled={acao.ocupado} className={botaoClasses({ variante: "secundario" })}>Registrar revisão</button>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
