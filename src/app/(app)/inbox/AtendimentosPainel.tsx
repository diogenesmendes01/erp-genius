"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { abrirAtendimentoInstitucional, classificarMensagemWhatsApp, revisarFalhaEnvio, type RevisaoEnvio, type ItemTriagem, type OpcoesAtendimento } from "@/server/whatsapp/operacoes-atendimento";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

export function AtendimentosPainel({ opcoes, triagem, revisoes, preferenciaFusoExibicao }: { opcoes: OpcoesAtendimento; triagem: ItemTriagem[] | null; revisoes: RevisaoEnvio[] | null; preferenciaFusoExibicao: string | null }) {
  const router = useRouter();
  const [destino, setDestino] = useState("");
  const [numero, setNumero] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const destinoSelecionado = opcoes.destinos.find((item) => item.chave === destino);
  return <div className="space-y-3">
    <form className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-surface p-3" onSubmit={async (e) => {
      e.preventDefault(); setErro(null); setOcupado(true);
      try {
        const r = await abrirAtendimentoInstitucional({ destinoChave: destino, numeroId: numero });
        if (!r.ok) setErro(r.erro); else { router.push(`/inbox?c=${r.dado!.id}`); router.refresh(); }
      } finally { setOcupado(false); }
    }}>
      <label className="grid gap-1 text-sm">Finalidade e destinatário
        <select required value={destino} onChange={(e) => setDestino(e.target.value)} aria-describedby={destinoSelecionado?.impedimento ? "impedimento-destino" : undefined} className="max-w-sm rounded border p-2">
          <option value="">Selecione o atendimento</option>
          {opcoes.destinos.map((d) => <option key={d.chave} value={d.chave} disabled={d.disponivel === false}>{d.nome}{d.disponivel === false ? " · indisponível" : ""}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Canal da escola
        <select required value={numero} onChange={(e) => setNumero(e.target.value)} className="rounded border p-2">
          <option value="">Selecione o canal</option>
          {opcoes.numeros.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
        </select>
      </label>
      <button disabled={ocupado || !opcoes.destinos.length || !opcoes.numeros.length} className="rounded bg-brand-600 px-3 py-2 text-sm text-white disabled:opacity-50">Abrir atendimento</button>
      {!opcoes.numeros.length && <p className="text-xs text-gray-500">A administração precisa disponibilizar um canal ativo para os atendimentos autorizados.</p>}
      {destinoSelecionado?.impedimento && <p id="impedimento-destino" role="status" className="basis-full text-xs text-amber-800">{destinoSelecionado.impedimento}</p>}
    </form>
    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    {revisoes && <details className="rounded-lg border border-gray-200 p-3">
      <summary className="cursor-pointer text-sm font-medium">Envios que exigem revisão · {revisoes.length}</summary>
      <p className="my-2 text-xs text-gray-600">Um envio com erro pode ter chegado ao destinatário. Confirme o resultado no provedor antes de autorizar uma nova tentativa.</p>
      <div className="max-h-96 space-y-2 overflow-y-auto">{revisoes.map((r) => <Revisao key={r.id} item={r} />)}</div>
    </details>}
    {triagem && <details className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <summary className="cursor-pointer text-sm font-medium">Triagem administrativa · {triagem.length} mensagens sem finalidade</summary>
      <p className="my-2 text-xs text-gray-600">Revise cada mensagem antes de conceder acesso ao assunto correspondente. Quando necessário, abra o atendimento acima; a mensagem continua restrita até ser classificada.</p>
      <div className="max-h-96 space-y-2 overflow-y-auto">{triagem.map((m) => <Item key={m.id} item={m} preferenciaFusoExibicao={preferenciaFusoExibicao} />)}</div>
    </details>}
  </div>;
}

function Item({ item, preferenciaFusoExibicao }: { item: ItemTriagem; preferenciaFusoExibicao: string | null }) {
  const router = useRouter();
  const [atendimentoId, setAtendimentoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  return <form className="space-y-2 rounded border border-amber-200 bg-white p-3 text-sm" onSubmit={async (e) => {
    e.preventDefault(); setOcupado(true); setErro(null);
    try {
      const r = await classificarMensagemWhatsApp({ mensagemId: item.id, atendimentoId, motivo });
      if (!r.ok) setErro(r.erro); else router.refresh();
    } finally { setOcupado(false); }
  }}>
    <p className="font-medium">{item.nome} · {formatarInstanteExibicao(item.criadoEm, preferenciaFusoExibicao, "UTC").texto}</p>
    <p className="whitespace-pre-wrap break-words text-gray-700">{item.corpo ?? `[${item.tipo.toLowerCase()}]`}</p>
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
    <button disabled={ocupado || !item.atendimentos.length} className="rounded border px-3 py-1.5 disabled:opacity-50">Classificar esta mensagem</button>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
  </form>;
}

function Revisao({ item }: { item: RevisaoEnvio }) {
  const router = useRouter();
  const [decisao, setDecisao] = useState<"CANCELAR" | "REENVIAR_APOS_VERIFICACAO">("CANCELAR");
  const [evidencia, setEvidencia] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  return <form className="space-y-2 rounded border bg-white p-3 text-sm" onSubmit={async (e) => {
    e.preventDefault(); setOcupado(true);
    try {
      const r = await revisarFalhaEnvio({ id: item.id, decisao, evidencia });
      setMensagem(r.ok ? r.dado!.mensagem : r.erro);
      if (r.ok) router.refresh();
    } finally { setOcupado(false); }
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
    <button disabled={ocupado} className="rounded border px-3 py-1.5 disabled:opacity-50">Registrar revisão</button>
    {mensagem && <p role="status">{mensagem}</p>}
  </form>;
}
