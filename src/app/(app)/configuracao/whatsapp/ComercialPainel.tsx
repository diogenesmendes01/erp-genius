"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConfigComercialView, SaudacaoSimulada } from "@/server/comercial/consultas";
import type { MetricaCopilotoTipo } from "@/server/ia/consultas";
import { salvarConfigComercial } from "@/server/comercial/acoes";

// COMERCIAL — C1 (doc 27): auto-lead + saudação automática. Toggles INDEPENDENTES, ambos
// nascem desligados (regra de ouro: toda automação nasce desligada). A saudação é a única
// mensagem automática que o robô manda ao lead nesta fase — texto fixo, nunca IA.

const btnPri = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500";

const TIPO_SUGESTAO_LABEL: Record<string, string> = {
  RESUMO: "Resumo executivo",
  TEMPERATURA: "Temperatura",
  SEGMENTO: "Segmento",
  ETAPA: "Etapa do funil",
};

export function ComercialPainel({
  config,
  simuladas,
  metricasCopiloto,
}: {
  config: ConfigComercialView;
  simuladas: SaudacaoSimulada[];
  metricasCopiloto: MetricaCopilotoTipo[];
}) {
  const router = useRouter();
  const [autoLeadAtivo, setAutoLead] = useState(config.autoLeadAtivo);
  const [saudacaoEstado, setSaudacaoEstado] = useState(config.saudacaoEstado);
  const [saudacaoTexto, setTexto] = useState(config.saudacaoTexto);
  const [copilotoAtivo, setCopiloto] = useState(config.copilotoAtivo);
  const [copilotoQuietudeMinutos, setQuietude] = useState(config.copilotoQuietudeMinutos);
  const [matriculaAutomaticaAtiva, setMatriculaAuto] = useState(config.matriculaAutomaticaAtiva);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);

  async function salvar() {
    setOcupado(true);
    setErro(null);
    setNota(null);
    const r = await salvarConfigComercial({
      autoLeadAtivo,
      saudacaoEstado,
      saudacaoTexto,
      copilotoAtivo,
      copilotoQuietudeMinutos,
      matriculaAutomaticaAtiva,
    });
    setOcupado(false);
    if (!r.ok) return setErro(r.erro ?? "Erro ao salvar.");
    setNota("Configuração comercial salva.");
    router.refresh();
  }

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-medium">Comercial — captura e saudação</h2>
        <p className="mt-1 text-sm text-gray-500">
          Automação do 1º contato pelo número de vendas. Tudo começa desligado; ligue quando o piloto validar.
        </p>
      </div>

      {erro && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {nota && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{nota}</p>}

      <div className="space-y-4 rounded-lg border border-gray-200 bg-surface p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-brand-600"
            checked={autoLeadAtivo}
            onChange={(e) => setAutoLead(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium">Criar lead automaticamente</span>
            <span className="block text-gray-500">
              No 1º inbound de um número de vendas, cria um lead (com a origem do anúncio, quando houver). Telefone que
              já é aluno, responsável ou lead só é vinculado — nunca duplica.
            </span>
          </span>
        </label>

        <div>
          <div className="text-sm font-medium">Saudação automática</div>
          <p className="mb-2 text-sm text-gray-500">
            Responde o 1º inbound em segundos, fora da janela de horário. Texto fixo (a IA não fala com o lead nesta fase).
            Em <span className="font-medium">ensaio</span> o sistema só registra o que teria sido enviado, sem enviar.
          </p>
          <select
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
            value={saudacaoEstado}
            onChange={(e) => setSaudacaoEstado(e.target.value as ConfigComercialView["saudacaoEstado"])}
          >
            <option value="DESLIGADA">Desligada</option>
            <option value="SHADOW">Ensaio (shadow) — não envia</option>
            <option value="ATIVA">Ativa — envia</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Texto da saudação</label>
          <textarea
            className={inputCls}
            rows={3}
            value={saudacaoTexto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={saudacaoEstado === "DESLIGADA"}
            placeholder="Olá! Recebemos sua mensagem e já retornamos. 😊"
          />
        </div>

        {/* C3 (doc 27): copiloto IA — SÓ-LEITURA (resume/sugere; nunca fala com o lead) */}
        <div className="border-t border-gray-100 pt-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-brand-600"
              checked={copilotoAtivo}
              onChange={(e) => setCopiloto(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">Copiloto IA (só-leitura)</span>
              <span className="block text-gray-500">
                Sugere resumo executivo, temperatura, segmento e mudança de etapa na inbox e na ficha do lead. O
                vendedor aceita, corrige ou descarta — a IA nunca altera o CRM sozinha e nunca fala com o lead.
                Sem <code>ANTHROPIC_API_KEY</code> no ambiente, roda uma heurística local (rotulada “simulado”).
              </span>
            </span>
          </label>
          {copilotoAtivo && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-xs font-medium text-gray-600">Analisar conversa quieta após</span>
              <input
                type="number"
                min={1}
                max={1440}
                className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
                value={copilotoQuietudeMinutos}
                onChange={(e) => setQuietude(Number(e.target.value))}
              />
              <span className="text-xs text-gray-500">min sem resposta ao último inbound</span>
            </label>
          )}
        </div>

        {/* C4 (doc 27): matrícula automática — fechamento sem clique */}
        <div className="border-t border-gray-100 pt-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-brand-600"
              checked={matriculaAutomaticaAtiva}
              onChange={(e) => setMatriculaAuto(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">Matrícula automática (fechamento C4)</span>
              <span className="block text-gray-500">
                Numa matrícula aguardando: contrato assinado + taxa paga ativam sozinhos (cronograma, comissão e
                lead matriculado). A turma continua híbrida — o sistema sugere, o consultor confirma na ficha do aluno.
              </span>
            </span>
          </label>
        </div>

        <button className={btnPri} disabled={ocupado} onClick={salvar}>
          {ocupado ? "Salvando…" : "Salvar configuração comercial"}
        </button>
      </div>

      {/* Métrica-gate (doc 27): taxa de aceitação por tipo — autoriza (ou não) auto-aplicação futura. */}
      {metricasCopiloto.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-sm font-medium">Copiloto — aceitação por tipo de sugestão</div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-right">Aceitas</th>
                  <th className="px-3 py-2 text-right">Corrigidas</th>
                  <th className="px-3 py-2 text-right">Descartadas</th>
                  <th className="px-3 py-2 text-right">Pendentes</th>
                  <th className="px-3 py-2 text-right">Aceitação</th>
                </tr>
              </thead>
              <tbody>
                {metricasCopiloto.map((m) => (
                  <tr key={m.tipo} className="border-t border-gray-100">
                    <td className="px-3 py-2">{TIPO_SUGESTAO_LABEL[m.tipo] ?? m.tipo}</td>
                    <td className="px-3 py-2 text-right">{m.aceitas}</td>
                    <td className="px-3 py-2 text-right">{m.corrigidas}</td>
                    <td className="px-3 py-2 text-right">{m.descartadas}</td>
                    <td className="px-3 py-2 text-right">{m.pendentes}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {m.taxaAceitacaoPct === null ? "—" : `${m.taxaAceitacaoPct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ensaio observável (doc 27): o que a saudação TERIA enviado — valida o piloto. */}
      <div className="mt-4">
        <div className="mb-1 text-sm font-medium">Ensaio — últimas saudações simuladas</div>
        {simuladas.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nada simulado ainda. Em ensaio (shadow), cada 1º inbound registra aqui a saudação que teria sido enviada.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-surface">
            {simuladas.map((s) => (
              <li key={s.id} className="px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-800">{s.contato}</span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {new Date(s.quando).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-0.5 text-gray-600">{s.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
