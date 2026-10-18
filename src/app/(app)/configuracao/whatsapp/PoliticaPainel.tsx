"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { DegrauConfig, NumeroConfig, PoliticaConfig, TemplateConfig } from "@/server/whatsapp/consultas";
import { acionarKillSwitchRegua, estimarAlcanceRegua, salvarPoliticaRegua } from "@/server/whatsapp/acoes";
import type { AlcanceRegua } from "@/server/whatsapp/alcance-regua";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
import { botaoClasses } from "@/components/Botao";
import { DRIVER_WHATSAPP_LABEL, rotular } from "@/lib/labels";

// POLÍTICA DA RÉGUA COMO DADO (doc 26 §Camada 1 · doc 30 E4): por degrau (offset,
// template, modo, ativo) e global (janela, dias, teto, silêncio, kill switch, remetente,
// estado desligada/shadow/ativa). LEIS fora da config: D+15 nunca automatiza; trava S1
// (automação só no motor próprio — D38): número de outro driver não arma a política; prontidão S15 validada no servidor ao armar.

const btnPri = botaoClasses({ tamanho: "md" });
const inputCls = "rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand-500";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const ESTADO_HINT: Record<string, string> = {
  DESLIGADA: "Nada roda: o cron nem gera intenções.",
  SHADOW: "Ensaio: o cron gera intenções SIMULADAS — nada é enviado de verdade.",
  ATIVA: "Valendo: degraus automáticos disparam sozinhos dentro da janela.",
};

/** A estimativa de alcance da ativação (docs/42 L2517), pedida ao servidor quando a confirmação abre. */
type EstadoAlcance = { estado: "carregando" } | { estado: "pronto"; alcance: AlcanceRegua } | { estado: "indisponivel"; motivo: string };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Quantas pessoas recebem: o número primeiro, e o que fica de fora (sem destino) ou depende de aprovação (lote). */
function TextoAlcance({ alcance }: { alcance: EstadoAlcance | null }) {
  if (!alcance || alcance.estado === "carregando") return <p>Calculando quantas pessoas vão receber…</p>;
  if (alcance.estado === "indisponivel") return <p>Não foi possível estimar quantas pessoas vão receber: {alcance.motivo}</p>;
  const a = alcance.alcance;
  return (
    <>
      <p>
        <strong>{a.pessoas === 1 ? "1 pessoa vai receber" : `${a.pessoas} pessoas vão receber`}</strong> mensagem automática de cobrança
        na próxima rodada da régua ({plural(a.cobrancas, "cobrança com degrau automático devido hoje", "cobranças com degrau automático devido hoje")}).
      </p>
      {a.semDestino > 0 && <p>{plural(a.semDestino, "cobrança devida não tem", "cobranças devidas não têm")} destinatário financeiro válido e não {a.semDestino === 1 ? "recebe" : "recebem"}.</p>}
      {a.emLote > 0 && <p>{plural(a.emLote, "cobrança entra", "cobranças entram")} no degrau de lote e só {a.emLote === 1 ? "sai" : "saem"} quando alguém aprovar o lote na fila.</p>}
      <p>É a contagem de agora: as travas da régua (janela, teto por contato, silêncio depois de resposta, opt-out) ainda podem adiar ou barrar parte dos envios.</p>
    </>
  );
}

/** Janela e dias em texto: "9h às 20h, seg, ter, qua, qui, sex". */
function textoJanela(inicio: number, fim: number, dias: number[]): string {
  const nomes = [...dias].sort((a: number, b: number) => a - b).map((d: number) => DIAS[d]).filter((nome: string | undefined): nome is string => !!nome);
  return `${inicio}h às ${fim}h, ${nomes.length ? nomes.join(", ") : "nenhum dia marcado"}`;
}

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

  function mudarDegrau(passo: string, patch: Partial<DegrauConfig>) {
    setForm((f) => ({
      ...f,
      degraus: f.degraus.map((d) => (d.passo === passo ? { ...d, ...patch } : d)),
    }));
  }

  // Sair de desligada/ensaio para ATIVA põe a régua a mandar mensagens reais a clientes (docs/42 L2517):
  // o Salvar, nesse caso, só abre a confirmação com remetente, janela, teto e degraus armados — o mesmo
  // rigor do go-live do piloto. Salvar sem ativar continua direto.
  const ativando = politica.estado !== "ATIVA" && form.estado === "ATIVA";
  const [confirmar, setConfirmar] = useState<"salvar" | "kill" | null>(null);

  function dadosPolitica() {
    return {
      ...form,
      numeroRemetenteId: form.numeroRemetenteId || undefined,
      degraus: form.degraus.map((d: DegrauConfig) => ({
        passo: d.passo as "D-7" | "D-3" | "D0" | "D+3" | "D+7" | "D+15",
        offsetDias: d.offsetDias,
        modo: d.modo as "AUTOMATICO" | "MANUAL" | "LOTE",
        ativo: d.ativo,
        templateId: d.templateId ?? undefined,
      })),
    };
  }
  const SUCESSO_SALVAR = "Política salva — cron, fila e timeline passam a ler esta configuração.";

  // Quantas pessoas recebem (docs/42 L2517): estimado no servidor, com a regra do cron e os degraus do formulário,
  // quando a confirmação da ativação abre. Só a resposta do último pedido vale (o diálogo pode ter sido reaberto).
  const [alcance, setAlcance] = useState<EstadoAlcance | null>(null);
  const pedidoAlcance = useRef(0);
  async function estimarAlcance() {
    const pedido = ++pedidoAlcance.current;
    setAlcance({ estado: "carregando" });
    let proximo: EstadoAlcance;
    try {
      const r = await estimarAlcanceRegua(dadosPolitica());
      proximo = r.ok && r.dado ? { estado: "pronto", alcance: r.dado } : { estado: "indisponivel", motivo: r.ok ? "a consulta não devolveu a contagem." : r.erro };
    } catch {
      proximo = { estado: "indisponivel", motivo: "falha de rede. Confira a fila de cobrança antes de ativar." };
    }
    if (pedido === pedidoAlcance.current) setAlcance(proximo);
  }

  async function salvar() {
    if (ativando) {
      setOrigem("salvar");
      acao.limpar();
      setConfirmar("salvar");
      await estimarAlcance();
      return;
    }
    const desfecho = await run("salvar", () => salvarPoliticaRegua(dadosPolitica()), SUCESSO_SALVAR);
    if (desfecho?.tipo === "ok") router.refresh();
  }

  // O kill switch congela (ou destrava) TODA a automação de cobrança (docs/42 L2516): confirmação nos
  // dois sentidos, dizendo o que para ou o que volta a sair.
  function pedirKill() {
    setOrigem("kill");
    acao.limpar();
    setConfirmar("kill");
  }

  function killConcluido(ligado: boolean) {
    setConfirmar(null);
    setOrigem("kill");
    acao.setSucesso(ligado ? "Kill switch LIGADO — automação congelada (nada se perde)." : "Kill switch desligado.");
    setForm((f) => ({ ...f, killSwitch: ligado }));
    router.refresh();
  }

  const nomeTemplate = new Map(templates.map((t: TemplateConfig): [string, string] => [t.id, t.nome]));
  // Degraus que disparam depois de ativar (ativos, fora do D+15, que é sempre aprovação humana), por modo.
  const armados = (modo: string) => form.degraus
    .filter((d: DegrauConfig) => d.ativo && d.tipo !== "bloquear" && d.modo === modo)
    .map((d: DegrauConfig) => `${d.passo} (${d.templateId ? nomeTemplate.get(d.templateId) ?? "template" : "texto de fábrica"})`)
    .join("; ");
  const armadosAutomaticos = armados("AUTOMATICO");
  const armadosEmLote = armados("LOTE");

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
          onClick={pedirKill}
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
                    {n.rotulo} ({rotular(DRIVER_WHATSAPP_LABEL, n.driver)})
                  </option>
                ))}
            </select>
            {remetente && remetente.driver !== "MOTOR" && (
              <span className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                <IconAlertTriangle className="h-3 w-3" /> Só números do motor WhatsApp enviam a política. Escolha um número do motor para armar.
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
            <div role="group" aria-label="Dias da semana" className="mt-1.5 flex flex-wrap gap-1">
              {DIAS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={form.diasSemana.includes(i)}
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
                      ? "bg-brand-solid text-on-brand"
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
                                {t.nome}
                              </option>
                            ))}
                          </select>
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
            prontidão: só número do motor WhatsApp arma a política; no motor vale o texto do template.
          </p>
          <button type="button" className={btnPri} disabled={acao.ocupado} onClick={salvar}>
            {acao.ocupado && origem === "salvar" ? "Salvando…" : "Salvar política"}
          </button>
        </div>
        {feedback("salvar")}
      </div>

      {confirmar === "kill" && (
        <ConfirmarAcao
          titulo={form.killSwitch ? "Destravar a automação de cobrança?" : "Congelar toda a automação de cobrança?"}
          confirmacao={form.killSwitch ? "destravamento" : "congelamento"}
          idempotente={false}
          acao={() => acionarKillSwitchRegua(!form.killSwitch)}
          aoConcluir={() => killConcluido(!form.killSwitch)}
          aoCancelar={() => setConfirmar(null)}
        >
          {form.killSwitch ? (
            <>
              <p>A automação volta a seguir o estado salvo da régua. {ESTADO_HINT[politica.estado]}</p>
              {politica.estado === "ATIVA" && (
                <p>
                  Mensagens reais voltam a sair para os clientes: cobranças com degrau devido são enviadas dentro da janela
                  ({textoJanela(politica.janelaInicio, politica.janelaFim, politica.diasSemana)}), e o que ficou parado na fila
                  enquanto a automação estava congelada volta a andar.
                </p>
              )}
            </>
          ) : (
            <p>Nenhuma mensagem automática de cobrança sai enquanto o kill switch estiver ligado. O que estava na fila fica parado, sem se perder, até alguém destravar.</p>
          )}
        </ConfirmarAcao>
      )}

      {confirmar === "salvar" && (
        <ConfirmarAcao
          titulo="Ativar a régua de cobrança e enviar mensagens reais?"
          confirmacao="ativação da régua"
          idempotente={false}
          acao={() => salvarPoliticaRegua(dadosPolitica())}
          aoConcluir={() => {
            setConfirmar(null);
            setOrigem("salvar");
            acao.setSucesso(SUCESSO_SALVAR);
            router.refresh();
          }}
          aoCancelar={() => setConfirmar(null)}
        >
          <p>A régua sai {politica.estado === "SHADOW" ? "do ensaio" : "de desligada"} e passa a <strong>ativa</strong>: os degraus abaixo disparam com mensagens reais aos clientes.</p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>Remetente: {remetente ? `${remetente.rotulo} (${rotular(DRIVER_WHATSAPP_LABEL, remetente.driver)})` : "nenhum escolhido"}</li>
            <li>Janela: {textoJanela(form.janelaInicio, form.janelaFim, form.diasSemana)} (hora local do contato)</li>
            <li>Teto: {form.tetoPorContatoDia} {form.tetoPorContatoDia === 1 ? "mensagem automática" : "mensagens automáticas"} por contato/dia</li>
            <li>Automáticos (saem sozinhos): {armadosAutomaticos || "nenhum"}</li>
            <li>Em lote (saem quando alguém aprova o lote): {armadosEmLote || "nenhum"}</li>
          </ul>
          <TextoAlcance alcance={alcance} />
          {form.killSwitch && <p>O kill switch está ligado: nada sai até alguém destravar.</p>}
          <p>Mensagem enviada não volta atrás; para parar depois, use o kill switch.</p>
        </ConfirmarAcao>
      )}
    </section>
  );
}
