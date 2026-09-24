"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusAluno } from "@prisma/client";
import { STATUS_ALUNO_LABEL } from "@/lib/labels";
import { ALUNOS_POR_PAGINA, filtrosParaQuery, lerFiltrosAlunos, temFiltroAlunos, type FiltrosAlunos } from "@/server/alunos/filtros";
import { ImportarAlunosModal } from "./ImportarAlunosModal";

export interface AlunoRow {
  id: string;
  codigo: string | null;
  nome: string;
  status: StatusAluno;
  pais: string;
  turmas: { id: string; label: string }[];
  financeiro: { atrasado: boolean; emAberto: { moeda: string; valor: number }[] } | null;
}

const STATUS_CLS: Record<StatusAluno, string> = {
  ATIVO: "bg-green-100 text-green-700",
  PAUSADO: "bg-amber-100 text-amber-700",
  ENCERRADO: "bg-gray-200 text-gray-500",
};

const campo = "rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500";

/** Link da mesma lista com os filtros atuais e outra página. */
const hrefPagina = (f: FiltrosAlunos, pagina: number) => {
  const q = filtrosParaQuery({ ...f, pagina });
  return q ? `/alunos?${q}` : "/alunos";
};

// Lista de alunos (E4): os filtros vivem na URL e são aplicados no servidor. Navegação dentro de uma
// transição: enquanto a nova página não chega, o botão mostra "Buscando…" e a tabela fica aria-busy.
// Trocar um filtro volta à página 1. Os selects enviam após uma pausa curta (setas do teclado não
// criam uma navegação — e uma entrada de histórico — por tecla).
export function AlunosLista({
  alunos,
  total,
  totalBase,
  filtros,
  opcoes,
  exibirFinanceiro,
  podeCadastrar = false,
  podeImportar = false,
}: {
  alunos: AlunoRow[];
  /** Alunos que atendem aos filtros (todas as páginas). */
  total: number;
  /** Alunos no escopo do usuário, sem filtro — distingue "nenhum aluno" de "nenhum resultado". */
  totalBase: number;
  filtros: FiltrosAlunos;
  opcoes: { paises: { id: string; nome: string }[]; turmas: { id: string; label: string }[] };
  exibirFinanceiro: boolean;
  podeCadastrar?: boolean;
  podeImportar?: boolean;
}) {
  const filtrando = temFiltroAlunos(filtros);
  const inicio = total ? (filtros.pagina - 1) * ALUNOS_POR_PAGINA + 1 : 0;
  const fim = (filtros.pagina - 1) * ALUNOS_POR_PAGINA + alunos.length;
  const temProxima = fim < total;
  const router = useRouter();
  const [buscando, iniciar] = useTransition();
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (espera.current) clearTimeout(espera.current); }, []);

  const navegar = (href: string) => iniciar(() => router.push(href));
  const aplicar = (form: HTMLFormElement) => {
    if (espera.current) clearTimeout(espera.current);
    // Mesmo leitor da página: só as chaves de filtro, validadas; página volta à 1.
    const query = filtrosParaQuery(lerFiltrosAlunos(new URLSearchParams(new FormData(form) as unknown as string[][])));
    navegar(query ? `/alunos?${query}` : "/alunos");
  };
  const enviarDepois = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const form = e.currentTarget.form;
    if (espera.current) clearTimeout(espera.current);
    if (form) espera.current = setTimeout(() => aplicar(form), 400);
  };
  /** Link real (abre em nova aba, copia) que, no clique simples, navega dentro da transição. */
  const aoClicar = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navegar(href);
  };
  // Chave dos campos: quando os filtros mudam (Limpar, voltar do navegador, link), o formulário é
  // recriado com os valores novos — com defaultValue, o Next manteria os antigos na tela.
  const chaveFiltros = filtrosParaQuery(filtros, { semPagina: true });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-medium">Alunos</h1>
        <div className="flex items-center gap-2">
          {podeImportar && <ImportarAlunosModal />}
          {podeCadastrar && (
            <Link
              href="/matriculas/nova"
              className="rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white hover:brightness-95"
            >
              Cadastrar aluno
            </Link>
          )}
        </div>
      </div>

      <form
        key={chaveFiltros}
        data-filtros={chaveFiltros}
        action="/alunos"
        onSubmit={(e) => { e.preventDefault(); aplicar(e.currentTarget); }}
        className="mb-3 flex flex-wrap items-center gap-2"
        role="search"
        aria-label="Filtrar alunos"
      >
        <input
          name="busca"
          defaultValue={filtros.busca}
          maxLength={100}
          aria-label="Buscar aluno por nome ou código"
          placeholder="Buscar por nome ou código…"
          className={campo + " w-64 px-3"}
        />
        <select name="status" defaultValue={filtros.status ?? ""} onChange={enviarDepois} aria-label="Filtrar por status" className={campo}>
          <option value="">Todos os status</option>
          {Object.values(StatusAluno).map((s) => (
            <option key={s} value={s}>{STATUS_ALUNO_LABEL[s]}</option>
          ))}
        </select>
        <select name="pais" defaultValue={filtros.paisId ?? ""} onChange={enviarDepois} aria-label="Filtrar por país" className={campo}>
          <option value="">Todos os países</option>
          {opcoes.paises.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
        <select name="turma" defaultValue={filtros.turmaId ?? ""} onChange={enviarDepois} aria-label="Filtrar por turma" className={campo}>
          <option value="">Todas as turmas</option>
          {opcoes.turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <button type="submit" disabled={buscando} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          {buscando ? "Buscando…" : "Buscar"}
        </button>
        {filtrando && <Link href="/alunos" onClick={aoClicar("/alunos")} className="text-sm text-brand-700 hover:underline">Limpar filtros</Link>}
      </form>

      <p className="mb-2 text-xs text-gray-500" aria-live="polite">
        {buscando ? "Buscando…" : total === 0 || alunos.length === 0 ? "Nenhum aluno" : filtrando
          ? `${inicio}–${fim} de ${total} ${total === 1 ? "aluno encontrado" : "alunos encontrados"} (de ${totalBase} no total)`
          : `${inicio}–${fim} de ${total} ${total === 1 ? "aluno" : "alunos"}`}
      </p>

      <div aria-busy={buscando} className={"overflow-x-auto rounded-lg border border-gray-200 transition-opacity " + (buscando ? "opacity-60" : "")}>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Aluno</th>
              <th className="px-4 py-2 font-medium">País</th>
              <th className="px-4 py-2 font-medium">Turma</th>
              <th className="px-4 py-2 font-medium">Status</th>
              {exibirFinanceiro && <th className="px-4 py-2 font-medium">Financeiro</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {alunos.length === 0 ? (
              <tr>
                <td colSpan={exibirFinanceiro ? 5 : 4} className="px-4 py-6 text-center text-sm text-gray-500">
                  {/* Estado vazio duplo: base vazia × filtro sem resultado (este oferece a saída). */}
                  {totalBase === 0 ? "Nenhum aluno cadastrado no seu alcance." : filtrando ? (
                    <>Nenhum aluno com esses filtros. <Link href="/alunos" onClick={aoClicar("/alunos")} className="text-brand-700 hover:underline">Limpar filtros</Link></>
                  ) : (
                    <>Nenhum aluno nesta página. <Link href="/alunos" onClick={aoClicar("/alunos")} className="text-brand-700 hover:underline">Ir para a primeira página</Link></>
                  )}
                </td>
              </tr>
            ) : (
              alunos.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/alunos/${a.id}`} className="font-medium text-brand-700 hover:underline">
                      {a.nome}
                    </Link>
                    <div className="text-xs text-gray-400">{a.codigo}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.pais}</td>
                  <td className="px-4 py-3 text-gray-600">{a.turmas.length ? a.turmas.map((t) => <div key={t.id}>{t.label}</div>) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_CLS[a.status]}>
                      {STATUS_ALUNO_LABEL[a.status]}
                    </span>
                  </td>
                  {exibirFinanceiro && <td className="px-4 py-3">
                    {a.financeiro === null ? "—" : a.financeiro.atrasado ? (
                      <span className="text-red-600">Em atraso</span>
                    ) : (
                      <span className="text-green-600">Em dia</span>
                    )}
                  </td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(filtros.pagina > 1 || temProxima) && (
        <nav aria-label="Páginas de alunos" className="mt-3 flex items-center gap-4 text-sm">
          {filtros.pagina > 1 && <Link href={hrefPagina(filtros, filtros.pagina - 1)} onClick={aoClicar(hrefPagina(filtros, filtros.pagina - 1))} className="text-brand-700 hover:underline">← Anterior</Link>}
          <span className="text-gray-500">Página {filtros.pagina}</span>
          {temProxima && <Link href={hrefPagina(filtros, filtros.pagina + 1)} onClick={aoClicar(hrefPagina(filtros, filtros.pagina + 1))} className="text-brand-700 hover:underline">Próxima →</Link>}
        </nav>
      )}
    </div>
  );
}
