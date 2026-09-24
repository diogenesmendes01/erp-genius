"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Segmento, Temperatura } from "@prisma/client";
import { SEGMENTO_LABEL, TEMPERATURA_LABEL } from "@/lib/labels";
import { LeadSchema, type LeadInput } from "@/server/comercial/schema";
import { criarLead, editarLead } from "@/server/comercial/acoes";
import { CampoMoeda } from "@/components/CampoMoeda";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

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
  // criarLead/editarLead não recebem chave de idempotência (server/comercial/acoes.ts:136 cria um lead
  // novo a cada chamada; :244 sobrescreve): resultado incerto manda conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
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
    const desfecho = await acao.executar<unknown>(() => (lead ? editarLead(lead.id, data) : criarLead(data)));
    // Fecha o formulário só com o lead confirmado pelo servidor.
    if (desfecho?.tipo !== "ok") return;
    router.refresh();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-gray-200 bg-surface p-5">
      <h2 className="mb-4 text-sm font-medium">{lead ? "Editar lead" : "Novo lead"}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
        <div className="sm:col-span-2 md:col-span-1">
          <label htmlFor="lead-nome" className="mb-1 block text-xs text-gray-600">Nome</label>
          <input
            id="lead-nome"
            {...register("nome")}
            aria-invalid={errors.nome ? true : undefined}
            aria-describedby={errors.nome ? "lead-nome-erro" : undefined}
            className={inputCls}
          />
          {errors.nome && <p id="lead-nome-erro" role="alert" className="mt-1 text-xs text-red-600">{errors.nome.message}</p>}
        </div>
        <div>
          <label htmlFor="lead-telefone" className="mb-1 block text-xs text-gray-600">WhatsApp/telefone</label>
          <input
            id="lead-telefone"
            {...register("telefoneE164")}
            aria-invalid={errors.telefoneE164 ? true : undefined}
            aria-describedby={errors.telefoneE164 ? "lead-telefone-erro" : undefined}
            placeholder="+5511999998888"
            className={inputCls}
          />
          {errors.telefoneE164 && (
            <p id="lead-telefone-erro" role="alert" className="mt-1 text-xs text-red-600">{errors.telefoneE164.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="lead-pais" className="mb-1 block text-xs text-gray-600">País</label>
          <select id="lead-pais" {...register("paisId")} className={inputCls}>
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
            <label htmlFor="lead-vendedor-dono" className="mb-1 block text-xs text-gray-600">Dono (vendedor)</label>
            <select id="lead-vendedor-dono" {...register("vendedorDonoId")} className={inputCls}>
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
          <label htmlFor="lead-segmento" className="mb-1 block text-xs text-gray-600">Segmento</label>
          <select id="lead-segmento" {...register("segmento")} className={inputCls}>
            {Object.values(Segmento).map((s) => (
              <option key={s} value={s}>
                {SEGMENTO_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lead-temperatura" className="mb-1 block text-xs text-gray-600">Temperatura</label>
          <select id="lead-temperatura" {...register("temperatura")} className={inputCls}>
            {Object.values(Temperatura).map((t) => (
              <option key={t} value={t}>
                {TEMPERATURA_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lead-origem-campanha" className="mb-1 block text-xs text-gray-600">Campanha (origem)</label>
          <input id="lead-origem-campanha" {...register("origemCampanha")} className={inputCls} />
        </div>
        <div>
          <label htmlFor="lead-origem-anuncio" className="mb-1 block text-xs text-gray-600">Anúncio (origem)</label>
          <input id="lead-origem-anuncio" {...register("origemAnuncio")} className={inputCls} />
        </div>
        <div>
          <label htmlFor="lead-valor-previsto" className="mb-1 block text-xs text-gray-600">Matrícula prevista</label>
          <Controller
            control={control}
            name="valorPrevisto"
            render={({ field }) => (
              <CampoMoeda id="lead-valor-previsto" value={field.value == null ? "" : String(field.value)} onChange={field.onChange} className={inputCls} />
            )}
          />
        </div>
        <div>
          <label htmlFor="lead-plano-previsto" className="mb-1 block text-xs text-gray-600">Plano previsto</label>
          <input id="lead-plano-previsto" {...register("planoPrevisto")} placeholder="Ex.: Regular A1" className={inputCls} />
        </div>
        <div>
          <label htmlFor="lead-comissao-prevista" className="mb-1 block text-xs text-gray-600">Comissão prevista</label>
          <Controller
            control={control}
            name="comissaoPrevista"
            render={({ field }) => (
              <CampoMoeda id="lead-comissao-prevista" value={field.value == null ? "" : String(field.value)} onChange={field.onChange} className={inputCls} />
            )}
          />
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" {...register("b2b")} className="rounded border-gray-300" />
        Lead corporativo (B2B)
      </label>

      <FeedbackAcao erro={acao.erro} className="mt-4" />

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={acao.ocupado}
          className="rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
        >
          {acao.ocupado ? "Salvando…" : "Salvar lead"}
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
