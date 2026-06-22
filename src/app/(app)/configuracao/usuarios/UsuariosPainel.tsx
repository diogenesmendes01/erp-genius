"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Papel } from "@prisma/client";
import { IconPlus } from "@tabler/icons-react";
import { PAPEL_LABEL } from "@/lib/roles";
import { alternarUsuarioAtivo } from "@/server/acesso/acoes";
import { UsuarioFormulario, type UsuarioParaEditar } from "./UsuarioFormulario";

export interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  papeis: Papel[];
  ativo: boolean;
  limiteDescontoPct: number | null;
  ultimoAcesso: string | null; // ISO ou null
}

function formatarAcesso(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function UsuariosPainel({ usuarios }: { usuarios: UsuarioRow[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<"none" | "novo" | { editar: UsuarioParaEditar }>("none");

  async function alternar(id: string) {
    setErro(null);
    const res = await alternarUsuarioAtivo(id);
    if (!res.ok) setErro(res.erro);
    else router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">7 papéis, multi-papel, limite de desconto e último acesso.</p>
        {form === "none" && (
          <button
            onClick={() => setForm("novo")}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <IconPlus className="h-4 w-4" /> Novo usuário
          </button>
        )}
      </div>

      {erro && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {form !== "none" && (
        <div className="mb-6">
          <UsuarioFormulario
            usuario={typeof form === "object" ? form.editar : undefined}
            onClose={() => setForm("none")}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Usuário</th>
              <th className="px-4 py-2 font-medium">Papéis</th>
              <th className="px-4 py-2 font-medium">Limite %</th>
              <th className="px-4 py-2 font-medium">Último acesso</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{u.nome}</div>
                  <span className="text-xs text-gray-400">{u.email}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {u.papeis.map((p) => PAPEL_LABEL[p]).join(", ")}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {u.limiteDescontoPct == null ? "—" : `${u.limiteDescontoPct}%`}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatarAcesso(u.ultimoAcesso)}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-xs font-medium " +
                      (u.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")
                    }
                  >
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() =>
                        setForm({
                          editar: {
                            id: u.id,
                            nome: u.nome,
                            email: u.email,
                            papeis: u.papeis,
                            limiteDescontoPct: u.limiteDescontoPct,
                          },
                        })
                      }
                      className="text-xs text-brand-700 hover:text-brand-800"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => alternar(u.id)}
                      className="text-xs text-gray-500 hover:text-gray-800"
                    >
                      {u.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
