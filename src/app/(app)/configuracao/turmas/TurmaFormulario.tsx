"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarTurma, editarTurma } from "@/server/turmas/acoes";
import { diasPorSemanaDaFrequencia } from "@/server/turmas/schema";

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
  const [dataFim, setDataFim] = useState(turma?.dataFim ?? "");
  const [capacidade, setCapacidade] = useState(turma?.capacidade ?? 12);
  const [rolling, setRolling] = useState(turma?.rolling ?? false);

  const modalidadeSel = modalidades.find((m) => m.id === modalidadeId);
  const diasRequeridos = modalidadeSel ? diasPorSemanaDaFrequencia(modalidadeSel.frequencia) : null;

  function toggleDia(n: number) {
    setDiasSemana((atual) => (atual.includes(n) ? atual.filter((d) => d !== n) : [...atual, n]));
  }

  function validar(): string | null {
    if (!modalidadeId) return "Selecione a modalidade.";
    if (!nivelId) return "Selecione o nível.";
    if (diasSemana.length === 0) return "Selecione os dias da semana.";
    if (diasRequeridos !== null && diasSemana.length !== diasRequeridos)
      return `A modalidade ${modalidadeSel?.label} é ${modalidadeSel?.frequencia}: selecione exatamente ${diasRequeridos} dia(s) — você marcou ${diasSemana.length}.`;
    const reHora = /^([01]?\d|2[0-3]):[0-5]\d$/;
    if (!reHora.test(horarioInicio)) return "Informe o horário de início (HH:MM).";
    if (!reHora.test(horarioFim)) return "Informe o horário de fim (HH:MM).";
    if (horarioFim <= horarioInicio) return "O horário de fim deve ser depois do início.";
    if (!dataInicio) return "Informe a data de início.";
    if (!dataFim) return "Informe a data de fim.";
    if (dataFim <= dataInicio) return "A data de fim deve ser depois da data de início.";
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
      horarioFim,
      dataInicio,
      dataFim,
      capacidade,
      rolling,
    };
    const res = turma ? await editarTurma(turma.id, input) : await criarTurma(input);
    if (!res.ok) {
      setErro(res.erro);
      setSalvando(false);
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
          <label className="mb-1 block text-xs text-gray-600">Horário de fim</label>
          <input type="time" className={inputCls} value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Data de início</label>
          <input type="date" className={inputCls} value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Data de fim</label>
          <input type="date" className={inputCls} value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
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

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={salvando}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
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
