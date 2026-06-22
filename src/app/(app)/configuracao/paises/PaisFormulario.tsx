"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { PaisSchema, type PaisInput } from "@/server/paises/schema";
import { criarPais, editarPais } from "@/server/paises/acoes";

const VALIDADORES = ["cpf", "cedula_cr", "curp", "dni_ar", "dui_sv", "passaporte"];

export interface PaisParaEditar {
  id: string;
  nome: string;
  codigoISO: string;
  moedaLocal: string;
  ddi: string;
  fuso: string;
  idioma: string;
  tiposDocumento: { nome: string; validador: string }[];
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export function PaisFormulario({
  pais,
  onClose,
}: {
  pais?: PaisParaEditar;
  onClose: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaisInput>({
    resolver: zodResolver(PaisSchema),
    defaultValues: pais ?? {
      nome: "",
      codigoISO: "",
      moedaLocal: "",
      ddi: "",
      fuso: "America/Sao_Paulo",
      idioma: "es",
      tiposDocumento: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "tiposDocumento" });

  async function onSubmit(data: PaisInput) {
    setErro(null);
    const res = pais ? await editarPais(pais.id, data) : await criarPais(data);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-lg border border-gray-200 bg-surface p-5"
    >
      <h2 className="mb-4 text-sm font-medium">
        {pais ? `Editar país — ${pais.nome}` : "Novo país"}
      </h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="col-span-2 md:col-span-1">
          <label className="mb-1 block text-xs text-gray-600">Nome</label>
          <input {...register("nome")} className={inputCls} />
          {errors.nome && <p className="mt-1 text-xs text-red-600">{errors.nome.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Código ISO</label>
          <input {...register("codigoISO")} placeholder="CR" maxLength={2} className={inputCls} />
          {errors.codigoISO && (
            <p className="mt-1 text-xs text-red-600">{errors.codigoISO.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Moeda</label>
          <input {...register("moedaLocal")} placeholder="CRC" maxLength={3} className={inputCls} />
          {errors.moedaLocal && (
            <p className="mt-1 text-xs text-red-600">{errors.moedaLocal.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">DDI</label>
          <input {...register("ddi")} placeholder="+506" className={inputCls} />
          {errors.ddi && <p className="mt-1 text-xs text-red-600">{errors.ddi.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Fuso horário</label>
          <input {...register("fuso")} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Idioma</label>
          <input {...register("idioma")} placeholder="es" className={inputCls} />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700">Tipos de documento</span>
          <button
            type="button"
            onClick={() => append({ nome: "", validador: "cpf" })}
            className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800"
          >
            <IconPlus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>

        {fields.length === 0 && (
          <p className="text-xs text-gray-400">
            Nenhum documento. Adicione ao menos um para poder ativar o país.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2">
              <input
                {...register(`tiposDocumento.${i}.nome`)}
                placeholder="Cédula"
                className={inputCls + " flex-1"}
              />
              <select
                {...register(`tiposDocumento.${i}.validador`)}
                className={inputCls + " w-40"}
              >
                {VALIDADORES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-gray-400 hover:text-red-600"
                aria-label="Remover documento"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? "Salvando…" : "Salvar país"}
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
