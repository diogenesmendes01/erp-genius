"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmpresaResumo } from "@/server/empresas/consultas";
import { salvarEmpresa } from "@/server/empresas/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useFiltrosUrl } from "@/lib/filtros-url";
import { Paginacao } from "@/components/Paginacao";
import {
  EMPRESAS_POR_PAGINA,
  camposDosFiltrosEmpresas,
  filtrosEmpresasParaQuery,
  hrefDosCamposEmpresas,
  temFiltroEmpresas,
  type FiltrosEmpresas,
} from "@/server/empresas/filtros";
import { botaoClasses } from "@/components/Botao";

// Empresas representam o responsável financeiro. As matrículas permanecem contratos
// individuais; a ficha conserva o cadastro e o histórico financeiro da empresa.

const btnPri = botaoClasses();
const inputCls = "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500";
const campoFiltro = "rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500";

/** Link da mesma lista com os filtros atuais e outra página. */
const hrefPagina = (f: FiltrosEmpresas, pagina: number) => {
  const q = filtrosEmpresasParaQuery({ ...f, pagina });
  return q ? `/empresas?${q}` : "/empresas";
};

// Lista (E4): busca, situação e país na URL, aplicados no servidor, uma página por vez.
export function EmpresasCliente({
  empresas,
  total,
  totalBase,
  filtros,
  paises,
}: {
  empresas: EmpresaResumo[];
  /** Empresas que atendem aos filtros (todas as páginas). */
  total: number;
  /** Empresas cadastradas, sem filtro — distingue "nenhuma empresa" de "nenhum resultado". */
  totalBase: number;
  filtros: FiltrosEmpresas;
  paises: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const filtrando = temFiltroEmpresas(filtros);
  const inicio = total ? (filtros.pagina - 1) * EMPRESAS_POR_PAGINA + 1 : 0;
  const fim = (filtros.pagina - 1) * EMPRESAS_POR_PAGINA + empresas.length;
  const lista = useFiltrosUrl({ campos: camposDosFiltrosEmpresas(filtros), hrefDosCampos: hrefDosCamposEmpresas });
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [paisId, setPaisId] = useState("");
  // salvarEmpresa não recebe chave de idempotência (server/empresas/acoes.ts:41 — sem id, cria uma
  // empresa nova a cada chamada, :68): resultado incerto manda conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });

  async function criar() {
    const d = await acao.executar(() => salvarEmpresa({ nome, paisId }));
    if (d?.tipo !== "ok") return;
    setCriando(false);
    setNome("");
    if (d.dado) router.push(`/empresas/${d.dado.id}`);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Empresas (B2B)</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cadastro do responsável financeiro para contratos individuais e consulta de faturas históricas.
          </p>
        </div>
        <button className={btnPri} onClick={() => setCriando((v) => !v)}>Nova empresa</button>
      </div>

      {criando && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-surface p-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">Nome da empresa</span>
            <input className={inputCls + " w-72"} value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">País (moeda/vencimentos)</span>
            <select className={inputCls} value={paisId} onChange={(e) => setPaisId(e.target.value)}>
              <option value="">—</option>
              {paises.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>
          <button className={btnPri} disabled={acao.ocupado || nome.trim().length < 2} onClick={criar}>
            {acao.ocupado ? "Criando…" : "Criar"}
          </button>
          <FeedbackAcao erro={acao.erro} className="basis-full" />
        </div>
      )}

      <div>
        <form
          action="/empresas"
          onSubmit={(e) => { e.preventDefault(); lista.aplicar(lista.campos); }}
          className="mb-3 flex flex-wrap items-center gap-2"
          role="search"
          aria-label="Filtrar empresas"
        >
          <input
            name="busca"
            value={lista.campos.busca}
            onChange={lista.mudarTexto("busca")}
            maxLength={100}
            aria-label="Buscar empresa por nome ou código"
            placeholder="Buscar por nome ou código…"
            className={campoFiltro + " w-64 px-3"}
          />
          <select name="situacao" value={lista.campos.situacao} onChange={lista.mudarSelect("situacao")} aria-label="Filtrar por situação" className={campoFiltro}>
            <option value="">Ativas e inativas</option>
            <option value="ativas">Ativas</option>
            <option value="inativas">Inativas</option>
          </select>
          <select name="pais" value={lista.campos.pais} onChange={lista.mudarSelect("pais")} aria-label="Filtrar por país" className={campoFiltro}>
            <option value="">Todos os países</option>
            {paises.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <button type="submit" disabled={lista.buscando} className={botaoClasses({ variante: "secundario" })}>
            {lista.buscando ? "Buscando…" : "Buscar"}
          </button>
          {filtrando && <Link href="/empresas" onClick={lista.aoClicar("/empresas")} className="text-sm text-brand-700 hover:underline">Limpar filtros</Link>}
        </form>

        <p className="mb-2 text-xs text-gray-500" aria-live="polite">
          {lista.buscando ? "Buscando…" : total === 0 || empresas.length === 0 ? "Nenhuma empresa" : filtrando
            ? `${inicio}–${fim} de ${total} ${total === 1 ? "empresa encontrada" : "empresas encontradas"} (de ${totalBase} no total)`
            : `${inicio}–${fim} de ${total} ${total === 1 ? "empresa" : "empresas"}`}
        </p>

        {empresas.length === 0 ? (
          <div aria-busy={lista.buscando} className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            {/* Estado vazio duplo: nenhuma cadastrada × filtro sem resultado (este oferece a saída). */}
            {totalBase === 0 ? "Nenhuma empresa ainda. Crie a primeira para registrar o responsável financeiro de contratos individuais." : filtrando ? (
              <>Nenhuma empresa com esses filtros. <Link href="/empresas" onClick={lista.aoClicar("/empresas")} className="text-brand-700 hover:underline">Limpar filtros</Link></>
            ) : (
              <>Nenhuma empresa nesta página. <Link href="/empresas" onClick={lista.aoClicar("/empresas")} className="text-brand-700 hover:underline">Ir para a primeira página</Link></>
            )}
          </div>
        ) : (
          <div aria-busy={lista.buscando} className={"overflow-x-auto rounded-lg border border-gray-200 transition-opacity " + (lista.buscando ? "opacity-60" : "")}>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Código</th>
                  <th className="px-4 py-2 font-medium">Empresa</th>
                  <th className="px-4 py-2 font-medium">País</th>
                  <th className="px-4 py-2 font-medium">Colaboradores</th>
                  {/* Faturas FECHADAS = emitidas e aguardando pagamento (StatusFaturaB2B). */}
                  <th className="px-4 py-2 font-medium">Faturas a receber</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {empresas.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">{e.codigo ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Link href={`/empresas/${e.id}`} className="font-medium text-gray-800 hover:underline">
                        {e.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{e.pais ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-700">{e.colaboradores}</td>
                    <td className="px-4 py-2 text-gray-700">{e.faturasAReceber}</td>
                    <td className="px-4 py-2">
                      <span className={"rounded-full px-2 py-0.5 text-xs " + (e.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                        {e.ativo ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Paginacao
          pagina={filtros.pagina}
          temProxima={fim < total}
          href={(p) => hrefPagina(filtros, p)}
          aoClicar={lista.aoClicar}
          rotulo="Páginas de empresas"
        />
      </div>
    </div>
  );
}
