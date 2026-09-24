"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { criarIdioma, alternarIdiomaAtivo } from "@/server/catalogo/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

export interface IdiomaRow {
  id: string;
  nome: string;
  ativo: boolean;
  niveis: { id: string; codigo: string; ordem: number }[];
  _count: { produtos: number };
}

const inputCls =
  "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export function IdiomasPainel({ idiomas }: { idiomas: IdiomaRow[] }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  // Sem chave de idempotência: criarIdioma cria outro registro a cada chamada e alternarIdiomaAtivo
  // inverte o estado atual — a falha de rede manda conferir a página antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  // Onde mostrar o resultado: na linha do idioma alternado ou junto do botão "Adicionar".
  const [origem, setOrigem] = useState<string | null>(null);

  async function adicionar() {
    if (!nome.trim()) return;
    setOrigem("novo");
    const d = await acao.executar(() => criarIdioma({ nome: nome.trim() }));
    if (d?.tipo !== "ok") return;
    setNome("");
    router.refresh();
  }

  async function alternar(id: string, sucesso: string) {
    setOrigem(id);
    const d = await acao.executar(() => alternarIdiomaAtivo(id), sucesso);
    if (d?.tipo === "ok") router.refresh();
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Idiomas</h2>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Idioma</th>
              <th className="px-4 py-2 font-medium">Níveis</th>
              <th className="px-4 py-2 font-medium">Produtos</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {idiomas.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{i.nome}</td>
                <td className="px-4 py-3 text-gray-600">{i.niveis.length}</td>
                <td className="px-4 py-3 text-gray-600">{i._count.produtos}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-xs font-medium " +
                      (i.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")
                    }
                  >
                    {i.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => alternar(i.id, i.ativo ? "Idioma desativado." : "Idioma ativado.")}
                    disabled={acao.ocupado}
                    className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50"
                  >
                    {i.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <FeedbackAcao erro={origem === i.id ? acao.erro : null} sucesso={origem === i.id ? acao.sucesso : undefined} className="mt-1 text-left" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-label="Nome do novo idioma"
          placeholder="Novo idioma (ex.: Inglês)"
          className={inputCls + " w-64"}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
        />
        <button
          onClick={adicionar}
          disabled={acao.ocupado}
          className="flex items-center gap-1.5 rounded-md bg-brand-solid px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
        >
          <IconPlus className="h-4 w-4" /> Adicionar
        </button>
      </div>
      <FeedbackAcao erro={origem === "novo" ? acao.erro : null} className="mt-3" />
    </section>
  );
}
