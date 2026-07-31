"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconCheck,
  IconChecks,
  IconAlertTriangle,
  IconPaperclip,
  IconMicrophone,
  IconPlayerStopFilled,
  IconSend2,
  IconLink,
  IconLock,
  IconX,
} from "@tabler/icons-react";
import type { EtapaLead, Temperatura } from "@prisma/client";
import { formatarMoeda } from "@/lib/dinheiro";
import { ETAPA_LABEL, TEMPERATURA_CLS, TEMPERATURA_LABEL } from "@/lib/labels";
import type { ConversaResumo, PessoasVinculo, ThreadConversa } from "@/server/whatsapp/consultas";
import {
  buscarVinculosInbox,
  enviarMidiaInbox,
  enviarTextoInbox,
  marcarConversaLida,
  marcarConversaTratada,
  registrarOptOutContato,
  removerOptOutContato,
  vincularContatoWhatsApp,
} from "@/server/whatsapp/acoes";
import { registrarPromessaPagamento } from "@/server/cobrancas/acoes";
import { definirTemperatura, moverEtapa, registrarNotaInterna } from "@/server/comercial/acoes";
import { PagamentoModal } from "@/components/PagamentoModal";

// UI da inbox (doc 26 §Camada 3). O componente NÃO fala com o Prisma: página server
// carrega lista + thread; toda mutação é Server Action (docs/13 §fronteira).

const btnPri = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const btnSec = "rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50";

function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function diaLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function InboxCliente({
  conversas,
  thread,
  podeCobranca,
}: {
  conversas: ConversaResumo[];
  thread: ThreadConversa | null;
  podeCobranca: boolean;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);

  // Notificação básica (E3): a lista se atualiza sozinha a cada 30s (SSR refresh).
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);

  // Abrir a thread zera as não-lidas (uma vez por conversa aberta).
  const jaLida = useRef<string | null>(null);
  const conversaAtual = thread ? conversas.find((c) => c.id === thread.conversaId) : null;
  useEffect(() => {
    if (!thread) return;
    if (jaLida.current === thread.conversaId) return;
    if (conversaAtual && conversaAtual.naoLidas > 0) {
      jaLida.current = thread.conversaId;
      void marcarConversaLida(thread.conversaId).then(() => router.refresh());
    }
  }, [thread, conversaAtual, router]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return conversas;
    return conversas.filter(
      (c) =>
        c.contatoNome.toLowerCase().includes(q) ||
        c.contatoTelefone.includes(q) ||
        (c.vinculo ?? "").toLowerCase().includes(q),
    );
  }, [conversas, busca]);

  return (
    <div>
      {erro && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {nota && <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{nota}</p>}

      <div className="flex h-[calc(100vh-13rem)] min-h-[420px] overflow-hidden rounded-lg border border-gray-200 bg-surface">
        {/* Lista de conversas (não-lidas primeiro) */}
        <div className="flex w-80 shrink-0 flex-col border-r border-gray-200">
          <div className="border-b border-gray-100 p-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar contato…"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtradas.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">
                {conversas.length === 0
                  ? "Nenhuma conversa ainda — elas nascem do primeiro inbound ou envio."
                  : "Nada nesta busca."}
              </p>
            ) : (
              filtradas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/inbox?c=${c.id}`)}
                  className={
                    "block w-full border-b border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50 " +
                    (thread?.conversaId === c.id ? "bg-brand-50" : "")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={"truncate text-sm " + (c.naoLidas > 0 ? "font-medium text-gray-800" : "text-gray-700")}>
                      {c.contatoNome}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {c.ultimaMensagemEm && (
                        <span className="text-[10px] text-gray-400">{horaCurta(c.ultimaMensagemEm)}</span>
                      )}
                      {c.naoLidas > 0 && (
                        <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                          {c.naoLidas}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-gray-500">{c.preview ?? "—"}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{c.numeroRotulo}</span>
                    {c.vinculo && (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">{c.vinculo}</span>
                    )}
                    {c.optOut && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">opt-out</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        {thread ? (
          <Thread
            key={thread.conversaId}
            thread={thread}
            podeCobranca={podeCobranca}
            onErro={setErro}
            onNota={setNota}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Escolha uma conversa ao lado.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread
// ---------------------------------------------------------------------------

function StatusEnvio({ status }: { status: string }) {
  if (status === "FALHOU") return <IconAlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  if (status === "LIDA") return <IconChecks className="h-3.5 w-3.5 text-blue-500" />;
  if (status === "ENTREGUE") return <IconChecks className="h-3.5 w-3.5 text-gray-400" />;
  return <IconCheck className="h-3.5 w-3.5 text-gray-400" />;
}

const ORIGEM_LABEL: Record<string, string> = { CRON: "régua", LOTE: "lote", HUMANO: "" };

function Thread({
  thread,
  podeCobranca,
  onErro,
  onNota,
}: {
  thread: ThreadConversa;
  podeCobranca: boolean;
  onErro: (m: string | null) => void;
  onNota: (m: string | null) => void;
}) {
  const router = useRouter();
  const fim = useRef<HTMLDivElement>(null);
  const [vincular, setVincular] = useState(false);
  const [pagar, setPagar] = useState(false);
  const [promessaData, setPromessaData] = useState("");
  const [mostrarPromessa, setMostrarPromessa] = useState(false);
  const optOut = !!thread.contato.optOutEm;

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [thread.mensagens.length, thread.conversaId]);

  async function run(p: Promise<{ ok: boolean; erro?: string }>, msg?: string) {
    onErro(null);
    onNota(null);
    const r = await p;
    if (!r.ok) onErro(r.erro ?? "Erro.");
    else {
      if (msg) onNota(msg);
      router.refresh();
    }
  }

  // Agrupamento por dia para os separadores.
  const grupos = useMemo(() => {
    const out: { dia: string; mensagens: ThreadConversa["mensagens"] }[] = [];
    for (const m of thread.mensagens) {
      const dia = diaLabel(m.criadoEm);
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.dia === dia) ultimo.mensagens.push(m);
      else out.push({ dia, mensagens: [m] });
    }
    return out;
  }, [thread.mensagens]);

  const vinculos = [
    thread.contato.alunoId && { label: `aluno · ${thread.contato.alunoNome}`, href: `/alunos/${thread.contato.alunoId}` },
    thread.contato.responsavelId && { label: `responsável · ${thread.contato.responsavelNome}`, href: null },
    thread.contato.leadId && { label: `lead · ${thread.contato.leadNome}`, href: `/leads/${thread.contato.leadId}` },
  ].filter(Boolean) as { label: string; href: string | null }[];

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Cabeçalho da conversa */}
      <div className="border-b border-gray-200 px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-gray-800">{thread.contato.nome}</span>
              <span className="text-xs text-gray-400">{thread.contato.telefone}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-600">
                {thread.numero.rotulo} · {thread.numero.driver === "META_CLOUD" ? "oficial" : "baileys"}
              </span>
              {/* Indicador da janela de 24h — só em número oficial (doc 26 §Camada 3). */}
              {thread.janela24h &&
                (thread.janela24h.aberta ? (
                  <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-green-700">
                    janela 24h aberta até {horaCurta(thread.janela24h.fechaEm!)}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700">
                    janela 24h fechada — texto livre pode ser recusado (use template)
                  </span>
                ))}
              {vinculos.map((v) =>
                v.href ? (
                  <Link key={v.label} href={v.href} className="rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700 hover:underline">
                    {v.label} →
                  </Link>
                ) : (
                  <span key={v.label} className="rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700">
                    {v.label}
                  </span>
                ),
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button className={btnSec} onClick={() => setVincular((v) => !v)}>
              <span className="flex items-center gap-1">
                <IconLink className="h-3.5 w-3.5" /> Vincular
              </span>
            </button>
            {optOut ? (
              <button
                className={btnSec}
                onClick={() => run(removerOptOutContato(thread.contato.id), "Opt-out removido — envios liberados.")}
              >
                Remover opt-out
              </button>
            ) : (
              <button
                className={btnSec}
                onClick={() => run(registrarOptOutContato(thread.contato.id), "Opt-out registrado — automações bloqueadas.")}
              >
                Registrar opt-out
              </button>
            )}
          </div>
        </div>
      </div>

      {vincular && (
        <VincularPainel
          contatoId={thread.contato.id}
          onFechar={() => setVincular(false)}
          onFeito={(msg) => {
            setVincular(false);
            void run(Promise.resolve({ ok: true }), msg);
          }}
          onErro={onErro}
        />
      )}

      {/* Avisos de estado */}
      {optOut && (
        <div className="border-b border-gray-100 bg-red-50 px-4 py-2 text-xs text-red-700">
          O contato pediu opt-out em {diaLabel(thread.contato.optOutEm!)} — nenhuma mensagem sai por aqui
          (nem automática) até remover.
        </div>
      )}
      {!optOut && thread.silencio.ativo && (
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <span>
            Régua automática em silêncio até {new Date(thread.silencio.ate!).toLocaleString("pt-BR")} — o contato
            respondeu e ninguém tratou (S4).
          </span>
          {podeCobranca && (
            <button
              className="shrink-0 rounded-md border border-amber-300 px-2 py-0.5 text-amber-800 hover:bg-amber-100"
              onClick={() =>
                run(
                  marcarConversaTratada({ conversaId: thread.conversaId, motivo: "retomar_regua" }),
                  "Régua retomada — o silêncio pós-resposta foi liberado.",
                )
              }
            >
              Retomar régua
            </button>
          )}
        </div>
      )}

      {/* Ação rápida contextual (cobrança ativa) */}
      {thread.cobrancaAtiva && podeCobranca && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-surface-muted px-4 py-2 text-xs text-gray-700">
          <span>
            Cobrança ativa · {thread.cobrancaAtiva.alunoNome} ·{" "}
            {formatarMoeda(
              thread.cobrancaAtiva.saldo > 0 ? thread.cobrancaAtiva.saldo : thread.cobrancaAtiva.valorNegociado,
              thread.cobrancaAtiva.moeda,
            )}{" "}
            · vence {diaLabel(thread.cobrancaAtiva.vencimento)}
          </span>
          <button className={btnSec} onClick={() => setPagar(true)}>
            Registrar pagamento
          </button>
          <button className={btnSec} onClick={() => setMostrarPromessa((v) => !v)}>
            Promessa de pagamento
          </button>
          {mostrarPromessa && (
            <span className="flex items-center gap-1.5">
              <input
                type="date"
                value={promessaData}
                onChange={(e) => setPromessaData(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-0.5 text-xs outline-none focus:border-brand-500"
              />
              <button
                className={btnSec}
                disabled={!promessaData}
                onClick={async () => {
                  const r = await registrarPromessaPagamento(thread.cobrancaAtiva!.id, promessaData);
                  if (!r.ok) return onErro(r.erro ?? "Erro.");
                  await marcarConversaTratada({ conversaId: thread.conversaId, motivo: "promessa" });
                  setMostrarPromessa(false);
                  onNota("Promessa registrada — régua pausada até a data.");
                  router.refresh();
                }}
              >
                Registrar
              </button>
            </span>
          )}
        </div>
      )}

      {/* Cockpit do vendedor: funil do lead sem sair da conversa (doc 08 §CRM pela conversa) */}
      {thread.lead && <CockpitLead lead={thread.lead} onErro={onErro} onNota={onNota} />}

      {/* Mensagens */}
      <div className="flex-1 space-y-2 overflow-y-auto bg-surface-muted px-4 py-3">
        {grupos.map((g) => (
          <div key={g.dia}>
            <div className="my-2 text-center text-[10px] text-gray-400">{g.dia}</div>
            <div className="space-y-1.5">
              {g.mensagens.map((m) => (
                <Bolha key={m.id} m={m} />
              ))}
            </div>
          </div>
        ))}
        <div ref={fim} />
      </div>

      {/* Composer */}
      <Composer
        conversaId={thread.conversaId}
        desabilitado={optOut || !thread.numero.ativo}
        motivoDesabilitado={optOut ? "Contato em opt-out." : !thread.numero.ativo ? "Número inativo." : null}
        onErro={onErro}
        onNota={onNota}
      />

      {pagar && thread.cobrancaAtiva && (
        <PagamentoModal
          cobrancaId={thread.cobrancaAtiva.id}
          alunoNome={thread.cobrancaAtiva.alunoNome}
          moeda={thread.cobrancaAtiva.moeda}
          valorEsperado={thread.cobrancaAtiva.valorNegociado}
          jaRecebido={thread.cobrancaAtiva.valorRecebido}
          saldoRestante={thread.cobrancaAtiva.saldo}
          onClose={() => setPagar(false)}
          onDone={async () => {
            setPagar(false);
            await marcarConversaTratada({ conversaId: thread.conversaId, motivo: "pagamento" });
            onNota("Pagamento registrado.");
            router.refresh();
          }}
          onErro={onErro}
        />
      )}
    </div>
  );
}

function Bolha({ m }: { m: ThreadConversa["mensagens"][number] }) {
  const saida = m.direcao === "SAIDA";
  const origem = saida ? (m.origem ? (ORIGEM_LABEL[m.origem] ?? "") : "celular") : "";
  return (
    <div className={"flex " + (saida ? "justify-end" : "justify-start")}>
      <div
        className={
          "max-w-[75%] rounded-lg px-3 py-1.5 text-sm " +
          (saida ? "bg-brand-50 text-gray-800" : "border border-gray-200 bg-surface text-gray-800")
        }
      >
        {m.midiaPath && <Midia m={m} />}
        {m.corpo && <p className="whitespace-pre-wrap break-words">{m.corpo}</p>}
        {!m.corpo && !m.midiaPath && <p className="italic text-gray-400">[{m.tipo.toLowerCase()}]</p>}
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-gray-400">
          {m.templateNome && <span>template {m.templateNome} ·</span>}
          {origem && <span>{origem} ·</span>}
          {m.autorNome && <span>{m.autorNome} ·</span>}
          <span>{horaCurta(m.criadoEm)}</span>
          {saida && <StatusEnvio status={m.status} />}
        </div>
      </div>
    </div>
  );
}

function Midia({ m }: { m: ThreadConversa["mensagens"][number] }) {
  if (!m.midiaPath) return null;
  if (m.tipo === "IMAGEM") {
    return (
      <a href={m.midiaPath} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.midiaPath} alt="imagem recebida" className="mb-1 max-h-64 rounded-md" />
      </a>
    );
  }
  if (m.tipo === "AUDIO") {
    return <audio controls src={m.midiaPath} className="mb-1 h-10 max-w-full" preload="none" />;
  }
  if (m.tipo === "VIDEO") {
    return <video controls src={m.midiaPath} className="mb-1 max-h-64 rounded-md" preload="none" />;
  }
  return (
    <a href={m.midiaPath} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-1 text-brand-700 hover:underline">
      <IconPaperclip className="h-3.5 w-3.5" /> abrir documento
    </a>
  );
}

// ---------------------------------------------------------------------------
// Composer: texto + anexo + gravação de áudio no navegador (doc 26 §Camada 3)
// ---------------------------------------------------------------------------

const NOTA_POR_STATUS: Record<string, string> = {
  DESPACHADA: "Mensagem enviada.",
  SIMULADA: "Ensaio (shadow): registrado sem envio real — ambiente sem WHATSAPP_LIVE.",
  PENDENTE: "Na fila de envio.",
};

function Composer({
  conversaId,
  desabilitado,
  motivoDesabilitado,
  onErro,
  onNota,
}: {
  conversaId: string;
  desabilitado: boolean;
  motivoDesabilitado: string | null;
  onErro: (m: string | null) => void;
  onNota: (m: string | null) => void;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<BlobPart[]>([]);

  function tratarResultado(r: { ok: boolean; erro?: string; dado?: { status: string; motivo: string | null } }) {
    if (!r.ok) return onErro(r.erro ?? "Erro ao enviar.");
    const d = r.dado!;
    if (d.status === "FALHOU") onErro(`Envio falhou: ${d.motivo ?? "erro"}.`);
    else onNota(NOTA_POR_STATUS[d.status] ?? `Estado: ${d.status}.`);
    router.refresh();
  }

  async function enviarTexto() {
    const corpo = texto.trim();
    if (!corpo || enviando) return;
    setEnviando(true);
    onErro(null);
    onNota(null);
    const r = await enviarTextoInbox({ conversaId, texto: corpo });
    setEnviando(false);
    if (r.ok) setTexto("");
    tratarResultado(r);
  }

  async function subirEEnviar(file: File, legenda = "") {
    setEnviando(true);
    onErro(null);
    onNota(null);
    try {
      const form = new FormData();
      form.append("file", file);
      // Upload dedicado da inbox (review PR #51 P1-2): grava em whatsapp-out/<autor>/ —
      // a action de envio só aceita anexos desta pasta do próprio autor.
      const up = await fetch("/api/whatsapp/upload", { method: "POST", body: form });
      const json = (await up.json()) as { url?: string; erro?: string };
      if (!up.ok || !json.url) {
        onErro(json.erro ?? "Falha no upload.");
        return;
      }
      tratarResultado(await enviarMidiaInbox({ conversaId, url: json.url, legenda }));
    } finally {
      setEnviando(false);
    }
  }

  async function alternarGravacao() {
    onErro(null);
    if (gravando) {
      gravadorRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Preferência: ogg/opus (formato que a Meta aceita); Chrome só grava webm/opus.
      const mime = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "audio/webm;codecs=opus";
      const gravador = new MediaRecorder(stream, { mimeType: mime });
      pedacosRef.current = [];
      gravador.ondataavailable = (e) => pedacosRef.current.push(e.data);
      gravador.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setGravando(false);
        const tipoBase = mime.split(";")[0];
        const ext = tipoBase === "audio/ogg" ? "ogg" : "webm";
        const blob = new Blob(pedacosRef.current, { type: tipoBase });
        void subirEEnviar(new File([blob], `audio-${Date.now()}.${ext}`, { type: tipoBase }));
      };
      gravadorRef.current = gravador;
      gravador.start();
      setGravando(true);
    } catch {
      onErro("Sem acesso ao microfone — verifique a permissão do navegador.");
    }
  }

  if (desabilitado) {
    return (
      <div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-400">
        {motivoDesabilitado ?? "Envio indisponível."}
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 px-3 py-2.5">
      <div className="flex items-end gap-2">
        <input
          ref={arquivoRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,audio/ogg,audio/mpeg,audio/mp4,video/mp4"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void subirEEnviar(f);
          }}
        />
        <button
          className="rounded-md p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          title="Anexar arquivo"
          aria-label="Anexar arquivo"
          disabled={enviando || gravando}
          onClick={() => arquivoRef.current?.click()}
        >
          <IconPaperclip className="h-4 w-4" />
        </button>
        <button
          className={
            "rounded-md p-2 disabled:opacity-50 " +
            (gravando ? "bg-red-100 text-red-700" : "text-gray-500 hover:bg-gray-50")
          }
          title={gravando ? "Parar e enviar" : "Gravar áudio"}
          aria-label={gravando ? "Parar e enviar" : "Gravar áudio"}
          disabled={enviando}
          onClick={alternarGravacao}
        >
          {gravando ? <IconPlayerStopFilled className="h-4 w-4" /> : <IconMicrophone className="h-4 w-4" />}
        </button>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviarTexto();
            }
          }}
          rows={1}
          placeholder={gravando ? "Gravando áudio…" : "Escreva uma mensagem (Enter envia)"}
          className="max-h-32 flex-1 resize-y rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
          disabled={gravando}
        />
        <button
          className={btnPri}
          disabled={enviando || gravando || !texto.trim()}
          onClick={enviarTexto}
          aria-label="Enviar"
        >
          <IconSend2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel de vínculo contato → aluno / responsável / lead
// ---------------------------------------------------------------------------

function VincularPainel({
  contatoId,
  onFechar,
  onFeito,
  onErro,
}: {
  contatoId: string;
  onFechar: () => void;
  onFeito: (msg: string) => void;
  onErro: (m: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<PessoasVinculo | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const termo = q.trim();
    // Todo setState dentro do callback do timer (react-hooks/set-state-in-effect).
    const t = setTimeout(
      async () => {
        if (termo.length < 2) {
          setResultados(null);
          return;
        }
        setBuscando(true);
        const r = await buscarVinculosInbox(termo);
        setBuscando(false);
        if (r.ok) setResultados(r.dado!);
      },
      termo.length < 2 ? 0 : 300,
    );
    return () => clearTimeout(t);
  }, [q]);

  async function vincular(alvo: { tipo: "aluno" | "responsavel" | "lead"; id: string }, nome: string) {
    const r = await vincularContatoWhatsApp({ contatoId, alvo });
    if (!r.ok) return onErro(r.erro ?? "Erro ao vincular.");
    onFeito(`Contato vinculado a ${nome}.`);
  }

  return (
    <div className="border-b border-gray-200 bg-surface-muted px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar aluno, responsável ou lead pelo nome…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
        <button className="text-gray-400 hover:text-gray-700" onClick={onFechar} aria-label="Fechar">
          <IconX className="h-4 w-4" />
        </button>
      </div>
      {buscando && <p className="mt-2 text-xs text-gray-400">Buscando…</p>}
      {resultados && (
        <div className="mt-2 grid gap-3 text-xs sm:grid-cols-3">
          <GrupoVinculo
            titulo="Alunos"
            itens={resultados.alunos.map((a) => ({ id: a.id, nome: a.nome }))}
            onEscolher={(i) => vincular({ tipo: "aluno", id: i.id }, i.nome)}
          />
          <GrupoVinculo
            titulo="Responsáveis"
            itens={resultados.responsaveis.map((r) => ({ id: r.id, nome: r.nome }))}
            onEscolher={(i) => vincular({ tipo: "responsavel", id: i.id }, i.nome)}
          />
          <GrupoVinculo
            titulo="Leads"
            itens={resultados.leads.map((l) => ({ id: l.id, nome: `${l.nome}${l.codigo ? ` (${l.codigo})` : ""}` }))}
            onEscolher={(i) => vincular({ tipo: "lead", id: i.id }, i.nome)}
          />
        </div>
      )}
    </div>
  );
}

// COCKPIT DO VENDEDOR (doc 08 §CRM pela conversa): etapa do funil, temperatura e nota
// interna sem sair da thread. Só aparece se o contato tem lead vinculado E o usuário é
// comercial — o gate real é do servidor (carregarThread devolve `lead: null` para quem
// não pode ver), aqui é só render.
//
// A nota interna vive num bloco VISUALMENTE distinto do composer (fundo âmbar, cadeado,
// aviso explícito): o pior erro possível seria o vendedor achar que comentou e ter
// mandado para o cliente — ou o contrário. Nunca colocar nota e mensagem no mesmo campo.
function CockpitLead({
  lead,
  onErro,
  onNota,
}: {
  lead: NonNullable<ThreadConversa["lead"]>;
  onErro: (m: string) => void;
  onNota: (m: string) => void;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [texto, setTexto] = useState("");
  const [abrirNotas, setAbrirNotas] = useState(false);

  async function run(p: Promise<{ ok: boolean; erro?: string }>, sucesso: string): Promise<boolean> {
    setOcupado(true);
    try {
      const r = await p;
      if (!r.ok) {
        onErro(r.erro ?? "Não foi possível concluir.");
        return false;
      }
      onNota(sucesso);
      router.refresh();
      return true;
    } finally {
      setOcupado(false);
    }
  }

  const etapa = lead.etapa as EtapaLead;
  const temperatura = lead.temperatura as Temperatura;

  return (
    <div className="border-b border-gray-100 bg-white px-4 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link href={`/leads/${lead.id}`} className="font-medium text-gray-700 hover:underline">
          {lead.nome} →
        </Link>

        {/* Etapa: atual + destinos manuais válidos (a máquina de estados já filtrou no servidor) */}
        <span className="flex items-center gap-1">
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-700">{ETAPA_LABEL[etapa]}</span>
          {lead.etapasPermitidas.map((destino) => (
            <button
              key={destino}
              disabled={ocupado}
              className={btnSec}
              onClick={() =>
                run(
                  moverEtapa(lead.id, destino as EtapaLead),
                  `Etapa alterada para ${ETAPA_LABEL[destino as EtapaLead]}.`,
                )
              }
            >
              → {ETAPA_LABEL[destino as EtapaLead]}
            </button>
          ))}
        </span>

        {/* Temperatura: um clique, sem sair da conversa */}
        <span className="flex items-center gap-1">
          {(Object.keys(TEMPERATURA_LABEL) as Temperatura[]).map((t) => (
            <button
              key={t}
              disabled={ocupado || t === temperatura}
              title={t === temperatura ? "Temperatura atual" : `Marcar como ${TEMPERATURA_LABEL[t]}`}
              className={
                "rounded-full px-1.5 py-0.5 disabled:opacity-100 " +
                (t === temperatura ? TEMPERATURA_CLS[t] : "text-gray-400 hover:bg-gray-100")
              }
              onClick={() => run(definirTemperatura(lead.id, t), `Lead marcado como ${TEMPERATURA_LABEL[t]}.`)}
            >
              {TEMPERATURA_LABEL[t]}
            </button>
          ))}
        </span>

        {lead.dataExperimental && (
          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-violet-700">
            experimental {new Date(lead.dataExperimental).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}

        <button className={btnSec + " ml-auto"} onClick={() => setAbrirNotas((v) => !v)}>
          <span className="flex items-center gap-1">
            <IconLock className="h-3.5 w-3.5" />
            Notas internas{lead.notas.length > 0 ? ` (${lead.notas.length})` : ""}
          </span>
        </button>
      </div>

      {abrirNotas && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
          <p className="mb-1.5 flex items-center gap-1 font-medium text-amber-800">
            <IconLock className="h-3.5 w-3.5" />
            Só a equipe vê — nada aqui é enviado ao contato.
          </p>
          <div className="flex items-start gap-1.5">
            <textarea
              rows={2}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              // Feedback antes do round-trip: o NotaInternaSchema limita em 2000 (review PR #58 P2).
              maxLength={2000}
              placeholder="Ex.: prefere aula à noite, decide com a esposa até sexta."
              className="flex-1 resize-none rounded-md border border-amber-300 bg-white px-2 py-1 outline-none focus:border-amber-500"
            />
            <button
              className={btnPri + " text-xs"}
              disabled={ocupado || texto.trim().length === 0}
              onClick={async () => {
                // Limpa o campo SÓ no sucesso (review PR #58 P2): se o servidor recusa
                // (ex.: >2000 chars), preserva o que foi digitado em vez de apagar tudo.
                const ok = await run(registrarNotaInterna(lead.id, { nota: texto }), "Nota interna salva (não enviada).");
                if (ok) setTexto("");
              }}
            >
              Salvar nota
            </button>
          </div>
          {lead.notas.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-amber-200 pt-2 text-amber-900">
              {lead.notas.map((n) => (
                <li key={n.id}>
                  <span className="text-amber-700">
                    {new Date(n.criadoEm).toLocaleString("pt-BR")} · {n.autorNome ?? "sistema"}
                  </span>{" "}
                  — {n.nota}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function GrupoVinculo({
  titulo,
  itens,
  onEscolher,
}: {
  titulo: string;
  itens: { id: string; nome: string }[];
  onEscolher: (item: { id: string; nome: string }) => void;
}) {
  return (
    <div>
      <div className="mb-1 font-medium text-gray-600">{titulo}</div>
      {itens.length === 0 ? (
        <p className="text-gray-400">Nenhum.</p>
      ) : (
        itens.map((i) => (
          <button
            key={i.id}
            onClick={() => onEscolher(i)}
            className="block w-full truncate rounded px-1.5 py-1 text-left text-gray-700 hover:bg-gray-100"
          >
            {i.nome}
          </button>
        ))
      )}
    </div>
  );
}
