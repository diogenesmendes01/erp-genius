"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmpresaResumo } from "@/server/empresas/consultas";
import { salvarEmpresa } from "@/server/empresas/acoes";

// B2B — lista de empresas + criação (Fase 2, doc 03). A ficha (colaboradores, lote,
// faturas) vive em /empresas/[id].

const btnPri = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const inputCls = "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500";

export function EmpresasCliente({
  empresas,
  paises,
}: {
  empresas: EmpresaResumo[];
  paises: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [paisId, setPaisId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function criar() {
    setOcupado(true);
    setErro(null);
    const r = await salvarEmpresa({ nome, paisId });
    setOcupado(false);
    if (!r.ok) return setErro(r.erro ?? "Erro ao criar.");
    setCriando(false);
    setNome("");
    if (r.dado) router.push(`/empresas/${r.dado.id}`);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Empresas (B2B)</h1>
          <p className="mt-1 text-sm text-gray-500">
            Contrato corporativo: colaboradores matriculados em lote e fatura única por mês.
          </p>
        </div>
        <button className={btnPri} onClick={() => setCriando((v) => !v)}>Nova empresa</button>
      </div>

      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {criando && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-surface p-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">Nome da empresa</span>
            <input className={inputCls + " w-72"} value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">País (moeda/vencimentos)</span>
            <select className={inputCls} value={paisId} onChange={(e) => setPaisId(e.target.value)}>
              <option value="">—</option>
              {paises.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>
          <button className={btnPri} disabled={ocupado || nome.trim().length < 2} onClick={criar}>
            {ocupado ? "Criando…" : "Criar"}
          </button>
        </div>
      )}

      {empresas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          Nenhuma empresa ainda. Crie a primeira para matricular colaboradores em lote.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Código</th>
                <th className="px-4 py-2 font-medium">Empresa</th>
                <th className="px-4 py-2 font-medium">País</th>
                <th className="px-4 py-2 font-medium">Colaboradores</th>
                <th className="px-4 py-2 font-medium">Faturas em aberto</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {empresas.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">{e.codigo ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Link href={`/empresas/${e.id}`} className="font-medium text-gray-800 hover:underline">
                      {e.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{e.pais ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-700">{e.colaboradores}</td>
                  <td className="px-4 py-2 text-gray-700">{e.faturasAbertas}</td>
                  <td className="px-4 py-2">
                    <span className={"rounded-full px-2 py-0.5 text-xs " + (e.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                      {e.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
