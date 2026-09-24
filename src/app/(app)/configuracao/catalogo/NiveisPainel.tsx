"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { criarNivel } from "@/server/catalogo/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { IdiomaRow } from "./IdiomasPainel";

const inputCls =
  "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export function NiveisPainel({ idiomas }: { idiomas: IdiomaRow[] }) {
  const router = useRouter();
  const [idiomaId, setIdiomaId] = useState(idiomas[0]?.id ?? "");
  const [codigo, setCodigo] = useState("");
  const [ordem, setOrdem] = useState("");
  // Sem chave de idempotência: criarNivel cria um registro novo a cada chamada — a falha de rede
  // manda conferir a página antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });

  async function adicionar() {
    if (!idiomaId || !codigo.trim()) return;
    const d = await acao.executar(() => criarNivel({ idiomaId, codigo: codigo.trim(), ordem: ordem === "" ? 0 : Number(ordem) }));
    if (d?.tipo !== "ok") return;
    setCodigo("");
    setOrdem("");
    router.refresh();
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Níveis (CEFR)</h2>

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
        <select aria-label="Idioma do novo nível" value={idiomaId} onChange={(e) => setIdiomaId(e.target.value)} className={inputCls}>
          {idiomas.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
            </option>
          ))}
        </select>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          aria-label="Código do novo nível"
          placeholder="Código (ex.: B1)"
          className={inputCls + " w-40"}
        />
        <input
          value={ordem}
          onChange={(e) => setOrdem(e.target.value)}
          type="number"
          aria-label="Ordem do novo nível"
          placeholder="Ordem"
          className={inputCls + " w-28"}
        />
        <button
          onClick={adicionar}
          disabled={acao.ocupado}
          className="flex items-center gap-1.5 rounded-md bg-brand-solid px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
        >
          <IconPlus className="h-4 w-4" /> Adicionar nível
        </button>
      </div>
      <FeedbackAcao erro={acao.erro} className="mt-3" />
    </section>
  );
}
