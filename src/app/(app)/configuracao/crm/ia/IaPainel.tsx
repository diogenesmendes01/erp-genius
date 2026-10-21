"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarConfigIADaTela } from "@/server/crm-config/acoes-ia";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

export interface ConfigIATela {
  modeloConversa: string;
  modeloClassificacao: string;
  orcamentoMensalUsd: number;
  acaoAoEstourar: "SO_SUGERIR" | "PAUSAR";
  triagemAtiva: boolean;
  limiarTriagem: number;
}
export interface OrcamentoTela { situacao: "OK" | "ALERTA" | "ESTOURADO"; gastoUsd: number; limiteUsd: number }
export interface ChamadaTela { quando: string; origem: string; modelo: string; latenciaMs: number; tokens: number; resultado: string }

const MODELOS = [
  { v: "claude-sonnet-5-5", t: "Claude Sonnet 5.5" },
  { v: "claude-haiku-5-5", t: "Claude Haiku 5.5" },
];
const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm";
const usd = (n: number) => `US$ ${n.toFixed(2).replace(".", ",")}`;

/** `fusoExibicao`: o fuso pessoal de quem lê, já resolvido na página (sem preferência, o da escola). */
export function IaPainel({ chave, config, orcamento, chamadas, fusoExibicao }: { chave: "configurada" | "ausente"; config: ConfigIATela; orcamento: OrcamentoTela; chamadas: ChamadaTela[]; fusoExibicao: string }) {
  const router = useRouter();
  // Idempotente por natureza (#166): a configuração de IA é um registro único, gravado com os valores da tela;
  // o servidor não grava nada (nem Evento) quando eles já estão lá, então reenviar não duplica.
  const acao = useAcaoCliente({ idempotente: true });
  const [f, setF] = useState(config);
  const pct = orcamento.limiteUsd > 0 ? Math.min(100, (orcamento.gastoUsd / orcamento.limiteUsd) * 100) : 0;
  const cor = orcamento.situacao === "ESTOURADO" ? "bg-red-500" : orcamento.situacao === "ALERTA" ? "bg-amber-600" : "bg-green-600";
  const salvar = async () => {
    const d = await acao.executar(() => salvarConfigIADaTela(f));
    if (d?.tipo === "ok") router.refresh();
  };

  return <div className="mt-4 grid gap-6">
    <section aria-label="Provedor" className="rounded-lg border border-gray-200 p-4 text-sm">
      <p>Provedor: <strong>Anthropic</strong></p>
      <p className="mt-1">Chave de API: <strong>{chave === "configurada" ? "configurada" : "ausente"}</strong>
        <span className="text-xs text-gray-500"> (definida só no ambiente do servidor; nunca é exibida)</span></p>
      {chave === "ausente" && <p className="mt-1 text-xs text-gray-600">Sem chave, a Aria usa o provedor simulado e nada chama a rede.</p>}
    </section>

    <section aria-label="Uso do mês" className="rounded-lg border border-gray-200 p-4 text-sm">
      <h3 className="text-base font-medium">Uso do mês</h3>
      <div className="relative mt-2 h-3 rounded bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className={`h-3 rounded ${cor}`} style={{ width: `${pct}%` }} />
        <div className="absolute top-[-2px] h-4 w-px bg-gray-700" style={{ left: "80%" }} title="Alerta em 80%" />
      </div>
      <p className="mt-1 text-xs text-gray-600">{usd(orcamento.gastoUsd)} de {usd(orcamento.limiteUsd)} · marca em 80% · {orcamento.situacao === "OK" ? "dentro do orçamento" : orcamento.situacao === "ALERTA" ? "alerta: acima de 80%" : "orçamento estourado"}</p>
    </section>

    <section aria-label="Configuração" className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-base font-medium">Modelos, orçamento e triagem</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-gray-600">Modelo da conversa, resumo e leitura de PDF
          <select className={input} value={f.modeloConversa} onChange={(e) => setF({ ...f, modeloConversa: e.target.value })}>
            {MODELOS.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">Modelo da classificação de setor
          <select className={input} value={f.modeloClassificacao} onChange={(e) => setF({ ...f, modeloClassificacao: e.target.value })}>
            {MODELOS.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">Orçamento mensal (US$)
          <input className={input} type="number" min={0.01} step={0.01} value={f.orcamentoMensalUsd} onChange={(e) => setF({ ...f, orcamentoMensalUsd: Number(e.target.value) })} />
        </label>
        <label className="text-xs text-gray-600">Ao estourar o orçamento
          <select className={input} value={f.acaoAoEstourar} onChange={(e) => setF({ ...f, acaoAoEstourar: e.target.value as ConfigIATela["acaoAoEstourar"] })}>
            <option value="SO_SUGERIR">Só sugerir (a Aria não age sozinha)</option>
            <option value="PAUSAR">Pausar a Aria</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.triagemAtiva} onChange={(e) => setF({ ...f, triagemAtiva: e.target.checked })} /> Triagem automática ativa</label>
        <label className="text-xs text-gray-600">Limiar da triagem (50 a 100)
          <input className={input} type="number" min={50} max={100} step={1} value={f.limiarTriagem} onChange={(e) => setF({ ...f, limiarTriagem: Number(e.target.value) })} />
        </label>
      </div>
      <p className="mt-2 text-xs text-gray-500">A troca vale a partir do próximo turno da Aria.</p>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className={botaoClasses({ variante: "primario" })} disabled={acao.ocupado} onClick={salvar}>Salvar</button>
        <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
      </div>
    </section>

    <section aria-label="Chamadas recentes" className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-base font-medium">Chamadas recentes</h3>
      {chamadas.length === 0 ? <EstadoVazio>Nenhuma chamada registrada.</EstadoVazio> :
        <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs">
          <thead><tr className="text-gray-500"><th className="py-1">Quando</th><th>Origem</th><th>Modelo</th><th>Latência</th><th>Tokens</th><th>Resultado</th></tr></thead>
          <tbody>{chamadas.map((c, i) => <tr key={i} className="border-t border-gray-100">
            <td className="py-1">{formatarInstanteExibicao(c.quando, fusoExibicao, "UTC").texto}</td><td>{c.origem}</td><td>{c.modelo}</td><td>{c.latenciaMs} ms</td><td>{c.tokens}</td><td>{c.resultado}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>
  </div>;
}
