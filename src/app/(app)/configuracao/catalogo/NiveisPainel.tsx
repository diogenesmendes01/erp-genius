"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { criarNivel } from "@/server/catalogo/acoes";
import type { IdiomaRow } from "./IdiomasPainel";

const inputCls =
  "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export function NiveisPainel({ idiomas }: { idiomas: IdiomaRow[] }) {
  const router = useRouter();
  const [idiomaId, setIdiomaId] = useState(idiomas[0]?.id ?? "");
  const [codigo, setCodigo] = useState("");
  const [ordem, setOrdem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (!idiomaId || !codigo.trim()) return;
    setErro(null);
    setSalvando(true);
    const res = await criarNivel({ idiomaId, codigo: codigo.trim(), ordem: ordem === "" ? 0 : Number(ordem) });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    setCodigo("");
    setOrdem("");
    router.refresh();
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Níveis (CEFR)</h2>
      {erro && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <div className="flex flex-col gap-4">
        {idiomas.map((i) => (
          <div key={i.id} className="rounded-lg border border-gray-200 p-4">
            <div className="mb-2 text-sm font-medium text-gray-700">{i.nome}</div>
            {i.niveis.length === 0 ? (
              <p className="text-xs text-gray-400">Sem níveis.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {i.niveis.map((n) => (
                  <span
                    key={n.id}
                    className="rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                    title={`ordem ${n.ordem}`}
                  >
                    {n.codigo}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={idiomaId} onChange={(e) => setIdiomaId(e.target.value)} className={inputCls}>
          {idiomas.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
            </option>
          ))}
        </select>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Código (ex.: B1)"
          className={inputCls + " w-40"}
        />
        <input
          value={ordem}
          onChange={(e) => setOrdem(e.target.value)}
          type="number"
          placeholder="Ordem"
          className={inputCls + " w-28"}
        />
        <button
          onClick={adicionar}
          disabled={salvando}
          className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <IconPlus className="h-4 w-4" /> Adicionar nível
        </button>
      </div>
    </section>
  );
}
