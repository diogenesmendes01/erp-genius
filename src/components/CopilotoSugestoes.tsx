"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconSparkles } from "@tabler/icons-react";
import type { SugestaoPendente } from "@/server/ia/consultas";
import { aceitarSugestao, corrigirSugestao, descartarSugestao, gerarSugestoesLead } from "@/server/ia/acoes";

// C3 (doc 27): sugestões do copiloto embutidas ONDE O VENDEDOR JÁ ESTÁ (ficha do lead e
// cockpit da inbox) — sugestão sobre controles que já existem, nunca uma segunda forma de
// editar o lead. Aceitar/corrigir/descartar em 1 clique; cada decisão alimenta a
// métrica-gate. A IA é só-leitura: nada aqui envia mensagem ao lead.

const TIPO_LABEL: Record<string, string> = {
  RESUMO: "Resumo executivo",
  TEMPERATURA: "Temperatura",
  SEGMENTO: "Segmento",
  ETAPA: "Etapa do funil",
};

const CAMPO_LABEL: Record<string, string> = {
  interesse: "Interesse",
  objetivo: "Objetivo",
  urgencia: "Urgência",
  orcamento: "Orçamento",
  objecao: "Objeção",
  proximaAcao: "Próximo passo",
};

const VALOR_LABEL: Record<string, string> = {
  QUENTE: "Quente",
  MORNO: "Morno",
  FRIO: "Frio",
  ADULTO: "Adulto",
  KIDS: "Kids",
  TEENS: "Teens",
  EMPRESA: "Empresa",
  NOVO: "Novo",
  EM_ATENDIMENTO: "Em atendimento",
  QUALIFICADO: "Qualificado",
  EXPERIMENTAL_AGENDADA: "Experimental agendada",
};

const btnMini = "rounded-md px-2 py-0.5 text-xs font-medium disabled:opacity-60";

function valorDaSugestao(s: SugestaoPendente): string {
  const p = s.payload as Record<string, unknown>;
  if (s.tipo === "TEMPERATURA") return VALOR_LABEL[String(p.temperatura)] ?? String(p.temperatura);
  if (s.tipo === "SEGMENTO") return VALOR_LABEL[String(p.segmento)] ?? String(p.segmento);
  if (s.tipo === "ETAPA") return VALOR_LABEL[String(p.etapa)] ?? String(p.etapa);
  return "";
}

export function CopilotoSugestoes({
  leadId,
  sugestoes,
  copilotoAtivo,
  compacto = false,
}: {
  leadId: string;
  sugestoes: SugestaoPendente[];
  copilotoAtivo: boolean;
  /** true na inbox (cockpit): menos respiro, sem card externo. */
  compacto?: boolean;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<Record<string, string>>({});

  if (!copilotoAtivo && sugestoes.length === 0) return null;

  async function run(id: string, p: Promise<{ ok: boolean; erro?: string }>) {
    setOcupado(id);
    setErro(null);
    const r = await p;
    setOcupado(null);
    if (!r.ok) setErro(r.erro ?? "Não foi possível concluir.");
    else router.refresh();
  }

  function abrirCorrecao(s: SugestaoPendente) {
    const resumo = ((s.payload as Record<string, unknown>).resumo ?? {}) as Record<string, string | null>;
    setEdicao(Object.fromEntries(Object.keys(CAMPO_LABEL).map((c) => [c, resumo[c] ?? ""])));
    setEditando(s.id);
  }

  function salvarCorrecao(s: SugestaoPendente) {
    const resumo = Object.fromEntries(
      Object.entries(edicao).map(([c, v]) => [c, v.trim() ? v.trim() : null]),
    );
    setEditando(null);
    void run(s.id, corrigirSugestao(s.id, { resumo }));
  }

  return (
    <section
      className={
        compacto
          ? "border-b border-violet-100 bg-violet-50/60 px-4 py-2"
          : "rounded-lg border border-violet-200 bg-violet-50/60 p-4"
      }
      aria-label="Sugestões do copiloto"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-violet-700">
          <IconSparkles className="h-3.5 w-3.5" />
          Copiloto (sugestões — nada é aplicado sem você)
        </div>
        <button
          className={btnMini + " border border-violet-300 text-violet-700 hover:bg-violet-100"}
          disabled={ocupado === "gerar" || !copilotoAtivo}
          title={copilotoAtivo ? "Analisar a conversa agora" : "Copiloto desligado na configuração"}
          onClick={() => run("gerar", gerarSugestoesLead(leadId))}
        >
          {ocupado === "gerar" ? "Analisando…" : "Gerar sugestões"}
        </button>
      </div>

      {erro && <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{erro}</p>}

      {sugestoes.length === 0 ? (
        <p className="mt-1 text-xs text-violet-600/80">Sem sugestões pendentes.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {sugestoes.map((s) => (
            <li key={s.id} className="rounded-md border border-violet-200 bg-surface px-2.5 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium text-gray-800">{TIPO_LABEL[s.tipo] ?? s.tipo}</span>
                  {s.tipo !== "RESUMO" && (
                    <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-violet-700">
                      {valorDaSugestao(s)}
                    </span>
                  )}
                  <span className="ml-1.5 text-gray-400">({s.modelo})</span>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    className={btnMini + " bg-success text-white hover:opacity-90"}
                    disabled={ocupado === s.id}
                    onClick={() => run(s.id, aceitarSugestao(s.id))}
                  >
                    Aceitar
                  </button>
                  {s.tipo === "RESUMO" && (
                    <button
                      className={btnMini + " border border-gray-300 text-gray-600 hover:bg-gray-50"}
                      disabled={ocupado === s.id}
                      onClick={() => (editando === s.id ? setEditando(null) : abrirCorrecao(s))}
                    >
                      Corrigir
                    </button>
                  )}
                  <button
                    className={btnMini + " border border-gray-300 text-gray-500 hover:bg-gray-50"}
                    disabled={ocupado === s.id}
                    onClick={() => run(s.id, descartarSugestao(s.id))}
                  >
                    Descartar
                  </button>
                </div>
              </div>

              {s.tipo === "RESUMO" && editando !== s.id && (
                <dl className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-0.5 text-gray-600 sm:grid-cols-2">
                  {Object.entries(
                    ((s.payload as Record<string, unknown>).resumo ?? {}) as Record<string, string | null>,
                  )
                    .filter(([, v]) => v)
                    .map(([campo, valor]) => (
                      <div key={campo} className="flex gap-1">
                        <dt className="shrink-0 font-medium text-gray-500">{CAMPO_LABEL[campo] ?? campo}:</dt>
                        <dd className="min-w-0 truncate" title={valor ?? ""}>{valor}</dd>
                      </div>
                    ))}
                </dl>
              )}

              {s.tipo === "RESUMO" && editando === s.id && (
                <div className="mt-1.5 space-y-1">
                  {Object.entries(CAMPO_LABEL).map(([campo, label]) => (
                    <label key={campo} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-gray-500">{label}</span>
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-0.5 text-xs outline-none focus:border-violet-400"
                        value={edicao[campo] ?? ""}
                        onChange={(e) => setEdicao((v) => ({ ...v, [campo]: e.target.value }))}
                      />
                    </label>
                  ))}
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      className={btnMini + " bg-violet-600 text-white hover:bg-violet-700"}
                      disabled={ocupado === s.id}
                      onClick={() => salvarCorrecao(s)}
                    >
                      Aplicar corrigido
                    </button>
                    <button
                      className={btnMini + " border border-gray-300 text-gray-500"}
                      onClick={() => setEditando(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {s.justificativa && <p className="mt-1 text-[11px] italic text-gray-400">{s.justificativa}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
