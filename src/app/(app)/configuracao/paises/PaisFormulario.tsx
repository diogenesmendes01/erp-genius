"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { PaisSchema, type PaisInput } from "@/server/paises/schema";
import { criarPais, editarPais } from "@/server/paises/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

const VALIDADORES = ["cpf", "cedula_cr", "curp", "dni_ar", "dui_sv", "passaporte"];

export interface PaisParaEditar {
  id: string;
  nome: string;
  codigoISO: string;
  moedaLocal: string;
  ddi: string;
  fuso: string;
  idioma: string;
  tiposDocumento: { id?: string; nome: string; validador: string }[];
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
  // Sem chave de idempotência: repetir criarPais esbarra no código ISO já criado e editarPais cria de
  // novo os tipos de documento sem id — a falha de rede manda conferir a página antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
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

  const { fields, append, remove } = useFieldArray({ control, name: "tiposDocumento", keyName: "_formKey" });

  async function onSubmit(data: PaisInput) {
    const d = await acao.executar<unknown>(() => pais ? editarPais(pais.id, data) : criarPais(data));
    if (d?.tipo !== "ok") return;
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
        <div className="col-span-2 md:col-span-1">
          <label className="mb-1 block text-xs text-gray-600" htmlFor="pais-nome">Nome</label>
          <input id="pais-nome" {...register("nome")} className={inputCls} aria-invalid={errors.nome ? true : undefined} aria-describedby={errors.nome ? "pais-nome-erro" : undefined} />
          {errors.nome && <p id="pais-nome-erro" role="alert" className="mt-1 text-xs text-red-600">{errors.nome.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="pais-codigo-iso">Código ISO</label>
          <input id="pais-codigo-iso" {...register("codigoISO")} placeholder="CR" maxLength={2} className={inputCls} aria-invalid={errors.codigoISO ? true : undefined} aria-describedby={errors.codigoISO ? "pais-codigo-iso-erro" : undefined} />
          {errors.codigoISO && (
            <p id="pais-codigo-iso-erro" role="alert" className="mt-1 text-xs text-red-600">{errors.codigoISO.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="pais-moeda">Moeda</label>
          <input id="pais-moeda" {...register("moedaLocal")} placeholder="CRC" maxLength={3} className={inputCls} aria-invalid={errors.moedaLocal ? true : undefined} aria-describedby={errors.moedaLocal ? "pais-moeda-erro" : undefined} />
          {errors.moedaLocal && (
            <p id="pais-moeda-erro" role="alert" className="mt-1 text-xs text-red-600">{errors.moedaLocal.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="pais-ddi">DDI</label>
          <input id="pais-ddi" {...register("ddi")} placeholder="+506" className={inputCls} aria-invalid={errors.ddi ? true : undefined} aria-describedby={errors.ddi ? "pais-ddi-erro" : undefined} />
          {errors.ddi && <p id="pais-ddi-erro" role="alert" className="mt-1 text-xs text-red-600">{errors.ddi.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="pais-fuso">Fuso horário</label>
          <input id="pais-fuso" {...register("fuso")} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="pais-idioma">Idioma</label>
          <input id="pais-idioma" {...register("idioma")} placeholder="es" className={inputCls} />
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
            <div key={f._formKey} className="flex items-center gap-2">
              <input
                {...register(`tiposDocumento.${i}.nome`)}
                aria-label={`Nome do tipo de documento ${i + 1}`}
                placeholder="Cédula"
                className={inputCls + " flex-1"}
              />
              <select
                {...register(`tiposDocumento.${i}.validador`)}
                aria-label={`Validador do tipo de documento ${i + 1}`}
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

      <FeedbackAcao erro={acao.erro} className="mt-4" />

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={acao.ocupado}
          className="rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
        >
          {acao.ocupado ? "Salvando…" : "Salvar país"}
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
