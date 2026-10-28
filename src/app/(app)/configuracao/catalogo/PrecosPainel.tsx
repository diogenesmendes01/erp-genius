"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { TipoCobranca } from "@prisma/client";
import { formatarMoeda, parseMoeda } from "@/lib/dinheiro";
import { criarPreco, definirPrecoAtivo } from "@/server/catalogo/acoes";
import { CampoMoeda } from "@/components/CampoMoeda";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazioLinha } from "@/components/EstadoVazio";
import { TIPO_COBRANCA_LABEL } from "@/lib/labels";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CampoSelect } from "@/components/ui/select";
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
  "rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500";

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
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  const [origem, setOrigem] = useState<string | null>(null);

  const [paisId, setPaisId] = useState(paises[0]?.id ?? "");
  const [produtoId, setProdutoId] = useState(produtos[0]?.id ?? "");
  const [tipoCobranca, setTipo] = useState<TipoCobranca>(TipoCobranca.MENSALIDADE);
  const [valor, setValor] = useState("");
  const [versaoEstudo, setVersao] = useState("");

  const moedaPais = paises.find((p) => p.id === paisId)?.moedaLocal ?? "";

  async function salvar() {
    setOrigem("novo");
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
      chaveIdempotencia: tentativa.atual,
    }));
    tentativa.depoisDo(d);
    if (d?.tipo !== "ok") return;
    setValor("");
    setVersao("");
    setAberto(false);
    router.refresh();
  }

  async function reativar(id: string) {
    setOrigem(id);
    const d = await acao.executar(() => definirPrecoAtivo(id, true), "Preço reativado.");
    if (d?.tipo === "ok") router.refresh();
  }

  const [desativando, setDesativando] = useState<PrecoRow | null>(null);
  function pedirDesativacao(p: PrecoRow) {
    setOrigem(p.id);
    acao.limpar();
    setDesativando(p);
  }
  function desativado(p: PrecoRow) {
    setDesativando(null);
    setOrigem(p.id);
    acao.setSucesso("Preço desativado.");
    router.refresh();
  }
  const mesmaCombinacao = (a: PrecoRow, b: PrecoRow) =>
    a.pais.nome === b.pais.nome && a.produto.idioma.nome === b.produto.idioma.nome && a.produto.modalidade.nome === b.produto.modalidade.nome && a.tipoCobranca === b.tipoCobranca;
  const restaAtivo = (p: PrecoRow) => precos.some((o: PrecoRow) => o.id !== p.id && o.ativo && mesmaCombinacao(o, p));

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
              <CampoSelect id="precos-pais" value={paisId} onChange={(e) => setPaisId(e.target.value)} className={inputCls + " w-full"} opcoes={paises.map((p) => ({ valor: String(p.id), rotulo: p.nome }))} />
            </div>
            <div>
              <label htmlFor="precos-produto" className="mb-1 block text-xs text-gray-600">Produto</label>
              <CampoSelect id="precos-produto" value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className={inputCls + " w-full"} opcoes={produtos.map((p) => ({ valor: String(p.id), rotulo: p.label }))} />
            </div>
            <div>
              <label htmlFor="precos-tipo-cobranca" className="mb-1 block text-xs text-gray-600">Tipo de cobrança</label>
              <CampoSelect id="precos-tipo-cobranca" value={tipoCobranca} onChange={(e) => setTipo(e.target.value as TipoCobranca)} className={inputCls + " w-full"} opcoes={Object.values(TipoCobranca).filter(t => t !== TipoCobranca.MULTA_ENCERRAMENTO).map((t) => ({ valor: String(t), rotulo: TIPO_COBRANCA_LABEL[t] }))} />
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
        <Table className="w-full min-w-[640px] text-sm">
          <TableHeader className="bg-surface-muted text-left text-xs text-gray-500">
            <TableRow>
              <TableHead className="px-4 py-2 font-medium">País</TableHead>
              <TableHead className="px-4 py-2 font-medium">Produto</TableHead>
              <TableHead className="px-4 py-2 font-medium">Tipo</TableHead>
              <TableHead className="px-4 py-2 font-medium">Valor</TableHead>
              <TableHead className="px-4 py-2 font-medium">Status</TableHead>
              <TableHead className="px-4 py-2 font-medium text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {precos.length === 0 ? (
              <EstadoVazioLinha colSpan={6}>
                  Nenhum preço cadastrado.
                </EstadoVazioLinha>
            ) : (
              precos.map((p) => (
                <TableRow key={p.id} className={"hover:bg-highlight " + (p.ativo ? "" : "text-gray-400")}>
                  <TableCell className="px-4 py-3">{p.pais.nome}</TableCell>
                  <TableCell className="px-4 py-3">
                    {p.produto.idioma.nome} · {p.produto.modalidade.nome}
                  </TableCell>
                  <TableCell className="px-4 py-3">{TIPO_COBRANCA_LABEL[p.tipoCobranca]}</TableCell>
                  <TableCell className="px-4 py-3">
                    {formatarMoeda(p.valor, p.moeda)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (p.ativo ? "bg-green-100 text-green-700" : "bg-surface-muted text-gray-500")
                      }
                    >
                      {p.ativo ? "Ativo" : "Histórico"}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <button onClick={() => (p.ativo ? pedirDesativacao(p) : reativar(p.id))} disabled={acao.ocupado || desativando !== null} className={botaoClasses({ variante: p.ativo ? "perigo" : "fantasma", tamanho: "sm" })}>
                      {p.ativo ? "Desativar" : "Reativar"}
                    </button>
                    <FeedbackAcao erro={origem === p.id ? acao.erro : null} sucesso={origem === p.id ? acao.sucesso : undefined} className="mt-1 text-left" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {desativando && (
        <ConfirmarAcao
          titulo={`Desativar o preço de ${desativando.produto.idioma.nome} · ${desativando.produto.modalidade.nome} em ${desativando.pais.nome}?`}
          confirmacao="desativação do preço"
          idempotente
          acao={() => definirPrecoAtivo(desativando.id, false)}
          aoConcluir={() => desativado(desativando)}
          aoCancelar={() => setDesativando(null)}
        >
          <p>
            {TIPO_COBRANCA_LABEL[desativando.tipoCobranca]} de {formatarMoeda(desativando.valor, desativando.moeda)} passa ao histórico.
          </p>
          {restaAtivo(desativando) ? (
            <p>Outro preço ativo da mesma combinação continua valendo.</p>
          ) : (
            <p>
              <strong>Não resta outro preço ativo</strong> para {desativando.pais.nome} × {desativando.produto.idioma.nome} · {desativando.produto.modalidade.nome} × {TIPO_COBRANCA_LABEL[desativando.tipoCobranca]}: novas matrículas desse produto ficam sem preço de referência até você reativar este ou criar outro.
            </p>
          )}
        </ConfirmarAcao>
      )}
    </section>
  );
}
