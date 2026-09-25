"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { DegrauConfig, NumeroConfig, PoliticaConfig, TemplateConfig } from "@/server/whatsapp/consultas";
import { acionarKillSwitchRegua, salvarPoliticaRegua } from "@/server/whatsapp/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
import { botaoClasses } from "@/components/Botao";

// POLÍTICA DA RÉGUA COMO DADO (doc 26 §Camada 1 · doc 30 E4): por degrau (offset,
// template, modo, ativo) e global (janela, dias, teto, silêncio, kill switch, remetente,
// estado desligada/shadow/ativa). LEIS fora da config: D+15 nunca automatiza; trava S1
// (cron só em driver oficial); prontidão S15 validada no servidor ao armar.

const btnPri = botaoClasses({ tamanho: "md" });
const inputCls = "rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand-500";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const ESTADO_HINT: Record<string, string> = {
  DESLIGADA: "Nada roda: o cron nem gera intenções.",
  SHADOW: "Ensaio: o cron gera intenções SIMULADAS — nada é enviado de verdade.",
  ATIVA: "Valendo: degraus automáticos disparam sozinhos dentro da janela.",
};

export function PoliticaPainel({
  politica,
  numeros,
  templates,
}: {
  politica: PoliticaConfig;
  numeros: NumeroConfig[];
  templates: TemplateConfig[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    estado: politica.estado as "DESLIGADA" | "SHADOW" | "ATIVA",
    janelaInicio: politica.janelaInicio,
    janelaFim: politica.janelaFim,
    diasSemana: politica.diasSemana,
    tetoPorContatoDia: politica.tetoPorContatoDia,
    silencioPosInboundHoras: politica.silencioPosInboundHoras,
    killSwitch: politica.killSwitch,
    numeroRemetenteId: politica.numeroRemetenteId ?? "",
    degraus: politica.degraus as DegrauConfig[],
  });
  // Nenhuma das duas actions recebe chave de idempotência (o kill switch grava o estado-alvo, mas sem
  // chave): resultado incerto manda conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  // O resultado aparece junto do botão que o disparou (kill switch no topo, salvar no rodapé).
  const [origem, setOrigem] = useState<"kill" | "salvar" | null>(null);

  async function run<T>(secao: "kill" | "salvar", disparar: () => Promise<Resultado<T>>, sucesso: string) {
    setOrigem(secao);
    return acao.executar(disparar, sucesso);
  }
  const feedback = (secao: "kill" | "salvar") => (
    <FeedbackAcao erro={origem === secao ? acao.erro : null} sucesso={origem === secao ? acao.sucesso : null} className="mt-3" />
  );

  const remetente = numeros.find((n) => n.id === form.numeroRemetenteId) ?? null;
  const aprovadoPorId = new Map(templates.map((t) => [t.id, t.statusMeta === "APROVADO"]));

  function mudarDegrau(passo: string, patch: Partial<DegrauConfig>) {
    setForm((f) => ({
      ...f,
      degraus: f.degraus.map((d) => (d.passo === passo ? { ...d, ...patch } : d)),
    }));
  }

  async function salvar() {
    const desfecho = await run("salvar", () => salvarPoliticaRegua({
      ...form,
      numeroRemetenteId: form.numeroRemetenteId || undefined,
      degraus: form.degraus.map((d) => ({
        passo: d.passo as "D-7" | "D-3" | "D0" | "D+3" | "D+7" | "D+15",
        offsetDias: d.offsetDias,
        modo: d.modo as "AUTOMATICO" | "MANUAL" | "LOTE",
        ativo: d.ativo,
        templateId: d.templateId ?? undefined,
      })),
    }), "Política salva — cron, fila e timeline passam a ler esta configuração.");
    if (desfecho?.tipo === "ok") router.refresh();
  }

  async function alternarKill() {
    const ligar = !form.killSwitch;
    const d = await run(
      "kill",
      () => acionarKillSwitchRegua(ligar),
      ligar ? "Kill switch LIGADO — automação congelada (nada se perde)." : "Kill switch desligado.",
    );
    if (d?.tipo !== "ok") return;
    setForm((f) => ({ ...f, killSwitch: ligar }));
    router.refresh();
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">Política da régua de cobrança</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            A régua como dado: quem dispara, quando e com qual template. O D+15 (bloqueio) fica fora — aprovação
            humana sempre.
          </p>
        </div>
        <button
          onClick={alternarKill}
          disabled={acao.ocupado}
          className={botaoClasses({ variante: form.killSwitch ? "perigo" : "secundario" })}
        >
          {form.killSwitch ? "Kill switch LIGADO — destravar" : "Kill switch"}
        </button>
      </div>

      {feedback("kill")}

      <div className="mt-4 rounded-lg border border-gray-200 bg-surface p-4">
        {/* Config global */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-gray-600">
            Estado
            <select
              className={inputCls + " mt-1 w-full"}
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value as typeof form.estado })}
            >
              <option value="DESLIGADA">desligada</option>
              <option value="SHADOW">shadow (ensaio)</option>
              <option value="ATIVA">ativa</option>
            </select>
            <span className="mt-1 block text-[11px] text-gray-400">{ESTADO_HINT[form.estado]}</span>
          </label>
          <label className="text-xs text-gray-600">
            Número remetente
            <select
              className={inputCls + " mt-1 w-full"}
              value={form.numeroRemetenteId}
              onChange={(e) => setForm({ ...form, numeroRemetenteId: e.target.value })}
            >
              <option value="">— escolha —</option>
              {numeros
                .filter((n) => n.ativo)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.rotulo} ({n.driver === "META_CLOUD" ? "oficial" : "baileys"})
                  </option>
                ))}
            </select>
            {remetente && remetente.driver !== "META_CLOUD" && (
              <span className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                <IconAlertTriangle className="h-3 w-3" /> trava S1: degraus automáticos exigem número oficial
              </span>
            )}
          </label>
          <label className="text-xs text-gray-600">
            Janela de envio (hora local do contato)
            <span className="mt-1 flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={23}
                className={inputCls + " w-16"}
                value={form.janelaInicio}
                onChange={(e) => setForm({ ...form, janelaInicio: Number(e.target.value) })}
              />
              <span className="text-gray-400">às</span>
              <input
                type="number"
                min={1}
                max={24}
                className={inputCls + " w-16"}
                value={form.janelaFim}
                onChange={(e) => setForm({ ...form, janelaFim: Number(e.target.value) })}
              />
              <span className="text-gray-400">h</span>
            </span>
          </label>
          <div className="text-xs text-gray-600">
            Dias da semana
            <div className="mt-1.5 flex flex-wrap gap-1">
              {DIAS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      diasSemana: f.diasSemana.includes(i)
                        ? f.diasSemana.filter((x) => x !== i)
                        : [...f.diasSemana, i].sort(),
                    }))
                  }
                  className={
                    "rounded-full px-2 py-0.5 text-[11px] " +
                    (form.diasSemana.includes(i)
                      ? "bg-brand-600 text-white"
                      : "border border-gray-300 text-gray-500 hover:bg-gray-50")
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <label className="text-xs text-gray-600">
            Teto por contato/dia (S5)
            <input
              type="number"
              min={1}
              max={10}
              className={inputCls + " mt-1 w-20"}
              value={form.tetoPorContatoDia}
              onChange={(e) => setForm({ ...form, tetoPorContatoDia: Number(e.target.value) })}
            />
            <span className="ml-2 text-[11px] text-gray-400">mensagens automáticas somando todas as políticas</span>
          </label>
          <label className="text-xs text-gray-600">
            Silêncio pós-resposta (S4)
            <input
              type="number"
              min={0}
              max={720}
              className={inputCls + " mt-1 w-20"}
              value={form.silencioPosInboundHoras}
              onChange={(e) => setForm({ ...form, silencioPosInboundHoras: Number(e.target.value) })}
            />
            <span className="ml-2 text-[11px] text-gray-400">horas sem cron após resposta não tratada</span>
          </label>
        </div>

        {/* Degraus */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="py-2 pr-3 font-medium">Degrau</th>
                <th className="py-2 pr-3 font-medium">Offset (dias)</th>
                <th className="py-2 pr-3 font-medium">Modo</th>
                <th className="py-2 pr-3 font-medium">Template</th>
                <th className="py-2 font-medium">Ativo</th>
              </tr>
            </thead>
            <tbody>
              {form.degraus.map((d) => {
                const bloquear = d.tipo === "bloquear";
                const precisaAprovado =
                  remetente?.driver === "META_CLOUD" && d.ativo && d.modo !== "MANUAL" && form.estado !== "DESLIGADA";
                const templateOk = d.templateId ? aprovadoPorId.get(d.templateId) : false;
                return (
                  <tr key={d.passo} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="font-medium text-gray-800">{d.passo}</span>
                      <span className="ml-2 text-xs text-gray-400">{d.rotulo}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={-30}
                        max={90}
                        aria-label={`${d.passo} — offset (dias)`}
                        className={inputCls + " w-20"}
                        value={d.offsetDias}
                        onChange={(e) => mudarDegrau(d.passo, { offsetDias: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      {bloquear ? (
                        <span className="text-xs text-gray-500">manual (lei: aprovação humana sempre)</span>
                      ) : (
                        <select
                          aria-label={`${d.passo} — modo`}
                          className={inputCls}
                          value={d.modo}
                          onChange={(e) => mudarDegrau(d.passo, { modo: e.target.value })}
                        >
                          <option value="AUTOMATICO">automático</option>
                          <option value="LOTE">lote com aprovação</option>
                          <option value="MANUAL">manual</option>
                        </select>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {bloquear ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <select
                            aria-label={`${d.passo} — template`}
                            className={inputCls + " max-w-48"}
                            value={d.templateId ?? ""}
                            onChange={(e) => mudarDegrau(d.passo, { templateId: e.target.value || null })}
                          >
                            <option value="">— texto de fábrica —</option>
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.nome} {t.statusMeta === "APROVADO" ? "✓" : `(${t.statusMeta.toLowerCase().replace("_", " ")})`}
                              </option>
                            ))}
                          </select>
                          {precisaAprovado && !templateOk && (
                            <span title="Número oficial: degrau armado exige template aprovado na Meta">
                              <IconAlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        aria-label={`${d.passo} — ativo`}
                        className="h-3.5 w-3.5 accent-brand-600"
                        checked={d.ativo}
                        onChange={(e) => mudarDegrau(d.passo, { ativo: e.target.checked })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] text-gray-400">
            Defaults de fábrica: D-7/D-3/D0 automáticos · D+3/D+7 lote · D+15 aprovação. Armar (shadow/ativa) valida a
            prontidão: número oficial exige template aprovado nos degraus automáticos/lote.
          </p>
          <button type="button" className={btnPri} disabled={acao.ocupado} onClick={salvar}>
            {acao.ocupado && origem === "salvar" ? "Salvando…" : "Salvar política"}
          </button>
        </div>
        {feedback("salvar")}
      </div>
    </section>
  );
}
