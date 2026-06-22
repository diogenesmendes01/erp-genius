"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { TipoCobranca } from "@prisma/client";
import { criarPreco, alternarPrecoAtivo } from "@/server/catalogo/acoes";

export interface PrecoRow {
  id: string;
  valor: number;
  moeda: string;
  ativo: boolean;
  tipoCobranca: TipoCobranca;
  versaoEstudo: string | null;
  pais: { nome: string };
  produto: { idioma: { nome: string }; modalidade: { nome: string } };
}

export interface ProdutoOpcao {
  id: string;
  label: string;
}

const inputCls =
  "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export const TIPO_LABEL: Record<TipoCobranca, string> = {
  MATRICULA: "Taxa de matrícula",
  MENSALIDADE: "Mensalidade",
  HORA_PARTICULAR: "Hora particular",
  MATERIAL: "Material",
  CERTIFICADO: "Certificado",
};

export function PrecosPainel({
  precos,
  paises,
  produtos,
}: {
  precos: PrecoRow[];
  paises: { id: string; nome: string; moedaLocal: string }[];
  produtos: ProdutoOpcao[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [paisId, setPaisId] = useState(paises[0]?.id ?? "");
  const [produtoId, setProdutoId] = useState(produtos[0]?.id ?? "");
  const [tipoCobranca, setTipo] = useState<TipoCobranca>(TipoCobranca.MENSALIDADE);
  const [valor, setValor] = useState("");
  const [versaoEstudo, setVersao] = useState("");

  const moedaPais = paises.find((p) => p.id === paisId)?.moedaLocal ?? "";

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const res = await criarPreco({
      paisId,
      produtoId,
      tipoCobranca,
      valor: valor === "" ? 0 : Number(valor),
      versaoEstudo: versaoEstudo || undefined,
    });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    setValor("");
    setVersao("");
    setAberto(false);
    router.refresh();
  }

  async function alternar(id: string) {
    setErro(null);
    const res = await alternarPrecoAtivo(id);
    if (!res.ok) setErro(res.erro);
    else router.refresh();
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Preços de referência</h2>
        {!aberto && (
          <button
            onClick={() => setAberto(true)}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <IconPlus className="h-4 w-4" /> Novo preço
          </button>
        )}
      </div>
      <p className="mb-3 text-sm text-gray-500">
        País × produto × tipo de cobrança. Um novo preço substitui o ativo anterior (vira histórico).
      </p>
      {erro && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {aberto && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-surface p-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600">País</label>
              <select value={paisId} onChange={(e) => setPaisId(e.target.value)} className={inputCls + " w-full"}>
                {paises.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Produto</label>
              <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className={inputCls + " w-full"}>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Tipo de cobrança</label>
              <select
                value={tipoCobranca}
                onChange={(e) => setTipo(e.target.value as TipoCobranca)}
                className={inputCls + " w-full"}
              >
                {Object.values(TipoCobranca).map((t) => (
                  <option key={t} value={t}>
                    {TIPO_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Valor ({moedaPais || "moeda do país"})</label>
              <input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={inputCls + " w-full"}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Versão do estudo (opcional)</label>
              <input value={versaoEstudo} onChange={(e) => setVersao(e.target.value)} className={inputCls + " w-full"} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={salvar}
              disabled={salvando}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar preço"}
            </button>
            <button
              onClick={() => setAberto(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">País</th>
              <th className="px-4 py-2 font-medium">Produto</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Valor</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {precos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                  Nenhum preço cadastrado.
                </td>
              </tr>
            ) : (
              precos.map((p) => (
                <tr key={p.id} className={"hover:bg-gray-50 " + (p.ativo ? "" : "text-gray-400")}>
                  <td className="px-4 py-3">{p.pais.nome}</td>
                  <td className="px-4 py-3">
                    {p.produto.idioma.nome} · {p.produto.modalidade.nome}
                  </td>
                  <td className="px-4 py-3">{TIPO_LABEL[p.tipoCobranca]}</td>
                  <td className="px-4 py-3">
                    {p.moeda} {p.valor.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (p.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")
                      }
                    >
                      {p.ativo ? "Ativo" : "Histórico"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => alternar(p.id)} className="text-xs text-gray-500 hover:text-gray-800">
                      {p.ativo ? "Desativar" : "Reativar"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
