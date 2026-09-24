"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPais } from "@prisma/client";
import { IconPlus } from "@tabler/icons-react";
import { alterarStatusPais, alternarProdutoPais } from "@/server/paises/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { PaisFormulario, type PaisParaEditar } from "./PaisFormulario";

export interface PaisRow {
  id: string;
  nome: string;
  codigoISO: string;
  moedaLocal: string;
  ddi: string;
  fuso: string;
  idioma: string;
  status: StatusPais;
  tiposDocumento: { id: string; nome: string; validador: string }[];
  produtosOferecidos: string[];
  _count: { produtosPais: number; precos: number; alunos: number };
}

const STATUS_INFO: Record<StatusPais, { label: string; cls: string }> = {
  RASCUNHO: { label: "Rascunho", cls: "bg-gray-100 text-gray-600" },
  ATIVO: { label: "Ativo", cls: "bg-green-100 text-green-700" },
  PAUSADO: { label: "Pausado", cls: "bg-amber-100 text-amber-700" },
  ENCERRADO: { label: "Encerrado", cls: "bg-red-100 text-red-700" },
};

// Transições oferecidas por status (ciclo de vida do mercado, doc 04).
const ACOES_STATUS: Record<StatusPais, { label: string; alvo: StatusPais }[]> = {
  RASCUNHO: [{ label: "Ativar", alvo: StatusPais.ATIVO }],
  ATIVO: [
    { label: "Pausar", alvo: StatusPais.PAUSADO },
    { label: "Encerrar", alvo: StatusPais.ENCERRADO },
  ],
  PAUSADO: [
    { label: "Reativar", alvo: StatusPais.ATIVO },
    { label: "Encerrar", alvo: StatusPais.ENCERRADO },
  ],
  ENCERRADO: [],
};

export function PaisesPainel({
  paises,
  produtos,
}: {
  paises: PaisRow[];
  produtos: { id: string; label: string }[];
}) {
  const router = useRouter();
  // Sem chave de idempotência: alternarProdutoPais inverte o estado atual (repetir desfaz) e
  // alterarStatusPais não recebe chave — a falha de rede manda conferir a página antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  const [form, setForm] = useState<"none" | "novo" | { editar: PaisParaEditar }>("none");
  // Onde mostrar o resultado: nas ações de status da linha ("status:id") ou no catálogo do país ("catalogo:id").
  const [origem, setOrigem] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<string | null>(null);

  async function mudarStatus(id: string, alvo: StatusPais) {
    setOrigem("status:" + id);
    const d = await acao.executar(() => alterarStatusPais(id, alvo));
    if (d?.tipo === "ok") router.refresh();
  }

  async function toggleProduto(paisId: string, produtoId: string) {
    setOrigem("catalogo:" + paisId);
    const d = await acao.executar(() => alternarProdutoPais(paisId, produtoId));
    if (d?.tipo === "ok") router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Tudo que muda por país: moeda, documentos, DDI, status do mercado.
        </p>
        {form === "none" && (
          <button
            onClick={() => setForm("novo")}
            className="flex items-center gap-1.5 rounded-md bg-brand-solid px-3 py-2 text-sm font-medium text-white hover:brightness-95"
          >
            <IconPlus className="h-4 w-4" /> Novo país
          </button>
        )}
      </div>

      {form !== "none" && (
        <div className="mb-6">
          <PaisFormulario
            pais={typeof form === "object" ? form.editar : undefined}
            onClose={() => setForm("none")}
          />
        </div>
      )}

      {paises.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          Nenhum país cadastrado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">País</th>
                <th className="px-4 py-2 font-medium">Moeda</th>
                <th className="px-4 py-2 font-medium">DDI</th>
                <th className="px-4 py-2 font-medium">Documentos</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paises.flatMap((p) => [
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{p.nome}</span>
                    <span className="ml-2 text-xs text-gray-400">{p.codigoISO}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.moedaLocal}</td>
                  <td className="px-4 py-3 text-gray-600">{p.ddi}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.tiposDocumento.map((d) => d.nome).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_INFO[p.status].cls
                      }
                    >
                      {STATUS_INFO[p.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          setForm({
                            editar: {
                              id: p.id,
                              nome: p.nome,
                              codigoISO: p.codigoISO,
                              moedaLocal: p.moedaLocal,
                              ddi: p.ddi,
                              fuso: p.fuso,
                              idioma: p.idioma,
                              tiposDocumento: p.tiposDocumento.map((d) => ({
                                nome: d.nome,
                                validador: d.validador,
                              })),
                            },
                          })
                        }
                        className="text-xs text-brand-700 hover:text-brand-800"
                      >
                        Editar
                      </button>
                      {ACOES_STATUS[p.status].map((a) => (
                        <button
                          key={a.alvo}
                          onClick={() => mudarStatus(p.id, a.alvo)}
                          disabled={acao.ocupado}
                          className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50"
                        >
                          {a.label}
                        </button>
                      ))}
                      <button
                        onClick={() => setCatalogo(catalogo === p.id ? null : p.id)}
                        className="text-xs text-gray-500 hover:text-gray-800"
                      >
                        Catálogo
                      </button>
                    </div>
                    <FeedbackAcao erro={origem === "status:" + p.id ? acao.erro : null} className="mt-1" />
                  </td>
                </tr>,
                catalogo === p.id ? (
                  <tr key={p.id + "-cat"} className="bg-gray-50">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="text-xs font-medium text-gray-600">Idiomas/modalidades habilitados neste país</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                        {produtos.map((prod) => (
                          <label key={prod.id} className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={p.produtosOferecidos.includes(prod.id)}
                              onChange={() => toggleProduto(p.id, prod.id)}
                              disabled={acao.ocupado}
                              className="rounded border-gray-300"
                            />
                            {prod.label}
                          </label>
                        ))}
                        {produtos.length === 0 && <span className="text-xs text-gray-400">Cadastre produtos no Catálogo.</span>}
                      </div>
                      <FeedbackAcao erro={origem === "catalogo:" + p.id ? acao.erro : null} className="mt-2" />
                    </td>
                  </tr>
                ) : null,
              ].filter(Boolean))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
