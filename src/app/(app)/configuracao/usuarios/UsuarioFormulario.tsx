"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Papel } from "@prisma/client";
import { PAPEL_LABEL } from "@/lib/roles";
import { CAPACIDADES_LISTA, CAPACIDADES_LABEL } from "@/lib/capacidades";
import {
  CriarUsuarioSchema,
  EditarUsuarioSchema,
  type CriarUsuarioInput,
} from "@/server/acesso/schema";
import { criarUsuario, editarUsuario } from "@/server/acesso/acoes";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export interface UsuarioParaEditar {
  id: string;
  nome: string;
  email: string;
  papeis: Papel[];
  limiteDescontoPct: number | null;
  limiteDescontoTaxaPct: number | null;
  limiteDescontoMensalidadePct: number | null;
  gerenteComercialId: string | null;
  permissoes: string[];
}

type FormValues = CriarUsuarioInput;

export function UsuarioFormulario({
  usuario,
  gerentes = [],
  onClose,
}: {
  usuario?: UsuarioParaEditar;
  gerentes?: { id: string; nome: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(usuario ? EditarUsuarioSchema : CriarUsuarioSchema),
    defaultValues: usuario
      ? {
          nome: usuario.nome,
          email: usuario.email,
          papeis: usuario.papeis,
          limiteDescontoPct: usuario.limiteDescontoPct,
          limiteDescontoTaxaPct: usuario.limiteDescontoTaxaPct,
          limiteDescontoMensalidadePct: usuario.limiteDescontoMensalidadePct,
          gerenteComercialId: usuario.gerenteComercialId,
          permissoes: CAPACIDADES_LISTA.filter((p) => usuario.permissoes.includes(p)),
          senha: "",
        }
      : { nome: "", email: "", papeis: [], limiteDescontoPct: null, limiteDescontoTaxaPct: null, limiteDescontoMensalidadePct: null, gerenteComercialId: null, permissoes: [], senha: "" },
  });

  async function onSubmit(data: FormValues) {
    setErro(null);
    const res = usuario ? await editarUsuario(usuario.id, data) : await criarUsuario(data);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-gray-200 bg-surface p-5">
      <h2 className="mb-4 text-sm font-medium">
        {usuario ? `Editar usuário — ${usuario.nome}` : "Novo usuário"}
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Nome</label>
          <input {...register("nome")} className={inputCls} />
          {errors.nome && <p className="mt-1 text-xs text-red-600">{errors.nome.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">E-mail</label>
          <input type="email" {...register("email")} className={inputCls} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">
            {usuario ? "Nova senha (deixe vazio p/ manter)" : "Senha"}
          </label>
          <input type="password" {...register("senha")} className={inputCls} />
          {errors.senha && <p className="mt-1 text-xs text-red-600">{errors.senha.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">
            Gerente comercial da equipe
          </label>
          <select {...register("gerenteComercialId")} className={inputCls}>
            <option value="">Sem equipe atribuída</option>
            {gerentes.filter((g) => g.id !== usuario?.id).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Desconto máximo na taxa (%)</label>
          <input type="number" min="0" max="100" step="0.01" {...register("limiteDescontoTaxaPct")} className={inputCls} />
          {errors.limiteDescontoTaxaPct && <p className="text-xs text-red-600">{String(errors.limiteDescontoTaxaPct.message)}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Desconto máximo na mensalidade (%)</label>
          <input type="number" min="0" max="100" step="0.01" {...register("limiteDescontoMensalidadePct")} className={inputCls} />
          {errors.limiteDescontoMensalidadePct && <p className="text-xs text-red-600">{String(errors.limiteDescontoMensalidadePct.message)}</p>}
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">Limite vazio exige aprovação para conceder desconto. Taxa e mensalidade são verificadas separadamente.</p>

      <div className="mt-4">
        <label className="mb-2 block text-xs text-gray-600">Papéis</label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {Object.values(Papel).map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                value={p}
                {...register("papeis")}
                className="rounded border-gray-300"
              />
              {PAPEL_LABEL[p]}
            </label>
          ))}
        </div>
        {errors.papeis && <p className="mt-1 text-xs text-red-600">{errors.papeis.message}</p>}
      </div>

      {erro && <p role="alert" className="mt-4 text-sm text-red-600">{erro}</p>}

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs text-gray-600">Permissões específicas</legend>
        <div className="grid gap-2 md:grid-cols-2">
          {CAPACIDADES_LISTA.map((p) => <label key={p} className="flex items-center gap-2 text-sm"><input type="checkbox" value={p} {...register("permissoes")} />{CAPACIDADES_LABEL[p]}</label>)}
        </div>
      </fieldset>

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
        >
          {isSubmitting ? "Salvando…" : "Salvar usuário"}
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
