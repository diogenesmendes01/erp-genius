"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarConfigSetorDaTela } from "@/server/crm-config/acoes-distribuicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { EstadoVazio } from "@/components/EstadoVazio";
import { botaoClasses } from "@/components/Botao";
import type { HorarioAtendimento } from "@/server/crm-config/horario-atendimento";

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
  /** Horário gravado do setor (null = sem horário: contagem corrida). */
  horario: HorarioAtendimento | null;
  /** Fuso da escola: os horários são hora civil nele. */
  fuso: string;
  /** Horários de outros setores, para "Copiar de outro setor" (D1). */
  outrosHorarios: { finalidade: string; rotulo: string; horario: HorarioAtendimento }[];
}

type Intervalo = HorarioAtendimento["intervalos"][number];
/** Uma linha por dia da semana; `originais` guarda os vários intervalos de um dia até ele ser editado. */
export type LinhaHorario = { dia: number; atende: boolean; inicio: string; fim: string; originais: Intervalo[] | null };

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

export function linhasDoHorario(h: HorarioAtendimento | null): LinhaHorario[] {
  return ORDEM_DIAS.map((dia) => {
    const doDia = (h?.intervalos ?? []).filter((i) => i.dia === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
    if (!doDia.length) return { dia, atende: false, inicio: "08:00", fim: "18:00", originais: null };
    return { dia, atende: true, inicio: doDia[0].inicio, fim: doDia[doDia.length - 1].fim, originais: doDia.length > 1 ? doDia : null };
  });
}

/** Linhas da tela → horário gravável; nenhum dia marcado = null (sem horário). Feriados vêm do gravado (sem tela na v1, D2). */
export function horarioDasLinhas(linhas: LinhaHorario[], feriados: string[]): HorarioAtendimento | null {
  const intervalos = linhas.filter((l) => l.atende)
    .flatMap((l) => l.originais ?? [{ dia: l.dia, inicio: l.inicio, fim: l.fim }])
    .sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
  return intervalos.length ? { intervalos, feriados } : null;
}

export function erroDasLinhas(linhas: LinhaHorario[]): string | null {
  const ruim = linhas.find((l) => l.atende && !l.originais && !(l.inicio && l.fim && l.inicio < l.fim));
  return ruim ? `${DIAS[ruim.dia]}: o fim do horário deve ser depois do início.` : null;
}

export function entradaSalvarSetor(e: {
  finalidade: SetorPainelProps["finalidade"]; regra: SetorPainelProps["regra"]; ids: string[]; prazo: number;
  alResp: boolean; alGer: boolean; contar: boolean; linhas: LinhaHorario[]; feriados: string[];
}) {
  return {
    distribuicao: { finalidade: e.finalidade, regra: e.regra, participantesIds: e.ids },
    sla: { prazoPrimeiraRespostaMin: e.prazo, alertarResponsavel: e.alResp, alertarGerente: e.alGer, contarSoNoHorario: e.contar, horario: horarioDasLinhas(e.linhas, e.feriados) },
  };
}

const PRAZOS = [15, 30, 60, 120, 240, 1440];
const rotuloPrazo = (m: number) => (m % 60 === 0 && m >= 60 ? `${m / 60} h` : `${m} min`);
const REGRAS = [
  { v: "MANUAL", t: "Manual (fila do setor)" },
  { v: "RODIZIO", t: "Rodízio" },
  { v: "MENOR_CARGA", t: "Menor carga" },
] as const;
const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm";

export function SetorPainel(p: SetorPainelProps) {
  const router = useRouter();
  const [regra, setRegra] = useState(p.regra);
  const [ids, setIds] = useState(p.participantesIds);
  const [prazo, setPrazo] = useState(p.prazo);
  const opcoesPrazo = PRAZOS.includes(p.prazo) ? PRAZOS : [...PRAZOS, p.prazo].sort((a, b) => a - b);
  const [alResp, setAlResp] = useState(p.alertarResponsavel);
  const [alGer, setAlGer] = useState(p.alertarGerente);
  const [contar, setContar] = useState(p.contarSoNoHorario);
  const [linhas, setLinhas] = useState(() => linhasDoHorario(p.horario));
  const [copiarDe, setCopiarDe] = useState(p.outrosHorarios[0]?.finalidade ?? "");
  // Idempotente por natureza (#166): distribuição e SLA do setor são gravados por upsert na finalidade (estado-alvo).
  const acao = useAcaoCliente({ idempotente: true });
  const erroHorario = erroDasLinhas(linhas);
  const semHorario = !linhas.some((l) => l.atende);

  const alternar = (id: string) => setIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const mudarLinha = (dia: number, parte: Partial<LinhaHorario>) =>
    setLinhas((ls) => ls.map((l) => (l.dia === dia ? { ...l, ...parte, originais: null } : l)));
  function copiar() {
    const origem = p.outrosHorarios.find((o) => o.finalidade === copiarDe);
    if (origem) setLinhas(linhasDoHorario(origem.horario));
  }
  async function salvar() {
    if (erroHorario) return;
    const d = await acao.executar(() => salvarConfigSetorDaTela(entradaSalvarSetor({
      finalidade: p.finalidade, regra, ids, prazo, alResp, alGer, contar, linhas, feriados: p.horario?.feriados ?? [],
    })));
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
      <label className="flex items-center gap-1"><input type="checkbox" checked={contar} onChange={(e) => setContar(e.target.checked)} />Contar só no horário de atendimento</label>
    </div>
    <p className="mt-1 text-xs text-gray-500">O alerta aparece no sino e na lista do Inbox uma vez por atendimento. Sem responsável, vai ao gerente do setor.</p>
    <fieldset className="mt-3">
      <legend className="text-xs text-gray-600">Horário de atendimento (fuso da escola: {p.fuso})</legend>
      <div className="mt-1 grid gap-1 text-sm">
        {linhas.map((l) => (
          <div key={l.dia} className="flex flex-wrap items-center gap-2">
            <label className="flex w-28 items-center gap-1"><input type="checkbox" checked={l.atende} onChange={(e) => mudarLinha(l.dia, { atende: e.target.checked })} />{DIAS[l.dia]}</label>
            <input type="time" aria-label={`${DIAS[l.dia]}: início`} className="rounded-md border border-gray-300 px-2 py-1 text-sm" value={l.inicio} disabled={!l.atende} onChange={(e) => mudarLinha(l.dia, { inicio: e.target.value })} />
            <span className="text-xs text-gray-500">às</span>
            <input type="time" aria-label={`${DIAS[l.dia]}: fim`} className="rounded-md border border-gray-300 px-2 py-1 text-sm" value={l.fim} disabled={!l.atende} onChange={(e) => mudarLinha(l.dia, { fim: e.target.value })} />
            {l.originais && <span className="text-xs text-gray-500">{l.originais.length} intervalos gravados; editar este dia deixa um só.</span>}
          </div>
        ))}
      </div>
      {p.outrosHorarios.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <label className="text-xs text-gray-600">Copiar de outro setor
            <select className="ml-2 rounded-md border border-gray-300 px-2 py-1 text-sm" value={copiarDe} onChange={(e) => setCopiarDe(e.target.value)}>
              {p.outrosHorarios.map((o) => <option key={o.finalidade} value={o.finalidade}>{o.rotulo}</option>)}
            </select>
          </label>
          <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "sm" })} onClick={copiar}>Copiar horário</button>
        </div>
      )}
      {contar && semHorario && <p className="mt-1 text-xs text-gray-500">Sem horário cadastrado: o prazo conta direto, 24 h por dia.</p>}
      {erroHorario && <p className="mt-1 text-xs text-red-700" role="alert">{erroHorario}</p>}
      <p className="mt-1 text-xs text-gray-500">Mudanças valem para os próximos atendimentos; prazos já calculados não mudam.</p>
    </fieldset>
    <button className={`${botaoClasses({ tamanho: "md" })} mt-4`} disabled={acao.ocupado || !!erroHorario} onClick={salvar}>{acao.ocupado ? "Salvando…" : "Salvar setor"}</button>
    <FeedbackAcao erro={acao.erro} className="mt-3" />
  </section>;
}
