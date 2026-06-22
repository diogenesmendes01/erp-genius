"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { TurmaSchema, type TurmaInput } from "@/server/turmas/schema";
import { criarTurma, editarTurma } from "@/server/turmas/acoes";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export interface TurmaParaEditar {
  id: string;
  modalidadeId: string;
  nivelId: string;
  professorId: string;
  diasHorario: string;
  dataInicio: string; // yyyy-mm-dd ou ""
  capacidade: number;
  rolling: boolean;
}

export interface Opcao {
  id: string;
  label: string;
}

export function TurmaFormulario({
  turma,
  modalidades,
  niveis,
  professores,
  onClose,
}: {
  turma?: TurmaParaEditar;
  modalidades: Opcao[];
  niveis: Opcao[];
  professores: Opcao[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TurmaInput>({
    resolver: zodResolver(TurmaSchema),
    defaultValues: turma ?? {
      modalidadeId: "",
      nivelId: "",
      professorId: "",
      diasHorario: "",
      dataInicio: "",
      capacidade: 12,
      rolling: false,
    },
  });

  async function onSubmit(data: TurmaInput) {
    setErro(null);
    const res = turma ? await editarTurma(turma.id, data) : await criarTurma(data);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-gray-200 bg-surface p-5">
      <h3 className="mb-4 text-sm font-medium">{turma ? "Editar turma" : "Nova turma"}</h3>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Modalidade</label>
          <select {...register("modalidadeId")} className={inputCls}>
            <option value="">Selecione…</option>
            {modalidades.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {errors.modalidadeId && (
            <p className="mt-1 text-xs text-red-600">{errors.modalidadeId.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Nível</label>
          <select {...register("nivelId")} className={inputCls}>
            <option value="">Selecione…</option>
            {niveis.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          {errors.nivelId && <p className="mt-1 text-xs text-red-600">{errors.nivelId.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Professor (opcional)</label>
          <select {...register("professorId")} className={inputCls}>
            <option value="">—</option>
            {professores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Dias / horário (opcional)</label>
          <input
            {...register("diasHorario")}
            placeholder="Ter/Qui 20h (deixe em branco se a definir)"
            className={inputCls}
          />
          {errors.diasHorario && (
            <p className="mt-1 text-xs text-red-600">{errors.diasHorario.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Data de início</label>
          <input type="date" {...register("dataInicio")} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Capacidade</label>
          <input type="number" {...register("capacidade")} className={inputCls} />
          {errors.capacidade && (
            <p className="mt-1 text-xs text-red-600">{errors.capacidade.message}</p>
          )}
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" {...register("rolling")} className="rounded border-gray-300" />
        Turma rolling (porta de entrada Pré A1)
      </label>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? "Salvando…" : "Salvar turma"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
