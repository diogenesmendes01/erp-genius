"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { criarProduto } from "@/server/catalogo/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { botaoClasses } from "@/components/Botao";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CampoCombobox } from "@/components/ui/combobox";
export interface ProdutoRow {
  id: string;
  idioma: { nome: string };
  modalidade: { nome: string };
  _count: { precos: number; produtosPais: number };
}

const inputCls =
  "rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500";

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
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();

  async function adicionar() {
    if (!idiomaId || !modalidadeId) return;
    const d = await acao.executar(() => criarProduto({ idiomaId, modalidadeId, chaveIdempotencia: tentativa.atual }));
    tentativa.depoisDo(d);
    if (d?.tipo === "ok") router.refresh();
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Produtos</h2>
      <p className="mb-3 text-sm text-gray-500">Unidade vendável = idioma × modalidade.</p>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table className="w-full text-sm">
          <TableHeader className="bg-surface-muted text-left text-xs text-gray-500">
            <TableRow>
              <TableHead className="px-4 py-2 font-medium">Idioma</TableHead>
              <TableHead className="px-4 py-2 font-medium">Modalidade</TableHead>
              <TableHead className="px-4 py-2 font-medium">Preços</TableHead>
              <TableHead className="px-4 py-2 font-medium">Países</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {produtos.map((p) => (
              <TableRow key={p.id} className="hover:bg-highlight">
                <TableCell className="px-4 py-3 font-medium text-gray-800">{p.idioma.nome}</TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{p.modalidade.nome}</TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{p._count.precos}</TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{p._count.produtosPais}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CampoCombobox value={idiomaId} onChange={(e) => setIdiomaId(e.target.value)} className={inputCls} aria-label="Idioma do novo produto" opcoes={idiomas.map((i) => ({ valor: String(i.id), rotulo: i.nome }))} />
        <CampoCombobox value={modalidadeId} onChange={(e) => setModalidadeId(e.target.value)} className={inputCls} aria-label="Modalidade do novo produto" opcoes={modalidades.map((m) => ({ valor: String(m.id), rotulo: m.nome }))} />
        <button
          onClick={adicionar}
          disabled={acao.ocupado}
          className={botaoClasses({ tamanho: "lg" })}
        >
          <IconPlus className="h-4 w-4" /> Adicionar produto
        </button>
      </div>
      <FeedbackAcao erro={acao.erro} className="mt-3" />
    </section>
  );
}
