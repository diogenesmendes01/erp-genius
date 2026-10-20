"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPais } from "@prisma/client";
import { IconPlus } from "@tabler/icons-react";
import { alterarStatusPais, alternarProdutoPais } from "@/server/paises/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { PaisFormulario, type PaisParaEditar } from "./PaisFormulario";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";

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
// A variante vive na tabela, junto do rótulo: encerrar é terminal (ENCERRADO não tem volta) e é perigo.
const ACOES_STATUS: Record<StatusPais, { label: string; alvo: StatusPais; variante: "perigo" | "fantasma" }[]> = {
  RASCUNHO: [{ label: "Ativar", alvo: StatusPais.ATIVO, variante: "fantasma" }],
  ATIVO: [
    { label: "Pausar", alvo: StatusPais.PAUSADO, variante: "fantasma" },
    { label: "Encerrar", alvo: StatusPais.ENCERRADO, variante: "perigo" },
  ],
  PAUSADO: [
    { label: "Reativar", alvo: StatusPais.ATIVO, variante: "fantasma" },
    { label: "Encerrar", alvo: StatusPais.ENCERRADO, variante: "perigo" },
  ],
  ENCERRADO: [],
};

/** Confirmação curta por status de destino, anunciada na linha do país. */
const CONFIRMACAO_STATUS: Record<StatusPais, string> = {
  RASCUNHO: "País voltou a rascunho.",
  ATIVO: "País ativado.",
  PAUSADO: "País pausado.",
  ENCERRADO: "País encerrado.",
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

  // Encerrar é terminal: ENCERRADO não tem transição de volta pela tela (docs/42 L2428). O botão só abre a
  // confirmação, que repete produtos, preços e alunos do país e pede o nome digitado; a action roda no
  // ConfirmarAcao. Ativar, pausar e reativar têm volta pela própria linha e continuam diretos.
  const [encerrando, setEncerrando] = useState<PaisRow | null>(null);

  async function mudarStatus(id: string, alvo: StatusPais) {
    setOrigem("status:" + id);
    const d = await acao.executar(() => alterarStatusPais(id, alvo), CONFIRMACAO_STATUS[alvo]);
    if (d?.tipo === "ok") router.refresh();
  }

  function escolherTransicao(p: PaisRow, alvo: StatusPais) {
    if (alvo !== StatusPais.ENCERRADO) {
      void mudarStatus(p.id, alvo);
      return;
    }
    setOrigem("status:" + p.id);
    acao.limpar();
    setEncerrando(p);
  }

  function encerrado(p: PaisRow) {
    setEncerrando(null);
    setOrigem("status:" + p.id);
    acao.setSucesso(CONFIRMACAO_STATUS[StatusPais.ENCERRADO]);
    router.refresh();
  }

  async function toggleProduto(paisId: string, produtoId: string) {
    setOrigem("catalogo:" + paisId);
    const d = await acao.executar(() => alternarProdutoPais(paisId, produtoId), "Catálogo do país atualizado.");
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
            className={botaoClasses({ tamanho: "lg" })}
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
        <EstadoVazio bloco>Nenhum país cadastrado ainda.</EstadoVazio>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-100 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">País</th>
                <th className="px-4 py-2 font-medium">Moeda</th>
                <th className="px-4 py-2 font-medium">DDI</th>
                <th className="px-4 py-2 font-medium">Documentos</th>
                <th className="px-4 py-2 font-medium">Produtos</th>
                <th className="px-4 py-2 font-medium">Preços</th>
                <th className="px-4 py-2 font-medium">Alunos</th>
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
                  <td className="px-4 py-3 text-gray-600">{p.produtosOferecidos.length}</td>
                  <td className="px-4 py-3 text-gray-600">{p._count.precos}</td>
                  <td className="px-4 py-3 text-gray-600">{p._count.alunos}</td>
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
                              // O id vai junto (C13 da #170): o servidor preserva o tipo por ele, e
                              // renomear um tipo em uso não vira "remover + criar".
                              tiposDocumento: p.tiposDocumento.map((d) => ({
                                id: d.id,
                                nome: d.nome,
                                validador: d.validador,
                              })),
                            },
                          })
                        }
                        className={botaoClasses({ variante: "fantasma", tamanho: "sm" })}
                      >
                        Editar
                      </button>
                      {ACOES_STATUS[p.status].map((a) => (
                        <button
                          key={a.alvo}
                          onClick={() => escolherTransicao(p, a.alvo)}
                          disabled={acao.ocupado || encerrando !== null}
                          className={botaoClasses({ variante: a.variante, tamanho: "sm" })}
                        >
                          {a.label}
                        </button>
                      ))}
                      <button
                        onClick={() => setCatalogo(catalogo === p.id ? null : p.id)}
                        className={botaoClasses({ variante: "fantasma", tamanho: "sm" })}
                      >
                        Catálogo
                      </button>
                    </div>
                    <FeedbackAcao erro={origem === "status:" + p.id ? acao.erro : null} sucesso={origem === "status:" + p.id ? acao.sucesso : undefined} className="mt-1" />
                  </td>
                </tr>,
                catalogo === p.id ? (
                  <tr key={p.id + "-cat"} className="bg-gray-100">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="text-xs font-medium text-gray-600">Idiomas/modalidades habilitados neste país</div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 md:grid-cols-3">
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
                      <FeedbackAcao erro={origem === "catalogo:" + p.id ? acao.erro : null} sucesso={origem === "catalogo:" + p.id ? acao.sucesso : undefined} className="mt-2" />
                    </td>
                  </tr>
                ) : null,
              ].filter(Boolean))}
            </tbody>
          </table>
        </div>
      )}

      {encerrando && (
        <ConfirmarAcao
          titulo={`Encerrar o país ${encerrando.nome}?`}
          confirmacao="encerramento do país"
          idempotente={false}
          digitacao={{ rotulo: `Digite ${encerrando.nome} para confirmar`, esperado: encerrando.nome }}
          acao={() => alterarStatusPais(encerrando.id, StatusPais.ENCERRADO)}
          aoConcluir={() => encerrado(encerrando)}
          aoCancelar={() => setEncerrando(null)}
        >
          <ResumoEncerramento pais={encerrando} />
        </ConfirmarAcao>
      )}
    </div>
  );
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O que o encerramento atinge: produtos habilitados, preços e alunos do país — e que não há volta. */
function ResumoEncerramento({ pais }: { pais: PaisRow }) {
  return (
    <>
      <p>
        <strong>{pais.nome}</strong> ({pais.codigoISO}) tem {plural(pais.produtosOferecidos.length, "produto habilitado", "produtos habilitados")},{" "}
        {plural(pais._count.precos, "preço cadastrado", "preços cadastrados")} (com o histórico) e {plural(pais._count.alunos, "aluno cadastrado", "alunos cadastrados")}.
      </p>
      <p>
        O país sai das novas matrículas e das ofertas do catálogo. Alunos, matrículas, preços e cobranças que já existem
        continuam; nada é apagado.
      </p>
      <p>Encerrar não tem volta pela tela: um país encerrado não pode ser reativado aqui.</p>
    </>
  );
}
