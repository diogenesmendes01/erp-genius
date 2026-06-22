"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Segmento, Temperatura } from "@prisma/client";
import { SEGMENTO_LABEL, TEMPERATURA_LABEL } from "@/lib/labels";
import { LeadSchema, type LeadInput } from "@/server/comercial/schema";
import { criarLead, editarLead } from "@/server/comercial/acoes";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export interface LeadParaEditar {
  id: string;
  nome: string;
  telefoneE164: string;
  paisId: string;
  segmento: Segmento;
  temperatura: Temperatura;
  b2b: boolean;
  origemCampanha: string;
  origemAnuncio: string;
  valorPrevisto: number | null;
  planoPrevisto: string;
  comissaoPrevista: number | null;
}

export function LeadFormulario({
  lead,
  paises,
  vendedores,
  podeAtribuir,
  onClose,
}: {
  lead?: LeadParaEditar;
  paises: { id: string; nome: string }[];
  vendedores: { id: string; nome: string }[];
  // Só gerente/admin podem escolher o dono; o backend ignora o campo para vendedor.
  podeAtribuir: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeadInput>({
    resolver: zodResolver(LeadSchema),
    defaultValues: lead ?? {
      nome: "",
      telefoneE164: "",
      paisId: "",
      segmento: Segmento.ADULTO,
      temperatura: Temperatura.MORNO,
      b2b: false,
      origemCampanha: "",
      origemAnuncio: "",
      valorPrevisto: null,
      planoPrevisto: "",
      comissaoPrevista: null,
      vendedorDonoId: "",
    },
  });

  async function onSubmit(data: LeadInput) {
    setErro(null);
    const res = lead ? await editarLead(lead.id, data) : await criarLead(data);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-gray-200 bg-surface p-5">
      <h2 className="mb-4 text-sm font-medium">{lead ? "Editar lead" : "Novo lead"}</h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="col-span-2 md:col-span-1">
          <label className="mb-1 block text-xs text-gray-600">Nome</label>
          <input {...register("nome")} className={inputCls} />
          {errors.nome && <p className="mt-1 text-xs text-red-600">{errors.nome.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">WhatsApp/telefone</label>
          <input {...register("telefoneE164")} placeholder="+5511999998888" className={inputCls} />
          {errors.telefoneE164 && (
            <p className="mt-1 text-xs text-red-600">{errors.telefoneE164.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">País</label>
          <select {...register("paisId")} className={inputCls}>
            <option value="">—</option>
            {paises.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        {podeAtribuir && (
          <div>
            <label className="mb-1 block text-xs text-gray-600">Dono (vendedor)</label>
            <select {...register("vendedorDonoId")} className={inputCls}>
              <option value="">{lead ? "—" : "Atribuir depois"}</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-gray-600">Segmento</label>
          <select {...register("segmento")} className={inputCls}>
            {Object.values(Segmento).map((s) => (
              <option key={s} value={s}>
                {SEGMENTO_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Temperatura</label>
          <select {...register("temperatura")} className={inputCls}>
            {Object.values(Temperatura).map((t) => (
              <option key={t} value={t}>
                {TEMPERATURA_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Campanha (origem)</label>
          <input {...register("origemCampanha")} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Anúncio (origem)</label>
          <input {...register("origemAnuncio")} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Matrícula prevista</label>
          <input type="number" step="0.01" {...register("valorPrevisto")} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Plano previsto</label>
          <input {...register("planoPrevisto")} placeholder="Ex.: Regular A1" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Comissão prevista</label>
          <input type="number" step="0.01" {...register("comissaoPrevista")} className={inputCls} />
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" {...register("b2b")} className="rounded border-gray-300" />
        Lead corporativo (B2B)
      </label>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? "Salvando…" : "Salvar lead"}
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
