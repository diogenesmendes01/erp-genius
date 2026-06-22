"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Segmento } from "@prisma/client";
import { ModalidadeSchema, type ModalidadeInput } from "@/server/catalogo/schema";
import { criarModalidade, editarModalidade } from "@/server/catalogo/acoes";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

const SEGMENTOS: { value: Segmento; label: string }[] = [
  { value: Segmento.ADULTO, label: "Adulto" },
  { value: Segmento.KIDS, label: "Kids" },
  { value: Segmento.TEENS, label: "Teens" },
  { value: Segmento.EMPRESA, label: "Empresa" },
];

export interface ModalidadeParaEditar {
  id: string;
  nome: string;
  segmento: Segmento;
  frequencia: string;
  horasAula: number;
  duracaoPorNivel: string;
  aulasPorNivel: number | null;
  minimoAbrir: number;
}

export function ModalidadeFormulario({
  modalidade,
  onClose,
}: {
  modalidade?: ModalidadeParaEditar;
  onClose: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ModalidadeInput>({
    resolver: zodResolver(ModalidadeSchema),
    defaultValues: modalidade ?? {
      nome: "",
      segmento: Segmento.ADULTO,
      frequencia: "",
      horasAula: 2,
      duracaoPorNivel: "",
      aulasPorNivel: null,
      minimoAbrir: 1,
    },
  });

  async function onSubmit(data: ModalidadeInput) {
    setErro(null);
    const res = modalidade
      ? await editarModalidade(modalidade.id, data)
      : await criarModalidade(data);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-gray-200 bg-surface p-5">
      <h3 className="mb-4 text-sm font-medium">
        {modalidade ? `Editar modalidade — ${modalidade.nome}` : "Nova modalidade"}
      </h3>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Nome</label>
          <input {...register("nome")} placeholder="Regular" className={inputCls} />
          {errors.nome && <p className="mt-1 text-xs text-red-600">{errors.nome.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Segmento</label>
          <select {...register("segmento")} className={inputCls}>
            {SEGMENTOS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Frequência</label>
          <input {...register("frequencia")} placeholder="1x/semana" className={inputCls} />
          {errors.frequencia && (
            <p className="mt-1 text-xs text-red-600">{errors.frequencia.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Horas/aula</label>
          <input type="number" step="0.5" {...register("horasAula")} className={inputCls} />
          {errors.horasAula && (
            <p className="mt-1 text-xs text-red-600">{errors.horasAula.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Duração por nível</label>
          <input {...register("duracaoPorNivel")} placeholder="3 meses" className={inputCls} />
          {errors.duracaoPorNivel && (
            <p className="mt-1 text-xs text-red-600">{errors.duracaoPorNivel.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Aulas por nível (opcional)</label>
          <input type="number" {...register("aulasPorNivel")} placeholder="12" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Mínimo para abrir</label>
          <input type="number" {...register("minimoAbrir")} className={inputCls} />
          {errors.minimoAbrir && (
            <p className="mt-1 text-xs text-red-600">{errors.minimoAbrir.message}</p>
          )}
        </div>
      </div>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? "Salvando…" : "Salvar modalidade"}
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
