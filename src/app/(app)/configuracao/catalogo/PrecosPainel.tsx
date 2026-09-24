"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { TipoCobranca } from "@prisma/client";
import { formatarMoeda, parseMoeda } from "@/lib/dinheiro";
import { criarPreco, alternarPrecoAtivo } from "@/server/catalogo/acoes";
import { CampoMoeda } from "@/components/CampoMoeda";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";

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
  MULTA_ENCERRAMENTO: "Multa de encerramento",
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
  // Sem chave de idempotência: criarPreco cria um preço novo (e aposenta o ativo) a cada chamada e
  // alternarPrecoAtivo inverte o estado atual — a falha de rede manda conferir a página antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  // Onde mostrar o resultado: no formulário de novo preço ou na linha do preço alternado.
  const [origem, setOrigem] = useState<string | null>(null);

  const [paisId, setPaisId] = useState(paises[0]?.id ?? "");
  const [produtoId, setProdutoId] = useState(produtos[0]?.id ?? "");
  const [tipoCobranca, setTipo] = useState<TipoCobranca>(TipoCobranca.MENSALIDADE);
  const [valor, setValor] = useState("");
  const [versaoEstudo, setVersao] = useState("");

  const moedaPais = paises.find((p) => p.id === paisId)?.moedaLocal ?? "";

  async function salvar() {
    setOrigem("novo");
    // Nunca ?? 0 aqui: texto inválido no valor criaria um preço de referência ZERO, que
    // matrículas passariam a usar como preço negociado — silencioso.
    const valorNumero = parseMoeda(valor);
    if (valorNumero === null) {
      acao.setErro("Informe o valor, com no máximo duas casas decimais.");
      return;
    }
    const d = await acao.executar(() => criarPreco({
      paisId,
      produtoId,
      tipoCobranca,
      valor: valorNumero,
      versaoEstudo: versaoEstudo || undefined,
    }));
    if (d?.tipo !== "ok") return;
    setValor("");
    setVersao("");
    setAberto(false);
    router.refresh();
  }

  async function alternar(id: string, sucesso: string) {
    setOrigem(id);
    const d = await acao.executar(() => alternarPrecoAtivo(id), sucesso);
    if (d?.tipo === "ok") router.refresh();
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Preços de referência</h2>
        {!aberto && (
          <button
            onClick={() => setAberto(true)}
            className={botaoClasses({ tamanho: "md" })}
          >
            <IconPlus className="h-4 w-4" /> Novo preço
          </button>
        )}
      </div>
      <p className="mb-3 text-sm text-gray-500">
        País × produto × tipo de cobrança. Um novo preço substitui o ativo anterior (vira histórico).
      </p>

      {aberto && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-surface p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="precos-pais" className="mb-1 block text-xs text-gray-600">País</label>
              <select id="precos-pais" value={paisId} onChange={(e) => setPaisId(e.target.value)} className={inputCls + " w-full"}>
                {paises.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="precos-produto" className="mb-1 block text-xs text-gray-600">Produto</label>
              <select id="precos-produto" value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className={inputCls + " w-full"}>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="precos-tipo-cobranca" className="mb-1 block text-xs text-gray-600">Tipo de cobrança</label>
              <select
                id="precos-tipo-cobranca"
                value={tipoCobranca}
                onChange={(e) => setTipo(e.target.value as TipoCobranca)}
                className={inputCls + " w-full"}
              >
                {Object.values(TipoCobranca).filter(t => t !== TipoCobranca.MULTA_ENCERRAMENTO).map((t) => (
                  <option key={t} value={t}>
                    {TIPO_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="precos-valor" className="mb-1 block text-xs text-gray-600">Valor ({moedaPais || "moeda do país"})</label>
              <CampoMoeda
                id="precos-valor"
                moeda={moedaPais}
                value={valor}
                onChange={setValor}
                className={inputCls + " w-full"}
              />
            </div>
            <div>
              <label htmlFor="precos-versao-estudo" className="mb-1 block text-xs text-gray-600">Versão do estudo (opcional)</label>
              <input id="precos-versao-estudo" value={versaoEstudo} onChange={(e) => setVersao(e.target.value)} className={inputCls + " w-full"} />
            </div>
          </div>
          <FeedbackAcao erro={origem === "novo" ? acao.erro : null} className="mt-4" />
          <div className="mt-4 flex gap-2">
            <button
              onClick={salvar}
              disabled={acao.ocupado}
              className={botaoClasses({ tamanho: "lg" })}
            >
              {acao.ocupado ? "Salvando…" : "Salvar preço"}
            </button>
            <button
              onClick={() => setAberto(false)}
              className={botaoClasses({ variante: "secundario", tamanho: "lg" })}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[640px] text-sm">
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
                    {formatarMoeda(p.valor, p.moeda)}
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
                    <button onClick={() => alternar(p.id, p.ativo ? "Preço desativado." : "Preço reativado.")} disabled={acao.ocupado} className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50">
                      {p.ativo ? "Desativar" : "Reativar"}
                    </button>
                    <FeedbackAcao erro={origem === p.id ? acao.erro : null} sucesso={origem === p.id ? acao.sucesso : undefined} className="mt-1 text-left" />
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
