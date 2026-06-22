"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { criarProduto } from "@/server/catalogo/acoes";

export interface ProdutoRow {
  id: string;
  idioma: { nome: string };
  modalidade: { nome: string };
  _count: { precos: number; produtosPais: number };
}

const inputCls =
  "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export function ProdutosPainel({
  produtos,
  idiomas,
  modalidades,
}: {
  produtos: ProdutoRow[];
  idiomas: { id: string; nome: string }[];
  modalidades: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [idiomaId, setIdiomaId] = useState(idiomas[0]?.id ?? "");
  const [modalidadeId, setModalidadeId] = useState(modalidades[0]?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (!idiomaId || !modalidadeId) return;
    setErro(null);
    setSalvando(true);
    const res = await criarProduto({ idiomaId, modalidadeId });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    router.refresh();
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Produtos</h2>
      <p className="mb-3 text-sm text-gray-500">Unidade vendável = idioma × modalidade.</p>
      {erro && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Idioma</th>
              <th className="px-4 py-2 font-medium">Modalidade</th>
              <th className="px-4 py-2 font-medium">Preços</th>
              <th className="px-4 py-2 font-medium">Países</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {produtos.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{p.idioma.nome}</td>
                <td className="px-4 py-3 text-gray-600">{p.modalidade.nome}</td>
                <td className="px-4 py-3 text-gray-600">{p._count.precos}</td>
                <td className="px-4 py-3 text-gray-600">{p._count.produtosPais}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={idiomaId} onChange={(e) => setIdiomaId(e.target.value)} className={inputCls}>
          {idiomas.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
            </option>
          ))}
        </select>
        <select value={modalidadeId} onChange={(e) => setModalidadeId(e.target.value)} className={inputCls}>
          {modalidades.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        <button
          onClick={adicionar}
          disabled={salvando}
          className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <IconPlus className="h-4 w-4" /> Adicionar produto
        </button>
      </div>
    </section>
  );
}
