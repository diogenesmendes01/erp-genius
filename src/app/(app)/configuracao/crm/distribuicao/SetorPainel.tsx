"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarConfigSetorDaTela } from "@/server/crm-config/acoes-distribuicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { EstadoVazio } from "@/components/EstadoVazio";
import { botaoClasses } from "@/components/Botao";

export interface SetorPainelProps {
  finalidade: "COMERCIAL" | "FINANCEIRO" | "SECRETARIA" | "PEDAGOGICO";
  rotulo: string;
  regra: "RODIZIO" | "MENOR_CARGA" | "MANUAL";
  participantesIds: string[];
  candidatos: { id: string; nome: string }[];
  /** Prazo gravado, em minutos; um valor fora da lista padrão aparece como opção e é preservado. */
  prazo: number;
  alertarResponsavel: boolean;
  alertarGerente: boolean;
  contarSoNoHorario: boolean;
}

const PRAZOS = [15, 30, 60, 120, 240, 1440];
const rotuloPrazo = (m: number) => (m % 60 === 0 && m >= 60 ? `${m / 60} h` : `${m} min`);
const REGRAS = [
  { v: "MANUAL", t: "Manual (fila do setor)" },
  { v: "RODIZIO", t: "Rodízio" },
  { v: "MENOR_CARGA", t: "Menor carga" },
] as const;
/** Alertas e "só no horário" já são gravados, mas nada os consome ainda (prazo e alertas do SLA: pendência no quadro). */
export const AVISO_SLA_EM_BREVE = "Em breve: os alertas e a contagem só no horário ficam gravados, mas ainda não mudam o prazo nem disparam avisos.";
const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm";

export function SetorPainel(p: SetorPainelProps) {
  const router = useRouter();
  const [regra, setRegra] = useState(p.regra);
  const [ids, setIds] = useState(p.participantesIds);
  const [prazo, setPrazo] = useState(p.prazo);
  const opcoesPrazo = PRAZOS.includes(p.prazo) ? PRAZOS : [...PRAZOS, p.prazo].sort((a, b) => a - b);
  const [alResp, setAlResp] = useState(p.alertarResponsavel);
  const [alGer, setAlGer] = useState(p.alertarGerente);
  const [horario, setHorario] = useState(p.contarSoNoHorario);
  const acao = useAcaoCliente({ idempotente: false });

  const alternar = (id: string) => setIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  async function salvar() {
    const d = await acao.executar(() => salvarConfigSetorDaTela({
      distribuicao: { finalidade: p.finalidade, regra, participantesIds: ids },
      sla: { prazoPrimeiraRespostaMin: prazo, alertarResponsavel: alResp, alertarGerente: alGer, contarSoNoHorario: horario },
    }));
    if (d?.tipo === "ok") router.refresh();
  }

  return <section className="rounded-lg border border-gray-200 p-4" aria-label={p.rotulo}>
    <h3 className="text-base font-medium">{p.rotulo}</h3>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-gray-600">Distribuição
        <select className={input} value={regra} onChange={(e) => setRegra(e.target.value as typeof regra)}>
          {REGRAS.map((r) => <option key={r.v} value={r.v}>{r.t}</option>)}
        </select>
      </label>
      <label className="text-xs text-gray-600">Prazo da primeira resposta
        <select className={input} value={prazo} onChange={(e) => setPrazo(Number(e.target.value))}>
          {opcoesPrazo.map((m) => <option key={m} value={m}>{rotuloPrazo(m)}</option>)}
        </select>
      </label>
    </div>
    <fieldset className="mt-3">
      <legend className="text-xs text-gray-600">Participantes (a ordem do rodízio é a da lista)</legend>
      <div className="mt-1 flex flex-wrap gap-3 text-sm">
        {p.candidatos.length === 0 && <EstadoVazio>Nenhum usuário ativo neste setor.</EstadoVazio>}
        {p.candidatos.map((c) => <label key={c.id} className="flex items-center gap-1"><input type="checkbox" checked={ids.includes(c.id)} onChange={() => alternar(c.id)} />{c.nome}</label>)}
      </div>
    </fieldset>
    <div className="mt-3 flex flex-wrap gap-4 text-sm">
      <label className="flex items-center gap-1"><input type="checkbox" checked={alResp} onChange={(e) => setAlResp(e.target.checked)} />Alertar o responsável</label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={alGer} onChange={(e) => setAlGer(e.target.checked)} />Alertar o gerente</label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={horario} onChange={(e) => setHorario(e.target.checked)} />Contar só no horário de atendimento</label>
    </div>
    <p className="mt-1 text-xs text-gray-500">{AVISO_SLA_EM_BREVE}</p>
    <button className={`${botaoClasses({ tamanho: "md" })} mt-4`} disabled={acao.ocupado} onClick={salvar}>{acao.ocupado ? "Salvando…" : "Salvar setor"}</button>
    <FeedbackAcao erro={acao.erro} className="mt-3" />
  </section>;
}
