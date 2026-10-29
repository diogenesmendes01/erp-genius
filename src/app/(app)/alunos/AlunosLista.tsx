"use client";

import Link from "next/link";
import { StatusAluno } from "@prisma/client";
import { STATUS_ALUNO_LABEL } from "@/lib/labels";
import { ALUNOS_POR_PAGINA, ORDEM_PADRAO_ALUNOS, camposDosFiltros, filtrosParaQuery, hrefAlunos, hrefDosCampos, lerFiltrosAlunos, parametrosFiltrosAlunos, temFiltroAlunos, type FiltrosAlunos } from "@/server/alunos/filtros";
import { useFiltrosUrl } from "@/lib/filtros-url";
import { mesmaOrdenacao } from "@/lib/ordenacao";
import { Paginacao } from "@/components/Paginacao";
import { ColunaOrdenavel } from "@/components/ColunaOrdenavel";
import { ImportarAlunosModal } from "./ImportarAlunosModal";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazioLinha } from "@/components/EstadoVazio";
import { SeletorCampo } from "@/app/(app)/secretaria/controles";
import { Avatar } from "@/components/Avatar";
import { BadgeEstado, type TomEstado } from "@/components/BadgeEstado";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export interface AlunoRow {
  id: string;
  codigo: string | null;
  nome: string;
  status: StatusAluno;
  pais: string;
  turmas: { id: string; label: string }[];
  financeiro: { atrasado: boolean; emAberto: { moeda: string; valor: number }[] } | null;
}

const TOM_STATUS: Record<StatusAluno, TomEstado> = {
  ATIVO: "sucesso",
  PAUSADO: "aviso",
  ENCERRADO: "neutro",
};

const campo = "rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500";

const hrefPagina = (f: FiltrosAlunos, pagina: number) => {
  const q = filtrosParaQuery({ ...f, pagina });
  return q ? `/alunos?${q}` : "/alunos";
};

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
  total: number;
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
  const { campos, buscando, aplicar, mudarTexto, mudarSelect, aoClicar } = useFiltrosUrl({
    campos: camposDosFiltros(filtros),
    hrefDosCampos: (c) => hrefDosCampos(c, filtros.ordem),
  });
  const limpar = hrefAlunos({ ...lerFiltrosAlunos({}), ordem: filtros.ordem });
  const ordemNaoPadrao = !mesmaOrdenacao(filtros.ordem, ORDEM_PADRAO_ALUNOS);
  const coluna = { ordenacao: filtros.ordem, rota: "/alunos", parametros: parametrosFiltrosAlunos(filtros), aoClicar };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium">Alunos</h1>
        <div className="flex flex-wrap items-center gap-2">
          {podeImportar && <ImportarAlunosModal />}
          {podeCadastrar && (
            <Link
              href="/matriculas/nova"
              className={botaoClasses({ tamanho: "lg" })}
            >
              Cadastrar aluno
            </Link>
          )}
        </div>
      </div>

      <form
        action="/alunos"
        onSubmit={(e) => { e.preventDefault(); aplicar(campos); }}
        className="mb-3 flex flex-wrap items-center gap-2"
        role="search"
        aria-label="Filtrar alunos"
      >
        <input
          name="busca"
          value={campos.busca}
          onChange={mudarTexto("busca")}
          maxLength={100}
          aria-label="Buscar aluno por nome ou código"
          placeholder="Buscar por nome ou código…"
          className={campo + " w-64 px-3"}
        />
        <SeletorCampo name="status" value={campos.status} onChange={mudarSelect("status")} aria-label="Filtrar por status" className={campo}>
          <option value="">Todos os status</option>
          {Object.values(StatusAluno).map((s) => (
            <option key={s} value={s}>{STATUS_ALUNO_LABEL[s]}</option>
          ))}
        </SeletorCampo>
        <SeletorCampo name="pais" value={campos.pais} onChange={mudarSelect("pais")} aria-label="Filtrar por país" className={campo} busca>
          <option value="">Todos os países</option>
          {opcoes.paises.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </SeletorCampo>
        <SeletorCampo name="turma" value={campos.turma} onChange={mudarSelect("turma")} aria-label="Filtrar por turma" className={campo} busca>
          <option value="">Todas as turmas</option>
          {opcoes.turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </SeletorCampo>
        {ordemNaoPadrao && <>
          <input type="hidden" name="ordem" value={filtros.ordem.campo} />
          <input type="hidden" name="dir" value={filtros.ordem.dir} />
        </>}
        <button type="submit" disabled={buscando} className={botaoClasses({ variante: "secundario" })}>
          {buscando ? "Buscando…" : "Buscar"}
        </button>
        {filtrando && <Link href={limpar} onClick={aoClicar(limpar)} className="text-sm text-brand-700 hover:underline">Limpar filtros</Link>}
      </form>

      <p className="mb-2 text-xs text-gray-500" aria-live="polite">
        {buscando ? "Buscando…" : total === 0 || alunos.length === 0 ? "Nenhum aluno" : filtrando
          ? `${inicio}–${fim} de ${total} ${total === 1 ? "aluno encontrado" : "alunos encontrados"} (de ${totalBase} no total)`
          : `${inicio}–${fim} de ${total} ${total === 1 ? "aluno" : "alunos"}`}
      </p>

      <div aria-busy={buscando} className={"overflow-x-auto rounded-lg border border-gray-200 transition-opacity " + (buscando ? "opacity-60" : "")}>
        <Table className="w-full min-w-[640px] text-sm">
          <TableHeader className="bg-surface-muted text-left text-xs text-gray-500">
            <TableRow>
              <ColunaOrdenavel campo="nome" rotulo="Aluno" {...coluna} />
              <ColunaOrdenavel campo="pais" rotulo="País" {...coluna} />
              <TableHead className="px-4 py-2 font-medium">Turma</TableHead>
              <ColunaOrdenavel campo="status" rotulo="Status" {...coluna} />
              {exibirFinanceiro && <TableHead className="px-4 py-2 font-medium">Financeiro</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {alunos.length === 0 ? (
              <EstadoVazioLinha colSpan={exibirFinanceiro ? 5 : 4}>
                  {totalBase === 0 ? "Nenhum aluno cadastrado no seu alcance." : filtrando ? (
                    <>Nenhum aluno com esses filtros. <Link href={limpar} onClick={aoClicar(limpar)} className="text-brand-700 hover:underline">Limpar filtros</Link></>
                  ) : (
                    <>Nenhum aluno nesta página. <Link href={limpar} onClick={aoClicar(limpar)} className="text-brand-700 hover:underline">Ir para a primeira página</Link></>
                  )}
                </EstadoVazioLinha>
            ) : (
              alunos.map((a) => (
                <TableRow key={a.id} className="hover:bg-surface-muted">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar nome={a.nome} tamanho={32} />
                      <div>
                        <Link href={`/alunos/${a.id}`} className="font-medium text-brand-700 hover:underline">
                          {a.nome}
                        </Link>
                        <div className="font-mono text-xs tabular-nums text-gray-500">{a.codigo}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{a.pais}</TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{a.turmas.length ? a.turmas.map((t) => <div key={t.id}>{t.label}</div>) : "—"}</TableCell>
                  <TableCell className="px-4 py-3">
                    <BadgeEstado tom={TOM_STATUS[a.status]}>{STATUS_ALUNO_LABEL[a.status]}</BadgeEstado>
                  </TableCell>
                  {exibirFinanceiro && <TableCell className="px-4 py-3">
                    {a.financeiro === null ? "—" : a.financeiro.atrasado ? (
                      <span className="text-red-600">Em atraso</span>
                    ) : (
                      <span className="text-green-600">Em dia</span>
                    )}
                  </TableCell>}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Paginacao pagina={filtros.pagina} temProxima={temProxima} href={(p) => hrefPagina(filtros, p)} aoClicar={aoClicar} rotulo="Páginas de alunos" />
    </div>
  );
}
