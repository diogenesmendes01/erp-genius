"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarTurma, editarTurma } from "@/server/turmas/acoes";
import type { TurmaInput } from "@/server/turmas/schema";
import {
  diasPorSemanaDaFrequencia,
  duracaoIntervaloEmMinutos,
  horarioFimPorDuracao,
} from "@/server/turmas/schema";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

// 0=Dom … 6=Sáb. Exibição começando na segunda (uso comum no BR).
const DIAS = [
  { n: 1, label: "Seg" },
  { n: 2, label: "Ter" },
  { n: 3, label: "Qua" },
  { n: 4, label: "Qui" },
  { n: 5, label: "Sex" },
  { n: 6, label: "Sáb" },
  { n: 0, label: "Dom" },
];

export interface TurmaParaEditar {
  id: string;
  nome: string;
  modalidadeId: string;
  nivelId: string;
  professorId: string;
  diasSemana: number[];
  horarioInicio: string;
  horarioFim: string;
  dataInicio: string; // yyyy-mm-dd ou ""
  dataFim: string; // yyyy-mm-dd ou ""
  capacidade: number;
  rolling: boolean;
}

export interface Opcao {
  id: string;
  label: string;
}

export interface ModalidadeOpcao extends Opcao {
  frequencia: string;
  horasAula: number;
}

export function destinoPrepararGrade(turmaId: string): string {
  return `/academico/grades/nova?turmaId=${encodeURIComponent(turmaId)}`;
}

type ResultadoFormulario = { ok: boolean; erro?: string; dado?: unknown };
type AcoesFormulario = {
  criar: (input: TurmaInput) => Promise<ResultadoFormulario>;
  editar: (turmaId: string, input: TurmaInput) => Promise<ResultadoFormulario>;
};

/** Caminho acionado pelo submit: criação navega; edição apenas atualiza e fecha o diálogo. */
export async function submeterTurma(
  turmaId: string | undefined,
  input: TurmaInput,
  acoes: AcoesFormulario,
): Promise<{ ok: true; destino?: string } | { ok: false; erro: string }> {
  if (turmaId) {
    const resultado = await acoes.editar(turmaId, input);
    return resultado.ok ? { ok: true } : { ok: false, erro: resultado.erro ?? "Turma não confirmada." };
  }
  const resultado = await acoes.criar(input);
  const id = typeof resultado.dado === "object" && resultado.dado !== null && "id" in resultado.dado
    ? (resultado.dado as { id?: unknown }).id
    : null;
  if (!resultado.ok || typeof id !== "string") return { ok: false, erro: resultado.erro ?? "Turma não confirmada." };
  return { ok: true, destino: destinoPrepararGrade(id) };
}

export function TurmaFormulario({
  turma,
  modalidades,
  niveis,
  professores,
  onClose,
}: {
  turma?: TurmaParaEditar;
  modalidades: ModalidadeOpcao[];
  niveis: Opcao[];
  professores: Opcao[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState(turma?.nome ?? "");
  const [modalidadeId, setModalidadeId] = useState(turma?.modalidadeId ?? "");
  const [nivelId, setNivelId] = useState(turma?.nivelId ?? "");
  const [professorId, setProfessorId] = useState(turma?.professorId ?? "");
  const [diasSemana, setDiasSemana] = useState<number[]>(turma?.diasSemana ?? []);
  const [horarioInicio, setHorarioInicio] = useState(turma?.horarioInicio ?? "");
  const [horarioFim, setHorarioFim] = useState(turma?.horarioFim ?? "");
  const [dataInicio, setDataInicio] = useState(turma?.dataInicio ?? "");
  const [dataFim] = useState(turma?.dataFim ?? "");
  const [capacidade, setCapacidade] = useState(turma?.capacidade ?? 12);
  const [rolling, setRolling] = useState(turma?.rolling ?? false);

  const modalidadeSel = modalidades.find((m) => m.id === modalidadeId);
  const diasRequeridos = modalidadeSel ? diasPorSemanaDaFrequencia(modalidadeSel.frequencia) : null;
  const duracaoModalidadeMinutos = modalidadeSel ? modalidadeSel.horasAula * 60 : null;
  const horarioFimDerivado = /^([01]?\d|2[0-3]):[0-5]\d$/.test(horarioInicio) && modalidadeSel &&
    duracaoModalidadeMinutos !== null && Number.isInteger(duracaoModalidadeMinutos) && duracaoModalidadeMinutos > 0
    ? horarioFimPorDuracao(horarioInicio, duracaoModalidadeMinutos)
    : null;
  const horarioFimEfetivo = turma ? horarioFim : horarioFimDerivado?.horarioFim ?? "";
  const diasMudaram = !turma || [...diasSemana].sort().join(",") !== [...turma.diasSemana].sort().join(",");
  const modalidadeMudou = !turma || modalidadeId !== turma.modalidadeId;

  function toggleDia(n: number) {
    setDiasSemana((atual) => (atual.includes(n) ? atual.filter((d) => d !== n) : [...atual, n]));
  }

  function validar(): string | null {
    if (!modalidadeId) return "Selecione a modalidade.";
    if (!nivelId) return "Selecione o nível.";
    if (diasSemana.length === 0) return "Selecione os dias da semana.";
    if ((modalidadeMudou || diasMudaram) && diasRequeridos !== null && diasSemana.length !== diasRequeridos)
      return `A modalidade ${modalidadeSel?.label} é ${modalidadeSel?.frequencia}: selecione exatamente ${diasRequeridos} dia(s) — você marcou ${diasSemana.length}.`;
    const reHora = /^([01]?\d|2[0-3]):[0-5]\d$/;
    if (!reHora.test(horarioInicio)) return "Informe o horário de início (HH:MM).";
    if (!reHora.test(horarioFimEfetivo)) return "Selecione uma modalidade com duração válida.";
    if (turma && duracaoIntervaloEmMinutos(horarioInicio, horarioFim) <= 0)
      return "O intervalo da aula deve ter duração positiva.";
    if (!dataInicio) return "Informe a data de início.";
    if (dataFim && dataFim <= dataInicio) return "A data de fim deve ser depois da data de início.";
    return null;
  }

  async function onSubmit() {
    const e = validar();
    if (e) {
      setErro(e);
      return;
    }
    setErro(null);
    setSalvando(true);
    const input = {
      nome: nome || undefined,
      modalidadeId,
      nivelId,
      professorId: professorId || undefined,
      diasSemana,
      horarioInicio,
      horarioFim: horarioFimEfetivo,
      dataInicio,
      dataFim: turma ? dataFim || undefined : undefined,
      capacidade,
      rolling,
    };
    const res = await submeterTurma(turma?.id, input, { criar: criarTurma, editar: editarTurma });
    if (!res.ok) {
      setErro(res.erro);
      setSalvando(false);
      return;
    }
    if (res.destino) {
      router.push(res.destino);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-5">
      <h3 className="mb-4 text-sm font-medium">{turma ? "Editar turma" : "Nova turma"}</h3>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs text-gray-600">Nome da turma (opcional)</label>
          <input
            className={inputCls}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder='Ex.: "Turma Salvador" · "Intensiva manhã" (livre)'
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Modalidade</label>
          <select className={inputCls} value={modalidadeId} onChange={(e) => setModalidadeId(e.target.value)}>
            <option value="">Selecione…</option>
            {modalidades.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.frequencia})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Nível</label>
          <select className={inputCls} value={nivelId} onChange={(e) => setNivelId(e.target.value)}>
            <option value="">Selecione…</option>
            {niveis.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Professor (opcional)</label>
          <select className={inputCls} value={professorId} onChange={(e) => setProfessorId(e.target.value)}>
            <option value="">—</option>
            {professores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Agenda (calendário real) */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <label className="mb-1 block text-xs text-gray-600">
          Dias da semana
          {diasRequeridos !== null && modalidadeSel && (
            <span className="ml-1 text-gray-400">
              — {modalidadeSel.frequencia}: marque {diasRequeridos} dia(s) ({diasSemana.length} marcado(s))
            </span>
          )}
          {modalidadeSel && diasRequeridos === null && (
            <span className="ml-1 text-gray-400">— {modalidadeSel.frequencia}: marque os dias</span>
          )}
        </label>
        <div className="flex flex-wrap gap-2">
          {DIAS.map((d) => {
            const ativo = diasSemana.includes(d.n);
            return (
              <button
                key={d.n}
                type="button"
                onClick={() => toggleDia(d.n)}
                className={
                  "rounded-md border px-3 py-1.5 text-sm " +
                  (ativo
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50")
                }
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Horário de início</label>
          <input type="time" className={inputCls} value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">
            Horário de fim {turma ? "" : "derivado"}
          </label>
          <input
            type="time"
            className={inputCls}
            value={horarioFimEfetivo}
            onChange={(e) => setHorarioFim(e.target.value)}
            readOnly={!turma}
            aria-describedby={turma ? undefined : "fim-derivado"}
          />
          {!turma && (
            <p id="fim-derivado" className="mt-1 text-xs text-gray-500">
              {horarioFimDerivado
                ? `A modalidade define ${modalidadeSel?.horasAula} h de aula${horarioFimDerivado.atravessaDia ? "; termina no dia seguinte." : "."}`
                : "Selecione a modalidade e informe o início para calcular o término."}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Data de início</label>
          <input type="date" className={inputCls} value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </div>
        {turma ? (
          <div>
            <label className="mb-1 block text-xs text-gray-600">Data final de referência (legado)</label>
            <input type="date" className={inputCls} value={dataFim} readOnly />
            <p className="mt-1 text-xs text-gray-500">A referência histórica é preservada nesta edição.</p>
          </div>
        ) : (
          <div className="pt-6 text-xs text-gray-500">
            A previsão de término será calculada ao gerar a agenda, conforme a quantidade de aulas do nível.
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-gray-600">Capacidade</label>
          <input
            type="number"
            className={inputCls}
            value={capacidade}
            onChange={(e) => setCapacidade(Number(e.target.value))}
          />
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={rolling} onChange={(e) => setRolling(e.target.checked)} className="rounded border-gray-300" />
        Turma rolling (porta de entrada Pré A1)
      </label>

      {erro && <p role="alert" className="mt-4 text-sm text-red-600">{erro}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={salvando}
          className="rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar turma"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
